import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

/**
 * Computes exact epoch boundaries for today (00:00:00 to 23:59:59.999) and
 * the current month in the store's configured IANA timezone.
 */
function getTimezoneBoundaries(tz = "Asia/Kolkata", now = Date.now()) {
  const d = new Date(now);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [yearStr, monthStr, dayStr] = fmt.format(d).split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  function getOffset(utcDate: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).formatToParts(utcDate);
    const p: Record<string, number> = {};
    for (const part of parts) p[part.type] = Number(part.value);
    const localInUtc = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour === 24 ? 0 : p.hour,
      p.minute,
      p.second
    );
    return localInUtc - utcDate.getTime();
  }

  // Today boundaries
  const approxTodayUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetToday = getOffset(new Date(approxTodayUtc), tz);
  const startOfTodayMs = approxTodayUtc - offsetToday;
  const endOfTodayMs = startOfTodayMs + 24 * 60 * 60 * 1000 - 1;

  // Month boundaries
  const approxMonthUtc = Date.UTC(year, month - 1, 1, 0, 0, 0);
  const offsetMonth = getOffset(new Date(approxMonthUtc), tz);
  const startOfMonthMs = approxMonthUtc - offsetMonth;

  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const approxNextMonthUtc = Date.UTC(nextMonthYear, nextMonth - 1, 1, 0, 0, 0);
  const offsetNextMonth = getOffset(new Date(approxNextMonthUtc), tz);
  const endOfMonthMs = approxNextMonthUtc - offsetNextMonth - 1;

  return { startOfTodayMs, endOfTodayMs, startOfMonthMs, endOfMonthMs };
}

function formatCurrency(minorAmount: number, currency = "INR"): string {
  const major = minorAmount / 100;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate caller & resolve store context
    let storeContext: any;
    try {
      storeContext = await requireStoreAdminContext(req);
    } catch (authErr: any) {
      return NextResponse.json(
        {
          success: false,
          code: authErr.code || "UNAUTHORIZED",
          error: authErr.message || "Unauthorized access.",
        },
        { status: authErr.status || 401 }
      );
    }

    // 2. Resolve Razorpay gateway connection for this store
    const connection = await storeContext.storeConvexClient.query(
      api.paymentGateways.getConnectionCredentials,
      {
        organizationId: storeContext.orgId,
        provider: "razorpay",
      }
    );

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          code: "CONNECTION_NOT_FOUND",
          error: "No Razorpay connection found for this store. Please connect Razorpay in Marketplace.",
        },
        { status: 404 }
      );
    }

    // 3. Resolve store timezone (or default to Asia/Kolkata)
    const storeTz =
      storeContext.organizationTimeZone ||
      connection.metadata?.timezone ||
      process.env.STORE_TIMEZONE ||
      "Asia/Kolkata";

    // 4. Calculate calendar boundaries in store timezone
    const boundaries = getTimezoneBoundaries(storeTz);

    // 5. Query Convex for aggregated metrics (sub-2-second, no external API calls)
    const analytics = await storeContext.storeConvexClient.query(
      api.paymentGateways.getDashboardAnalytics,
      {
        organizationId: storeContext.orgId,
        connectionId: connection.connectionId,
        provider: "razorpay",
        startOfTodayMs: boundaries.startOfTodayMs,
        endOfTodayMs: boundaries.endOfTodayMs,
        startOfMonthMs: boundaries.startOfMonthMs,
        endOfMonthMs: boundaries.endOfMonthMs,
      }
    );

    const primaryCurrency = analytics.primaryCurrency || "INR";

    return NextResponse.json({
      success: true,
      metrics: {
        todayRevenue: {
          grossMinor: analytics.todayRevenue.grossMinor,
          refundsMinor: analytics.todayRevenue.refundsMinor,
          netMinor: analytics.todayRevenue.netMinor,
          formattedGross: formatCurrency(analytics.todayRevenue.grossMinor, primaryCurrency),
          formattedRefunds: formatCurrency(analytics.todayRevenue.refundsMinor, primaryCurrency),
          formattedNet: formatCurrency(analytics.todayRevenue.netMinor, primaryCurrency),
          currency: primaryCurrency,
        },
        monthlyRevenue: {
          grossMinor: analytics.monthlyRevenue.grossMinor,
          refundsMinor: analytics.monthlyRevenue.refundsMinor,
          netMinor: analytics.monthlyRevenue.netMinor,
          formattedGross: formatCurrency(analytics.monthlyRevenue.grossMinor, primaryCurrency),
          formattedRefunds: formatCurrency(analytics.monthlyRevenue.refundsMinor, primaryCurrency),
          formattedNet: formatCurrency(analytics.monthlyRevenue.netMinor, primaryCurrency),
          currency: primaryCurrency,
        },
        successfulPayments: analytics.successfulPayments,
        failedPayments: analytics.failedPayments,
        pendingPayments: analytics.pendingPayments,
        refundCount: analytics.refundCount,
        successRate: analytics.successRate,
        currency: primaryCurrency,
        currencies: analytics.currencies,
      },
      connection: {
        id: connection.connectionId,
        status: connection.status,
        accountMode: connection.accountMode,
        merchantName: connection.merchantName,
        maskedKeyId: connection.maskedKeyId,
        connectedAt: connection.connectedAt,
      },
      boundaries: {
        startOfToday: boundaries.startOfTodayMs,
        endOfToday: boundaries.endOfTodayMs,
        startOfMonth: boundaries.startOfMonthMs,
        endOfMonth: boundaries.endOfMonthMs,
      },
      timezone: storeTz,
      generatedAt: Date.now(),
    });
  } catch (err: any) {
    console.error("[Razorpay Dashboard API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to retrieve dashboard analytics.",
      },
      { status: 500 }
    );
  }
}
