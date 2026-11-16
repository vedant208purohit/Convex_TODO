import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { api } from "../../../../../convex/_generated/api";
import { formatCurrencyMinor, resolveOrganizationCurrency } from "../../../../../lib/constants/countries";

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

    const storeCurrencyInfo = resolveOrganizationCurrency({
      country: storeContext.storeCountry,
      defaultCurrency: storeContext.defaultCurrency,
      defaultCurrencySymbol: storeContext.defaultCurrencySymbol,
    });

    const primaryCurrency =
      (typeof analytics.storeCurrency === "string" ? analytics.storeCurrency : null) ||
      analytics.primaryCurrency ||
      storeContext.storeCurrency ||
      storeCurrencyInfo.code ||
      "INR";
    const locale = storeCurrencyInfo.locale || (primaryCurrency === "INR" ? "en-IN" : "en-US");
    const currencySymbol = storeCurrencyInfo.symbol || (primaryCurrency === "INR" ? "₹" : primaryCurrency);

    const activeCurrencies = Object.keys(analytics.currencies || {});
    const isSingleForeign = activeCurrencies.length === 1 && activeCurrencies[0] !== primaryCurrency;
    const effectiveDisplayCurrency = isSingleForeign ? activeCurrencies[0] : primaryCurrency;
    const effectiveLocale = isSingleForeign ? (effectiveDisplayCurrency === "USD" ? "en-US" : locale) : locale;

    return NextResponse.json({
      success: true,
      metrics: {
        todayRevenue: {
          grossMinor: analytics.todayRevenue.grossMinor,
          refundsMinor: analytics.todayRevenue.refundsMinor,
          netMinor: analytics.todayRevenue.netMinor,
          formattedGross: formatCurrencyMinor(analytics.todayRevenue.grossMinor, effectiveDisplayCurrency, effectiveLocale),
          formattedRefunds: formatCurrencyMinor(analytics.todayRevenue.refundsMinor, effectiveDisplayCurrency, effectiveLocale),
          formattedNet: formatCurrencyMinor(analytics.todayRevenue.netMinor, effectiveDisplayCurrency, effectiveLocale),
          currency: effectiveDisplayCurrency,
        },
        monthlyRevenue: {
          grossMinor: analytics.monthlyRevenue.grossMinor,
          refundsMinor: analytics.monthlyRevenue.refundsMinor,
          netMinor: analytics.monthlyRevenue.netMinor,
          formattedGross: formatCurrencyMinor(analytics.monthlyRevenue.grossMinor, effectiveDisplayCurrency, effectiveLocale),
          formattedRefunds: formatCurrencyMinor(analytics.monthlyRevenue.refundsMinor, effectiveDisplayCurrency, effectiveLocale),
          formattedNet: formatCurrencyMinor(analytics.monthlyRevenue.netMinor, effectiveDisplayCurrency, effectiveLocale),
          currency: effectiveDisplayCurrency,
        },
        successfulPayments: analytics.successfulPayments,
        failedPayments: analytics.failedPayments,
        pendingPayments: analytics.pendingPayments,
        successfulPaymentsMetrics: {
          count: analytics.successfulPayments,
          amountMinor: analytics.successfulGrossMinor || 0,
          formattedGross: formatCurrencyMinor(analytics.successfulGrossMinor || 0, effectiveDisplayCurrency, effectiveLocale),
        },
        failedPaymentsMetrics: {
          count: analytics.failedPayments,
          amountMinor: analytics.failedGrossMinor || 0,
          formattedGross: formatCurrencyMinor(analytics.failedGrossMinor || 0, effectiveDisplayCurrency, effectiveLocale),
        },
        pendingPaymentsMetrics: {
          count: analytics.pendingPayments,
          amountMinor: analytics.pendingGrossMinor || 0,
          formattedGross: formatCurrencyMinor(analytics.pendingGrossMinor || 0, effectiveDisplayCurrency, effectiveLocale),
        },
        totalPaymentsMetrics: {
          count: (analytics.successfulPayments || 0) + (analytics.failedPayments || 0) + (analytics.pendingPayments || 0),
          amountMinor: analytics.totalGrossMinor || 0,
          formattedGross: formatCurrencyMinor(analytics.totalGrossMinor || 0, effectiveDisplayCurrency, effectiveLocale),
        },
        refundCount: analytics.refundCount,
        successRate: analytics.successRate,
        failureRate: analytics.failureRate ?? 0,
        currency: primaryCurrency,
        currencySymbol,
        storeCurrency: primaryCurrency,
        storeCurrencyInfo: {
          code: storeCurrencyInfo.code,
          symbol: storeCurrencyInfo.symbol,
          locale: storeCurrencyInfo.locale,
          countryCode: storeCurrencyInfo.countryCode,
        },
        currencies: analytics.currencies,
        paymentTrends: analytics.paymentTrends,
      },
      storeCurrency: primaryCurrency,
      storeCurrencyInfo,
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
      store: {
        id: storeContext.orgId,
        name: storeContext.storeName,
        slug: storeContext.slug,
        country: storeContext.storeCountry,
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
