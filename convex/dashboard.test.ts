/// <reference types="vite/client" />
import { describe, expect, test, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { WIDGET_CATALOG, DEFAULT_DASHBOARD_TEMPLATES } from "./dashboardCatalog";
import { WIDGET_CATEGORIES, resolveStoreCurrency, computePercentageDelta, formatCurrencyPaise } from "./dashboardTypes";

const modules = import.meta.glob("./**/*.*s");

describe("Modular Widget-Driven Dashboard Backend Suite", () => {
  // Helper to setup store with Admin and Staff member
  async function setupStoreWithUsers() {
    const t = convexTest(schema, modules);

    const adminClerkId = "user_admin_dash_1";
    const staffClerkId = "user_staff_dash_2";
    const otherUserClerkId = "user_staff_dash_3";

    const orgId = await t.mutation(api.organizations.create, {
      name: "Spice Garden Bistro",
      ownerClerkId: adminClerkId,
      isDelivery: true,
      deliveryCashOnDelivery: true,
      defaultCurrency: "INR",
      defaultCurrencySymbol: "₹",
      organizationTimeZone: "Asia/Kolkata",
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });
    const asStaff = t.withIdentity({ subject: staffClerkId });
    const asOtherUser = t.withIdentity({ subject: otherUserClerkId });

    // Seed Staff in organizationUsers
    await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: staffClerkId,
      userType: ["cashier"],
    });

    // Seed Other Staff in organizationUsers
    await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: otherUserClerkId,
      userType: ["captain"],
    });

    // Initialize default templates and store defaults
    await asAdmin.mutation(api.dashboards.initializeDefaultTemplates, {
      organizationId: orgId,
    });

    return { t, orgId, adminClerkId, staffClerkId, otherUserClerkId, asAdmin, asStaff, asOtherUser };
  }

  // ==========================================
  // 1. CATALOG COMPLETENESS & STABILITY TESTS
  // ==========================================
  describe("1. Widget Catalog Integrity & Metadata", () => {
    test("All widgets have unique stable IDs, valid categories, and supported sizes", () => {
      const widgetIds = new Set<string>();

      expect(WIDGET_CATALOG.length).toBeGreaterThanOrEqual(70);

      for (const w of WIDGET_CATALOG) {
        expect(w.widgetId).toBeDefined();
        expect(widgetIds.has(w.widgetId)).toBe(false);
        widgetIds.add(w.widgetId);

        expect(WIDGET_CATEGORIES).toContain(w.category);
        expect(w.name.trim().length).toBeGreaterThan(0);
        expect(w.description.trim().length).toBeGreaterThan(0);
        expect(w.dataProviderKey.startsWith("provider_")).toBe(true);
        expect(w.supportedSizes.length).toBeGreaterThan(0);
        expect(w.defaultDimensions.width).toBeGreaterThanOrEqual(1);
        expect(w.defaultDimensions.width).toBeLessThanOrEqual(12);
        expect(w.defaultDimensions.height).toBeGreaterThanOrEqual(1);
        expect(w.catalogVersion).toBeGreaterThanOrEqual(1);
      }
    });

    test("Every required category has widgets defined", () => {
      for (const cat of WIDGET_CATEGORIES) {
        const inCat = WIDGET_CATALOG.filter((w) => w.category === cat);
        expect(inCat.length).toBeGreaterThan(0);
      }
    });

    test("Default dashboard templates have unique keys and valid widget references", () => {
      const templateKeys = new Set<string>();

      expect(DEFAULT_DASHBOARD_TEMPLATES.length).toBeGreaterThanOrEqual(4);

      for (const tpl of DEFAULT_DASHBOARD_TEMPLATES) {
        expect(templateKeys.has(tpl.templateKey)).toBe(false);
        templateKeys.add(tpl.templateKey);

        expect(tpl.placements.length).toBeGreaterThan(0);
        for (const p of tpl.placements) {
          const widgetDef = WIDGET_CATALOG.find((w) => w.widgetId === p.widgetId);
          expect(widgetDef).toBeDefined();
          expect(p.gridCol + p.width).toBeLessThanOrEqual(12);
        }
      }
    });
  });

  // ==========================================
  // 2. WIDGET CATALOG BROWSING & COUNTS
  // ==========================================
  describe("2. Catalog Queries, Filtering, and Category Counts", () => {
    test("Staff can list widgets with category filter and search keyword", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      // List all
      const allWidgets = await asStaff.query(api.dashboards.listAvailableWidgets, {
        organizationId: orgId,
      });
      expect(allWidgets.length).toBe(WIDGET_CATALOG.length);

      // Filter by category
      const cashierWidgets = await asStaff.query(api.dashboards.listAvailableWidgets, {
        organizationId: orgId,
        category: "Cashier",
      });
      expect(cashierWidgets.length).toBeGreaterThanOrEqual(7);
      expect(cashierWidgets.every((w) => w.category === "Cashier")).toBe(true);

      // Search query
      const searchResults = await asStaff.query(api.dashboards.listAvailableWidgets, {
        organizationId: orgId,
        searchQuery: "revenue",
      });
      expect(searchResults.length).toBeGreaterThan(0);
      expect(
        searchResults.some((w) => w.name.toLowerCase().includes("revenue"))
      ).toBe(true);
    }, 20000);

    test("getCatalogWithUserState computes accurate counts and added status", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const res = await asStaff.query(api.dashboards.getCatalogWithUserState, {
        organizationId: orgId,
      });

      expect(res.summary.totalWidgets).toBe(WIDGET_CATALOG.length);
      expect(res.summary.availableWidgets).toBeGreaterThan(0);
      expect(res.categoryCounts["Overview"].total).toBeGreaterThan(0);
      expect(res.categoryCounts["Cashier"].total).toBeGreaterThan(0);
      expect(res.summary.activeDashboardId).toBeDefined();
    });
  });

  // ==========================================
  // 3. DASHBOARD PLACEMENT OPERATIONS
  // ==========================================
  describe("3. Widget Placement CRUD & Grid Constraints", () => {
    test("User can add, configure, resize, and remove a widget placement", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const dashRes = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
      });
      const dashId = dashRes.dashboard!._id;

      // Add a widget
      const addRes = await asStaff.mutation(api.dashboards.addWidgetPlacement, {
        organizationId: orgId,
        dashboardId: dashId,
        widgetId: "menu_most_ordered_categories",
        gridCol: 0,
        gridRow: 8,
        width: 6,
        height: 2,
        configuration: { showPercentages: true },
      });
      expect(addRes.success).toBe(true);
      expect(addRes.placementId).toBeDefined();

      // Verify placement added
      const updatedDash = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
        dashboardId: dashId,
      });
      const placed = updatedDash.placements.find(
        (p) => p.widgetId === "menu_most_ordered_categories"
      );
      expect(placed).toBeDefined();
      expect(placed?.configuration?.showPercentages).toBe(true);

      // Update configuration
      const configRes = await asStaff.mutation(api.dashboards.updatePlacementConfig, {
        placementId: addRes.placementId,
        configuration: { showPercentages: false, maxCategories: 5 },
      });
      expect(configRes.success).toBe(true);

      // Batch update (move / resize)
      const batchRes = await asStaff.mutation(api.dashboards.batchUpdatePlacements, {
        dashboardId: dashId,
        placements: [
          {
            placementId: addRes.placementId,
            gridRow: 10,
            gridCol: 2,
            width: 4,
            height: 2,
            displayOrder: 99,
            isEnabled: true,
          },
        ],
      });
      expect(batchRes.success).toBe(true);

      // Remove placement
      const removeRes = await asStaff.mutation(api.dashboards.removeWidgetPlacement, {
        placementId: addRes.placementId,
      });
      expect(removeRes.success).toBe(true);
    });

    test("Prevent duplicate placements for unique widgets", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const dashRes = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
      });
      const dashId = dashRes.dashboard!._id;

      // Add unique widget
      await asStaff.mutation(api.dashboards.addWidgetPlacement, {
        organizationId: orgId,
        dashboardId: dashId,
        widgetId: "overview_business_summary",
        gridCol: 0,
        width: 6,
        height: 2,
      });

      // Attempt adding duplicate
      await expect(
        asStaff.mutation(api.dashboards.addWidgetPlacement, {
          organizationId: orgId,
          dashboardId: dashId,
          widgetId: "overview_business_summary",
          gridCol: 6,
          width: 6,
          height: 2,
        })
      ).rejects.toThrow("already added to this dashboard");
    });

    test("Reject placement exceeding 12-column grid boundary", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const dashRes = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
      });
      const dashId = dashRes.dashboard!._id;

      // gridCol 8 + width 6 = 14 > 12 -> throws
      await expect(
        asStaff.mutation(api.dashboards.addWidgetPlacement, {
          organizationId: orgId,
          dashboardId: dashId,
          widgetId: "overview_total_orders",
          gridCol: 8,
          width: 6,
          height: 1,
        })
      ).rejects.toThrow("exceeds 12-column grid boundary");
    });
  });

  // ==========================================
  // 4. DRAFT WORKFLOW & CONFLICT RESOLUTION
  // ==========================================
  describe("4. Draft Staging, Application, Discard, and Revision Checks", () => {
    test("Create, retrieve, apply, and discard draft atomically", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const dashRes = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
      });
      const dashId = dashRes.dashboard!._id;
      const initialRev = dashRes.dashboard!.revision;

      // Create draft
      const draftRes = await asStaff.mutation(api.dashboards.createOrUpdateDraft, {
        dashboardId: dashId,
        baseRevision: initialRev,
        placements: [
          {
            widgetId: "overview_net_revenue",
            gridRow: 0,
            gridCol: 0,
            width: 8,
            height: 2,
            displayOrder: 1,
            isEnabled: true,
          },
          {
            widgetId: "orders_live_feed",
            gridRow: 0,
            gridCol: 8,
            width: 4,
            height: 2,
            displayOrder: 2,
            isEnabled: true,
          },
        ],
      });
      expect(draftRes.success).toBe(true);

      // Query draft
      const activeDraft = await asStaff.query(api.dashboards.getDraft, {
        dashboardId: dashId,
      });
      expect(activeDraft).not.toBeNull();
      expect(activeDraft?.placements.length).toBe(2);

      // Apply draft
      const applyRes = await asStaff.mutation(api.dashboards.applyDraft, {
        dashboardId: dashId,
      });
      expect(applyRes.success).toBe(true);
      expect(applyRes.newRevision).toBe(initialRev + 1);

      // Verify draft deleted and placements applied
      const postApplyDash = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
        dashboardId: dashId,
      });
      expect(postApplyDash.hasUnsavedDraft).toBe(false);
      expect(postApplyDash.placements.length).toBe(2);
      expect(postApplyDash.dashboard!.revision).toBe(initialRev + 1);
    });

    test("Revision conflict prevents stale draft from applying", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const dashRes = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
      });
      const dashId = dashRes.dashboard!._id;
      const initialRev = dashRes.dashboard!.revision;

      // Create draft based on initialRev
      await asStaff.mutation(api.dashboards.createOrUpdateDraft, {
        dashboardId: dashId,
        baseRevision: initialRev,
        placements: [
          {
            widgetId: "overview_net_revenue",
            gridRow: 0,
            gridCol: 0,
            width: 6,
            height: 1,
            displayOrder: 1,
            isEnabled: true,
          },
        ],
      });

      // Concurrently add a widget directly to published dashboard, bumping revision
      await asStaff.mutation(api.dashboards.addWidgetPlacement, {
        organizationId: orgId,
        dashboardId: dashId,
        widgetId: "menu_top_selling",
        gridCol: 0,
        width: 6,
        height: 2,
      });

      // Attempting to apply stale draft throws conflict
      await expect(
        asStaff.mutation(api.dashboards.applyDraft, {
          dashboardId: dashId,
        })
      ).rejects.toThrow("Stale draft detected");

      // Discard draft cleanly
      const discardRes = await asStaff.mutation(api.dashboards.discardDraft, {
        dashboardId: dashId,
      });
      expect(discardRes.success).toBe(true);
    });
  });

  // ==========================================
  // 5. TEMPLATE PRESETS & RESET DEFAULTS
  // ==========================================
  describe("5. Templates Application, Resets, and Admin Permissions", () => {
    test("User can apply a named template and reset to defaults", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const dashRes = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
      });
      const dashId = dashRes.dashboard!._id;

      // Apply Late Night Bar & Lounge template
      const applyTpl = await asStaff.mutation(api.dashboards.applyTemplate, {
        organizationId: orgId,
        dashboardId: dashId,
        templateKey: "late_night_bar_lounge",
      });
      expect(applyTpl.success).toBe(true);
      expect(applyTpl.appliedTemplateKey).toBe("late_night_bar_lounge");

      const afterTpl = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
        dashboardId: dashId,
      });
      expect(afterTpl.dashboard!.templateKey).toBe("late_night_bar_lounge");
      expect(afterTpl.placements.some((p) => p.widgetId === "kds_live_orders")).toBe(true);

      // Reset to defaults
      const resetRes = await asStaff.mutation(api.dashboards.resetToDefaults, {
        dashboardId: dashId,
      });
      expect(resetRes.success).toBe(true);

      const afterReset = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
        dashboardId: dashId,
      });
      expect(afterReset.dashboard!.templateKey).toBe("executive_dinner_peak");
    });

    test("Only Admin can save as global template", async () => {
      const { asStaff, asAdmin, orgId } = await setupStoreWithUsers();

      const dashRes = await asStaff.query(api.dashboards.getDashboard, {
        organizationId: orgId,
      });
      const dashId = dashRes.dashboard!._id;

      // Non-admin rejected
      await expect(
        asStaff.mutation(api.dashboards.saveAsTemplate, {
          organizationId: orgId,
          dashboardId: dashId,
          name: "My Custom Template",
          templateKey: "custom_tpl_1",
        })
      ).rejects.toThrow("Forbidden");

      // Admin permitted
      const adminRes = await asAdmin.mutation(api.dashboards.saveAsTemplate, {
        organizationId: orgId,
        dashboardId: dashId,
        name: "My Custom Template",
        templateKey: "custom_tpl_1",
      });
      expect(adminRes.success).toBe(true);
      expect(adminRes.templateId).toBeDefined();
    });
  });

  // ==========================================
  // 6. MULTI-USER ISOLATION & PERMISSIONS
  // ==========================================
  describe("6. Cross-User Privacy & Unauthenticated Protection", () => {
    test("User A cannot read or modify User B's private dashboard", async () => {
      const { asStaff, asOtherUser, orgId } = await setupStoreWithUsers();

      // User A (Staff) creates a private user-scoped dashboard
      const dashACreate = await asStaff.mutation(api.dashboards.createDashboard, {
        organizationId: orgId,
        name: "User A Private Cockpit",
        scope: "user",
      });
      const dashAId = dashACreate.dashboardId;

      // User B (OtherUser) tries to access User A's private dashboard
      await expect(
        asOtherUser.query(api.dashboards.getDashboard, {
          organizationId: orgId,
          dashboardId: dashAId,
        })
      ).rejects.toThrow("Forbidden");

      // User B tries to add widget to User A's dashboard
      await expect(
        asOtherUser.mutation(api.dashboards.addWidgetPlacement, {
          organizationId: orgId,
          dashboardId: dashAId,
          widgetId: "overview_total_orders",
          gridCol: 0,
          width: 4,
          height: 1,
        })
      ).rejects.toThrow("Forbidden");
    });

    test("Unauthenticated requests are strictly rejected", async () => {
      const { t, orgId } = await setupStoreWithUsers();

      await expect(
        t.query(api.dashboards.listAvailableWidgets, { organizationId: orgId })
      ).rejects.toThrow("Unauthenticated");

      await expect(
        t.query(api.dashboards.getDashboard, { organizationId: orgId })
      ).rejects.toThrow("Unauthenticated");
    });
  });

  // ==========================================
  // 7. REAL OPERATIONAL DATA PROVIDERS
  // ==========================================
  describe("7. Real Metric Calculations, Boundaries & Unavailable Gaps", () => {
    test("Overview Net Revenue and Total Orders compute accurately from real orders", async () => {
      const { t, asStaff, orgId } = await setupStoreWithUsers();

      const now = Date.now();

      // Seed 2 Paid Orders and 1 Pending Order in store database
      await t.run(async (ctx) => {
        await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "ORD-901",
          tokenNumber: "01",
          orderType: "DineIn",
          orderSource: "POS-Cashier",
          orderStatusName: "Completed",
          subTotal: 100000,
          taxTotal: 5000,
          totalAmount: 105000, // ₹1,050.00
          paymentMode: "UPI",
          paymentStatus: "Paid",
          isCompleted: true,
          isRejected: false,
          isModify: false,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "ORD-902",
          tokenNumber: "02",
          orderType: "TakeAway",
          orderSource: "POS-Cashier",
          orderStatusName: "Completed",
          subTotal: 200000,
          taxTotal: 10000,
          totalAmount: 210000, // ₹2,100.00
          paymentMode: "Cash",
          paymentStatus: "Paid",
          isCompleted: true,
          isRejected: false,
          isModify: false,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "ORD-903",
          tokenNumber: "03",
          orderType: "Delivery",
          orderSource: "OnlineStore",
          orderStatusName: "Pending",
          subTotal: 50000,
          taxTotal: 2500,
          totalAmount: 52500, // ₹525.00
          paymentMode: "UPI",
          paymentStatus: "Pending",
          isCompleted: false,
          isRejected: false,
          isModify: false,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Query Net Revenue KPI
      const revenueData = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "overview_net_revenue",
        organizationId: orgId,
        dateRangePreset: "today",
      });

      expect(revenueData.isAvailable).toBe(true);
      expect(revenueData.currencySymbol).toBe("₹");
      expect(revenueData.kpi).toBeDefined();
      // Total Paid: 105000 + 210000 = 315000 paise (₹3,150.00)
      expect(revenueData.kpi?.value).toBe(315000);
      expect(revenueData.kpi?.displayValue).toContain("3,150.00");

      // Query Total Orders KPI
      const ordersData = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "overview_total_orders",
        organizationId: orgId,
        dateRangePreset: "today",
      });

      expect(ordersData.kpi?.value).toBe(3);
      expect(ordersData.kpi?.secondaryMetrics?.find((m) => m.label === "Dine-In")?.value).toBe(1);
      expect(ordersData.kpi?.secondaryMetrics?.find((m) => m.label === "Takeaway")?.value).toBe(1);
    });

    test("Cashier Tender Breakdown distinguishes Cash and Digital Payments", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const tenderData = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "cashier_payment_breakdown",
        organizationId: orgId,
        dateRangePreset: "today",
      });

      expect(tenderData.isAvailable).toBe(true);
      expect(tenderData.chart?.chartType).toBe("donut");
      expect(tenderData.chart?.series[0].data.length).toBe(3); // UPI, Cards, Cash
    });

    test("Unsupported IoT widgets gracefully return isAvailable: false with reason", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const iotColdStorage = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "iot_cold_storage",
        organizationId: orgId,
      });

      expect(iotColdStorage.isAvailable).toBe(false);
      expect(iotColdStorage.unavailableReason).toContain("cold storage");
      expect(iotColdStorage.unavailableReason).toContain("telemetry");

      const iotBeverage = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "iot_beverage_pour_rate",
        organizationId: orgId,
      });

      expect(iotBeverage.isAvailable).toBe(false);
      expect(iotBeverage.unavailableReason).toContain("dispenser");
    });

    test("Station Queue validates store ownership and rejects cross-store station IDs", async () => {
      const { t, asStaff, orgId } = await setupStoreWithUsers();

      // Create another store with its own owner
      const otherAdminClerkId = "other_admin_station_1";
      const otherOrgId = await t.mutation(api.organizations.create, {
        name: "Other Store",
        ownerClerkId: otherAdminClerkId,
      });

      const asOtherAdmin = t.withIdentity({ subject: otherAdminClerkId });

      // Create station belonging to other store
      const otherStation = await asOtherAdmin.mutation(api.stations.create, {
        organizationId: otherOrgId,
        name: "Foreign Station",
        isMain: false,
      });

      // Query station queue with foreign stationId throws ownership error
      await expect(
        asStaff.query(api.dashboards.getWidgetData, {
          widgetId: "kds_station_queue",
          organizationId: orgId,
          stationId: otherStation.id,
        })
      ).rejects.toThrow("Invalid station reference");
    });
  });

  // ==========================================
  // 8. IDEMPOTENT INITIALIZATION
  // ==========================================
  describe("8. Idempotent Provisioning & Migration", () => {
    test("initializeDefaultTemplates can run repeatedly without creating duplicates", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const run1 = await asAdmin.mutation(api.dashboards.initializeDefaultTemplates, {
        organizationId: orgId,
      });
      expect(run1.success).toBe(true);
      expect(run1.seededTemplatesCount).toBeGreaterThanOrEqual(4);

      // Re-running initialization must be idempotent (0 duplicates)
      const run2 = await asAdmin.mutation(api.dashboards.initializeDefaultTemplates, {
        organizationId: orgId,
      });
      expect(run2.success).toBe(true);
      expect(run2.seededTemplatesCount).toBe(0);
    });
  });

  // ==========================================
  // 9. WORKSTATION CAPABILITIES & TELEMETRY
  // ==========================================
  describe("9. Workstation Capabilities & Hardware Telemetry", () => {
    test("Workstation is a first-class category with all 8 core widgets available", () => {
      expect(WIDGET_CATEGORIES).toContain("Workstation");
      const wsWidgets = WIDGET_CATALOG.filter((w) => w.category === "Workstation");
      expect(wsWidgets.length).toBeGreaterThanOrEqual(8);

      const expectedIds = [
        "workstation_order_summary",
        "workstation_orders_by_workstation",
        "workstation_active_tasks",
        "workstation_queue",
        "workstation_prep_time",
        "workstation_delayed_orders",
        "workstation_performance",
        "workstation_availability",
      ];

      for (const id of expectedIds) {
        const found = wsWidgets.find((w) => w.widgetId === id);
        expect(found, `Expected widget ${id} to exist in Workstation category`).toBeDefined();
        expect(found?.isEnabled).toBe(true);
      }
    });

    test("Workstation order summary and active tasks compute from real order items", async () => {
      const { t, asAdmin, asStaff, orgId } = await setupStoreWithUsers();
      const now = Date.now();

      let orderId: any;
      await t.run(async (ctx) => {
        // Create station
        const stationId = await ctx.db.insert("stations", {
          organizationId: orgId,
          name: "Grill Station",
          isMain: false,
          createdAt: now,
        });

        const itemId = await ctx.db.insert("items", {
          organizationId: orgId,
          name: "Paneer Tikka",
          price: 35000,
          published: true,
          isAvailable: true,
          isGst: true,
          isVeg: true,
          isSpicy: false,
          showQuantity: false,
          markAsBestseller: true,
          showCalorie: false,
          createdAt: now,
          updatedAt: now,
        });

        orderId = await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "WS-101",
          tokenNumber: "T-01",
          orderSource: "POS-Cashier",
          orderType: "DineIn",
          orderStatusName: "Preparing",
          subTotal: 35000,
          taxTotal: 1750,
          totalAmount: 36750,
          paymentMode: "Cash",
          paymentStatus: "Paid",
          isCompleted: false,
          isRejected: false,
          isModify: false,
          createdAt: now - 20 * 60 * 1000, // 20 mins ago (delayed)
          updatedAt: now,
        });

        // Insert unready order item
        await ctx.db.insert("orderItems", {
          organizationId: orgId,
          orderId,
          itemId,
          itemName: "Paneer Tikka",
          itemPrice: 35000,
          quantity: 2,
          totalPrice: 70000,
          isReady: false,
          stationId,
          createdAt: now - 20 * 60 * 1000,
        });

        // Insert CFD terminal
        await ctx.db.insert("customerFrontDisplays", {
          organizationId: orgId,
          name: "Counter Display 1",
          workstationName: "Main Cashier",
          connectionType: "network",
          ipAddress: "192.168.1.120",
          status: "active",
          latencyMs: 14,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // 1. Order Summary
      const summary = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "workstation_order_summary",
        organizationId: orgId,
      });
      expect(summary.isAvailable).toBe(true);
      expect(summary.kpi?.value).toBe(1);

      // 2. Active Tasks
      const tasks = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "workstation_active_tasks",
        organizationId: orgId,
      });
      expect(tasks.isAvailable).toBe(true);
      expect(tasks.table?.rows.length).toBe(1);
      expect(tasks.table?.rows[0].itemName).toBe("Paneer Tikka");
      expect(tasks.table?.rows[0].station).toBe("Grill Station");

      // 3. Delayed Orders Alert
      const delayed = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "workstation_delayed_orders",
        organizationId: orgId,
      });
      expect(delayed.isAvailable).toBe(true);
      expect(delayed.alert?.count).toBe(1);

      // 4. Terminal Health
      const health = await asAdmin.query(api.dashboards.getWidgetData, {
        widgetId: "workstation_terminal_health",
        organizationId: orgId,
      });
      expect(health.isAvailable).toBe(true);
      expect(health.table?.rows.some((r) => r.name === "Counter Display 1")).toBe(true);
    });
  });

  // ==========================================
  // 10. FINANCIAL CORRECTNESS & MULTI-TENDER
  // ==========================================
  describe("10. Financial Correctness with Multi-Tenders & Refunds", () => {
    test("Split bill with Cash and UPI records exact tender sums and transaction counts", async () => {
      const { t, asAdmin, asStaff, orgId } = await setupStoreWithUsers();
      const now = Date.now();

      await t.run(async (ctx) => {
        const orderId = await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "SPLIT-500",
          tokenNumber: "S-50",
          orderType: "DineIn",
          orderSource: "POS-Cashier",
          orderStatusName: "Completed",
          subTotal: 100000, // ₹1,000.00
          taxTotal: 5000,
          discountAmount: 10000, // ₹100.00 discount
          totalAmount: 95000, // ₹950.00 net total
          paymentMode: "Split",
          paymentStatus: "Paid",
          isCompleted: true,
          isRejected: false,
          isModify: false,
          createdAt: now,
          updatedAt: now,
        });

        // 2 Split tenders in orderPayments: ₹500.00 Cash + ₹450.00 UPI
        await ctx.db.insert("orderPayments", {
          organizationId: orgId,
          orderId,
          paymentModeName: "Cash",
          paymentType: "Credit",
          amount: 50000,
          payAmount: 50000,
          createdAt: now,
        });

        await ctx.db.insert("orderPayments", {
          organizationId: orgId,
          orderId,
          paymentModeName: "UPI",
          paymentType: "Credit",
          amount: 45000,
          payAmount: 45000,
          transactionReference: "UPI-TXN-9988",
          createdAt: now,
        });

        // 1 Refund transaction for another order
        const refundOrderId = await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "REF-301",
          tokenNumber: "R-30",
          orderType: "TakeAway",
          orderSource: "POS-Cashier",
          orderStatusName: "Cancelled",
          subTotal: 20000,
          taxTotal: 1000,
          totalAmount: 21000,
          paymentMode: "Cash",
          paymentStatus: "Refunded",
          isCompleted: false,
          isRejected: true,
          isModify: false,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("orderPayments", {
          organizationId: orgId,
          orderId: refundOrderId,
          paymentModeName: "Cash",
          paymentType: "Debit",
          amount: 21000,
          refundAmount: 21000,
          createdAt: now,
        });
      });

      // 1. Shift Summary
      const shift = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "cashier_shift_summary",
        organizationId: orgId,
      });
      expect(shift.isAvailable).toBe(true);
      expect(shift.kpi?.secondaryMetrics?.find((m) => m.label === "Cash Collected")?.value).toContain("500.00");
      expect(shift.kpi?.secondaryMetrics?.find((m) => m.label === "Digital Settlements")?.value).toContain("450.00");
      expect(shift.kpi?.secondaryMetrics?.find((m) => m.label === "Refunds / Voids")?.value).toContain("210.00");

      // 2. Split Bills Tracker
      const splitBills = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "cashier_split_bill_tracker",
        organizationId: orgId,
      });
      expect(splitBills.isAvailable).toBe(true);
      expect(splitBills.kpi?.value).toBe(1);

      // 3. Refund Summary
      const refunds = await asAdmin.query(api.dashboards.getWidgetData, {
        widgetId: "cashier_refund_summary",
        organizationId: orgId,
      });
      expect(refunds.isAvailable).toBe(true);
      expect(refunds.kpi?.value).toBe(21000);
    });
  });

  // ==========================================
  // 11. CUSTOMER RETENTION & SURVEY INTEGRITY
  // ==========================================
  describe("11. Customer Retention & Survey Analytics Without Mocks", () => {
    test("Customer retention accurately calculates repeat visit percentage", async () => {
      const { t, asStaff, orgId } = await setupStoreWithUsers();
      const now = Date.now();

      await t.run(async (ctx) => {
        // Customer 1: 2 Orders (Repeat patron)
        // Customer 2: 1 Order (Single visit)
        const c1Id = await ctx.db.insert("customers", {
          firstName: "Aarav",
          lastName: "Sharma",
          phone: "9876543210",
          createdAt: now,
          updatedAt: now,
        });

        const c2Id = await ctx.db.insert("customers", {
          firstName: "Priya",
          lastName: "Patel",
          phone: "9876543211",
          createdAt: now,
          updatedAt: now,
        });

        // Orders for C1
        await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "ORD-C1-1",
          tokenNumber: "01",
          orderType: "DineIn",
          orderSource: "POS-Cashier",
          orderStatusName: "Completed",
          isRejected: false,
          isModify: false,
          customerId: c1Id,
          subTotal: 50000,
          taxTotal: 2500,
          totalAmount: 52500,
          paymentMode: "UPI",
          paymentStatus: "Paid",
          isCompleted: true,
          createdAt: now - 3600000,
          updatedAt: now - 3600000,
        });

        await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "ORD-C1-2",
          tokenNumber: "02",
          orderType: "DineIn",
          orderSource: "POS-Cashier",
          orderStatusName: "Completed",
          isRejected: false,
          isModify: false,
          customerId: c1Id,
          subTotal: 70000,
          taxTotal: 3500,
          totalAmount: 73500,
          paymentMode: "UPI",
          paymentStatus: "Paid",
          isCompleted: true,
          createdAt: now,
          updatedAt: now,
        });

        // Order for C2
        await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "ORD-C2-1",
          tokenNumber: "03",
          orderType: "TakeAway",
          orderSource: "POS-Cashier",
          orderStatusName: "Completed",
          isRejected: false,
          isModify: false,
          customerId: c2Id,
          subTotal: 30000,
          taxTotal: 1500,
          totalAmount: 31500,
          paymentMode: "Cash",
          paymentStatus: "Paid",
          isCompleted: true,
          createdAt: now,
          updatedAt: now,
        });
      });

      const ret = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "customers_returning",
        organizationId: orgId,
      });

      expect(ret.isAvailable).toBe(true);
      // 1 repeat out of 2 customers = 50%
      expect(ret.kpi?.value).toBe(50);
      expect(ret.kpi?.secondaryMetrics?.find((m) => m.label === "Repeat Patrons")?.value).toBe(1);

      // Verify customers_total
      const tot = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "customers_total",
        organizationId: orgId,
      });
      expect(tot.kpi?.value).toBe(2);

      // Verify customers_new
      const newCust = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "customers_new",
        organizationId: orgId,
      });
      expect(newCust.kpi?.value).toBe(2);

      // Verify customers_recent has NO "Dining Guest" tier
      const rec = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "customers_recent",
        organizationId: orgId,
      });
      for (const g of rec.summary?.recentGuests || []) {
        expect(g.tier).toBeUndefined();
      }

      // Verify customers_most_frequent groups properly and has NO VIP tier labels
      const freq = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "customers_most_frequent",
        organizationId: orgId,
      });
      expect(freq.summary?.topGuests?.[0]?.visits).toBe("2 orders");
      for (const g of freq.summary?.topGuests || []) {
        expect(g.tier).toBeUndefined();
      }

      // Verify customers_order_frequency has clean cohort labels
      const ordFreq = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "customers_order_frequency",
        organizationId: orgId,
      });
      expect(ordFreq.summary?.cohorts?.map((c: any) => c.label)).toEqual([
        "1 Visit",
        "2 - 3 Visits",
        "4+ Visits",
      ]);
    });

    test("Surveys provide truthful empty state when no responses exist and accurate score when logged", async () => {
      const { t, asStaff, orgId } = await setupStoreWithUsers();
      const now = Date.now();

      // 1. Empty state verification (must NOT return fake 4.8 / 94%)
      const emptySurveys = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "surveys_average_rating",
        organizationId: orgId,
      });
      expect(emptySurveys.isAvailable).toBe(true);
      expect(emptySurveys.kpi?.value).toBe(0);
      expect(emptySurveys.kpi?.displayValue).toBe("No ratings yet");

      // 2. Seed 2 survey answers: 5 and 3 (Average: 4.0)
      await t.run(async (ctx) => {
        const surveyId = await ctx.db.insert("surveys", {
          name: "Guest Feedback",
          active: true,
          createdAt: now,
          updatedAt: now,
        });

        const qId = await ctx.db.insert("surveyQuestions", {
          surveyId,
          questionText: "How was the food?",
          type: "numeric",
          position: 1,
          createdAt: now,
          updatedAt: now,
        });

        const attId = await ctx.db.insert("surveyAttempts", {
          surveyId,
          published: true,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("surveyAnswers", {
          attemptId: attId,
          questionId: qId,
          numericValue: 5,
          answerText: "Outstanding mutton biryani!",
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("surveyAnswers", {
          attemptId: attId,
          questionId: qId,
          numericValue: 3,
          answerText: "Good but service pacing was slow.",
          createdAt: now,
          updatedAt: now,
        });
      });

      const filledSurveys = await asStaff.query(api.dashboards.getWidgetData, {
        widgetId: "surveys_average_rating",
        organizationId: orgId,
      });
      expect(filledSurveys.isAvailable).toBe(true);
      expect(filledSurveys.kpi?.value).toBe(4);
      expect(filledSurveys.kpi?.displayValue).toContain("4.0");
    });
  });

  // ==========================================
  // 12. CURRENCY & PERCENTAGE DELTA LOGIC
  // ==========================================
  describe("12. Currency Resolution & Percentage Growth Boundaries", () => {
    test("Store with US country config resolves USD and dollar symbol without hardcoded INR", () => {
      const usOrg = {
        name: "Chicago Smokehouse",
        country: "USA",
        currencyCode: "USD",
        currencySymbol: "$",
      } as any;

      const curr = resolveStoreCurrency(usOrg);
      expect(curr.currency).toBe("USD");
      expect(curr.currencySymbol).toBe("$");

      const formatted = formatCurrencyPaise(125050, curr.currencySymbol, curr.currency);
      expect(formatted).toBe("$ 1,250.50");
    });

    test("Growth exceeding 100% is mathematically preserved and not clamped", () => {
      // 500 orders today vs 100 baseline = +400%
      const delta = computePercentageDelta(500, 100);
      expect(delta.deltaPercent).toBe(400);
      expect(delta.deltaLabel).toContain("+400%");
      expect(delta.trend).toBe("up");

      // 0 baseline handled consistently
      const newDelta = computePercentageDelta(150, 0);
      expect(newDelta.deltaPercent).toBe(100);
      expect(newDelta.trend).toBe("up");
    });
  });

  // ==========================================
  // 13. GRID BOUNDARIES & CONFIGURATION SECURITY
  // ==========================================
  describe("13. Grid Boundaries & Configuration Validation", () => {
    test("Rejects negative grid coordinates and zero width dimensions", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      const dash = await asStaff.mutation(api.dashboards.createDashboard, {
        organizationId: orgId,
        name: "Staff Layout",
      });
      const dashId = dash.dashboardId;

      // Negative col
      await expect(
        asStaff.mutation(api.dashboards.addWidgetPlacement, {
          dashboardId: dashId,
          widgetId: "overview_average_order_value",
          gridCol: -1,
          width: 4,
          gridRow: 0,
          height: 1,
        })
      ).rejects.toThrow("gridCol must be between 0 and 11");

      // Zero width
      await expect(
        asStaff.mutation(api.dashboards.addWidgetPlacement, {
          dashboardId: dashId,
          widgetId: "overview_average_order_value",
          gridCol: 0,
          width: 0,
          gridRow: 0,
          height: 1,
        })
      ).rejects.toThrow("width must be between 1 and 12");
    });

    test("Rejects non-object configuration payload", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();
      const dash = await asStaff.mutation(api.dashboards.createDashboard, {
        organizationId: orgId,
        name: "Staff Layout 2",
      });
      const dashId = dash.dashboardId;

      await expect(
        asStaff.mutation(api.dashboards.addWidgetPlacement, {
          dashboardId: dashId,
          widgetId: "overview_average_order_value",
          gridCol: 0,
          width: 4,
          gridRow: 0,
          height: 1,
          configuration: "malicious_string_payload" as any,
        })
      ).rejects.toThrow("Widget configuration must be a JSON object");
    });
  });

  // ==========================================
  // 14. FINAL SIGN-OFF AUDIT: EXHAUSTIVE 97 WIDGETS & EDGE CASES
  // ==========================================
  describe("14. Final Sign-Off Audit: Programmatic Coverage & Financial Edge Cases", () => {
    test("All 97 catalog entries map to valid providers and return compliant payloads", async () => {
      const { asAdmin, orgId } = await setupStoreWithUsers();

      expect(WIDGET_CATALOG.length).toBe(97);

      // Verify category distribution
      const expectedCounts: Record<string, number> = {
        Overview: 10,
        Orders: 12,
        Workstation: 11,
        KDS: 12,
        Cashier: 9,
        Captain: 7,
        Queue: 6,
        Menu: 8,
        Customers: 6,
        Surveys: 6,
        Inventory: 6,
        Reports: 4,
      };

      const actualCounts: Record<string, number> = {};
      for (const cat of WIDGET_CATEGORIES) {
        actualCounts[cat] = 0;
      }

      for (const w of WIDGET_CATALOG) {
        actualCounts[w.category] = (actualCounts[w.category] || 0) + 1;

        // Query widget data as store Admin (has permission across all categories)
        const data = await asAdmin.query(api.dashboards.getWidgetData, {
          organizationId: orgId,
          widgetId: w.widgetId,
        });

        expect(data.widgetId).toBe(w.widgetId);
        expect(data.currency).toBeDefined();
        expect(data.currencySymbol).toBeDefined();
        expect(data.timeZone).toBeDefined();

        // Never hit unconfigured fallback
        expect(data.unavailableReason || "").not.toContain("not yet configured");

        if (data.isAvailable) {
          // At least one payload format must be present matching frontend requirements
          const hasPayload =
            data.kpi !== undefined ||
            data.chart !== undefined ||
            data.table !== undefined ||
            data.alert !== undefined ||
            data.summary !== undefined ||
            data.liveFeed !== undefined;
          expect(hasPayload).toBe(true);

          if (data.kpi) {
            expect(data.kpi.value).toBeDefined();
            expect(data.kpi.displayValue).toBeDefined();
            expect(data.kpi.label).toBeDefined();
          }
          if (data.chart) {
            expect(data.chart.type).toBeDefined();
            expect(Array.isArray(data.chart.series) || Array.isArray(data.chart.data)).toBe(true);
          }
          if (data.table) {
            expect(Array.isArray(data.table.columns)).toBe(true);
            expect(Array.isArray(data.table.rows)).toBe(true);
          }
        } else {
          // Documented hardware telemetry gaps
          expect([
            "inventory_cold_storage_temp",
            "inventory_beverage_pour_rate",
            "iot_cold_storage",
            "iot_beverage_pour_rate",
          ]).toContain(w.widgetId);
          expect(data.unavailableReason).toBeDefined();
        }
      }

      for (const [cat, count] of Object.entries(expectedCounts)) {
        expect(actualCounts[cat]).toBe(count);
      }
    });

    test("Enforces widget-level RBAC: Cashier staff cannot read Executive Reports", async () => {
      const { asStaff, orgId } = await setupStoreWithUsers();

      // Attempting to access admin-only executive summary
      await expect(
        asStaff.query(api.dashboards.getWidgetData, {
          organizationId: orgId,
          widgetId: "reports_operational_summary",
        })
      ).rejects.toThrow("Forbidden. Insufficient permissions for widget");
    });

    test("Financial edge case: Multi-tender reconciliation with partial payment and discounts", async () => {
      const { asAdmin, t, orgId } = await setupStoreWithUsers();
      const now = Date.now();

      await t.run(async (ctx) => {
        // 1. Fully paid order with discount & tax
        const order1 = await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "EDGE-101",
          tokenNumber: "T-101",
          orderSource: "POS-Cashier",
          orderType: "DineIn",
          orderStatusName: "Completed",
          subTotal: 50000, // 500.00
          discountAmount: 10000, // 100.00 discount
          taxTotal: 2000, // 20.00 tax
          totalAmount: 42000, // 420.00 final
          paymentMode: "Split",
          paymentStatus: "Paid",
          isCompleted: true,
          isRejected: false,
          isModify: false,
          createdAt: now - 3600000,
          updatedAt: now - 3600000,
        });

        // Split payments: 200 cash, 220 UPI
        await ctx.db.insert("orderPayments", {
          organizationId: orgId,
          orderId: order1,
          paymentModeName: "Cash",
          paymentType: "Credit",
          amount: 20000,
          payAmount: 20000,
          createdAt: now - 3600000,
        });

        await ctx.db.insert("orderPayments", {
          organizationId: orgId,
          orderId: order1,
          paymentModeName: "UPI",
          paymentType: "Credit",
          amount: 22000,
          payAmount: 22000,
          createdAt: now - 3600000,
        });

        // 2. Partially paid order
        await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "EDGE-102",
          tokenNumber: "T-102",
          orderSource: "POS-Cashier",
          orderType: "DineIn",
          orderStatusName: "Served",
          subTotal: 30000,
          discountAmount: 0,
          taxTotal: 1500,
          totalAmount: 31500,
          paymentMode: "Card",
          paymentStatus: "Pending",
          isCompleted: false,
          isRejected: false,
          isModify: false,
          createdAt: now - 1800000,
          updatedAt: now - 1800000,
        });
      });

      // Verify Reports Tender Reconciliation
      const recon = await asAdmin.query(api.dashboards.getWidgetData, {
        organizationId: orgId,
        widgetId: "reports_payment_reconciliation",
      });

      expect(recon.kpi).toBeDefined();
      expect(recon.kpi!.value).toBe(42000); // 20000 cash + 22000 UPI
      expect(recon.kpi!.secondaryMetrics).toBeDefined();
      const cashMetric = recon.kpi!.secondaryMetrics!.find((m: any) => m.label === "Cash Collected");
      const digitalMetric = recon.kpi!.secondaryMetrics!.find((m: any) => m.label === "Digital Settlements");
      expect(cashMetric).toBeDefined();
      expect(digitalMetric).toBeDefined();

      // Verify Cashier Tender Breakdown chart
      const tenderChart = await asAdmin.query(api.dashboards.getWidgetData, {
        organizationId: orgId,
        widgetId: "cashier_payment_breakdown",
      });
      expect(tenderChart.chart).toBeDefined();
      expect(tenderChart.chart!.series).toBeDefined();
    });

    test("Menu widgets: low-performing excludes top-sellers, out-of-stock ignores internal recipes, and margins are percentage", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      const menuId = await t.mutation(api.menu.createMenu, {
        organizationId: orgId,
        name: "Main Menu",
        isDefault: true,
      });

      // Create a category
      const catId = await t.mutation(api.menu.createCategory, {
        organizationId: orgId,
        menuId,
        name: "Starters",
      });

      const now = Date.now();
      let pizzaId: any, samosaId: any, biryaniId: any;

      const baseItem = {
        organizationId: orgId,
        updatedAt: now,
        isGst: true,
        isVeg: true,
        isSpicy: false,
        showItemType: false,
        showQuantity: false,
        showAllergenContents: false,
        showCalorie: false,
        markAsBestseller: false,
      };

      await t.run(async (ctx) => {
        pizzaId = await ctx.db.insert("items", {
          ...baseItem,
          name: "Pizza",
          price: 10000,
          published: true,
          isAvailable: true,
          createdAt: now,
        });

        samosaId = await ctx.db.insert("items", {
          ...baseItem,
          name: "Samosa",
          price: 8000,
          published: true,
          isAvailable: true,
          createdAt: now,
        });

        biryaniId = await ctx.db.insert("items", {
          ...baseItem,
          name: "Biryani",
          price: 12000,
          published: true,
          isAvailable: true,
          createdAt: now,
        });

        // Link to category via categoryItems
        await ctx.db.insert("categoryItems", {
          organizationId: orgId,
          categoryId: catId,
          itemId: pizzaId,
          position: 0,
          published: true,
          createdAt: now,
        });

        await ctx.db.insert("categoryItems", {
          organizationId: orgId,
          categoryId: catId,
          itemId: samosaId,
          position: 1,
          published: true,
          createdAt: now,
        });

        await ctx.db.insert("categoryItems", {
          organizationId: orgId,
          categoryId: catId,
          itemId: biryaniId,
          position: 2,
          published: true,
          createdAt: now,
        });

        // Create an internal recipe record in items table (not in categoryItems, unpublished)
        await ctx.db.insert("items", {
          ...baseItem,
          name: "Vadapav Recipe",
          price: 0,
          published: false,
          isAvailable: false,
          createdAt: now,
        });

        // Insert order with 2 Pizzas, 1 Samosa (Biryani has 0 orders)
        const orderId = await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "ORD-MENU-1",
          tokenNumber: "01",
          orderType: "DineIn",
          orderSource: "POS-Terminal",
          orderStatusName: "Completed",
          subTotal: 28000,
          taxTotal: 0,
          totalAmount: 28000,
          paymentMode: "Cash",
          paymentStatus: "Paid",
          isCompleted: true,
          isRejected: false,
          isModify: false,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("orderItems", {
          organizationId: orgId,
          orderId,
          itemId: pizzaId,
          itemName: "Pizza",
          itemPrice: 10000,
          quantity: 2,
          totalPrice: 20000,
          isReady: true,
          createdAt: now,
        });

        await ctx.db.insert("orderItems", {
          organizationId: orgId,
          orderId,
          itemId: samosaId,
          itemName: "Samosa",
          itemPrice: 8000,
          quantity: 1,
          totalPrice: 8000,
          isReady: true,
          createdAt: now,
        });
      });

      // 1. Check Top Selling
      const topSelling = await asAdmin.query(api.dashboards.getWidgetData, {
        organizationId: orgId,
        widgetId: "menu_top_selling",
        dateRangePreset: "today",
      });
      expect(topSelling.summary!.topItems[0].name).toBe("Pizza");
      expect(topSelling.summary!.topItems[1].name).toBe("Samosa");

      // 2. Check Low Performing:
      // Must exclude Pizza and Samosa (top sellers).
      // Biryani (0 orders) must be surfaced!
      const lowPerforming = await asAdmin.query(api.dashboards.getWidgetData, {
        organizationId: orgId,
        widgetId: "menu_low_performing",
        dateRangePreset: "today",
      });
      const lowNames = lowPerforming.table!.rows.map((r: any) => r.name);
      expect(lowNames).toContain("Biryani");
      expect(lowNames).not.toContain("Pizza");
      expect(lowNames).not.toContain("Samosa");
      const biryaniRow = lowPerforming.table!.rows.find((r: any) => r.name === "Biryani");
      expect(biryaniRow?.qty).toBe(0);
      expect(biryaniRow?.badge).toBe("Zero Sales");

      // 3. Check Out-of-Stock:
      // Internal "Vadapav Recipe" dish must NOT be reported as 86'd out of stock!
      const stockout = await asAdmin.query(api.dashboards.getWidgetData, {
        organizationId: orgId,
        widgetId: "menu_out_of_stock_alerts",
      });
      expect(stockout.alert!.count).toBe(0);
      expect(stockout.alert!.title).toBe("All Menu Items In Stock");
      expect(stockout.summary!.stockoutList.length).toBe(0);

      // 4. Check Product Availability:
      // Unassigned items (Biryani, Samosa) must NOT appear in availabilityList!
      const availabilityBefore = await asAdmin.query(api.dashboards.getWidgetData, {
        organizationId: orgId,
        widgetId: "menu_product_availability",
      });
      expect(availabilityBefore.summary!.availabilityList.length).toBe(0);

      // Now create inventory item and assign recipe to Pizza
      await t.run(async (ctx) => {
        const invId = await ctx.db.insert("inventoryItems", {
          organizationId: orgId,
          name: "Pizza Dough",
          buyingUnit: "piece",
          servingUnit: "piece",
          availableStock: 50,
          minimumStockRefillLevel: 5,
          unitCost: 10,
          createdAt: now,
          updatedAt: now,
        });

        const masterRecipeDishId = await ctx.db.insert("items", {
          ...baseItem,
          name: "Master Pizza Recipe Dish",
          price: 0,
          published: false,
          isAvailable: false,
          createdAt: now,
        });

        await ctx.db.insert("recipes", {
          organizationId: orgId,
          itemId: masterRecipeDishId,
          inventoryItemId: invId,
          quantity: 1,
          unit: "piece",
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("recipeAssignments", {
          organizationId: orgId,
          sourceRecipeItemId: masterRecipeDishId,
          targetItemId: pizzaId,
          portionMultiplier: 1,
          createdAt: now,
          updatedAt: now,
        });
      });

      const availabilityAfter = await asAdmin.query(api.dashboards.getWidgetData, {
        organizationId: orgId,
        widgetId: "menu_product_availability",
      });
      const availNames = availabilityAfter.summary!.availabilityList.map((a: any) => a.name);
      expect(availNames).toContain("Pizza");
      expect(availNames).not.toContain("Samosa");
      expect(availNames).not.toContain("Biryani");
      expect(availabilityAfter.summary!.availabilityList[0].status.toLowerCase()).toContain("in stock");
      // Must NOT contain portion count numbers (e.g. "87 in stock")
      expect(/\d+/.test(availabilityAfter.summary!.availabilityList[0].status)).toBe(false);

      // 5. Check Bestselling Items margin:
      // Margin column must be a percentage (e.g. 72%), not "2 sold"!
      const bestselling = await asAdmin.query(api.dashboards.getWidgetData, {
        organizationId: orgId,
        widgetId: "menu_bestselling_items",
        dateRangePreset: "today",
      });
      for (const row of bestselling.summary!.bestsellingRows) {
        expect(row.margin).toMatch(/\d+%/);
        expect(row.margin).not.toContain("sold");
      }
    });
  });

  // Helper for admin-only setup
  async function setupStoreWithAdmin() {
    const t = convexTest(schema, modules);
    const adminClerkId = "user_admin_only_1";

    const orgId = await t.mutation(api.organizations.create, {
      name: "Bistro Admin Only",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });
    return { t, orgId, asAdmin };
  }
});

