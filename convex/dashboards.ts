import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireAuth,
  resolveStoreOrganization,
  requireMember,
  requireAdmin,
} from "./organizationUsers";
import {
  WIDGET_CATALOG,
  DEFAULT_DASHBOARD_TEMPLATES,
  getWidgetDefinition,
  getTemplateByKey,
  listAllTemplates,
  searchWidgets,
  getWidgetsByCategory,
} from "./dashboardCatalog";
import {
  WidgetCategory,
  WIDGET_CATEGORIES,
  dateRangePresetValidator,
  widgetPlacementInputValidator,
  WidgetDataResponse,
  validatePlacementBoundaries,
  validateWidgetConfiguration,
} from "./dashboardTypes";
import { executeWidgetDataProvider } from "./dashboardDataProviders";

// ==========================================
// 1. HELPER FUNCTIONS & PERMISSIONS
// ==========================================

function canUserAccessWidget(
  userRoles: string[],
  requiredRole?: "any" | "staff" | "cashier" | "captain" | "admin"
): boolean {
  if (!requiredRole || requiredRole === "any") return true;

  const normalizedRoles = userRoles.map((r) => (r || "").trim().toLowerCase());
  const isAdmin = normalizedRoles.some((r) =>
    ["admin", "store_admin", "org_admin", "super_admin"].includes(r)
  );
  if (isAdmin) return true;

  if (requiredRole === "admin") return isAdmin;
  if (requiredRole === "staff") return true; // Any authenticated store member
  if (requiredRole === "cashier") {
    return normalizedRoles.includes("cashier");
  }
  if (requiredRole === "captain") {
    return (
      normalizedRoles.includes("captain") ||
      normalizedRoles.includes("waiter") ||
      normalizedRoles.includes("cashier")
    );
  }

  return true;
}

async function resolveUserRoles(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  userId: string
): Promise<string[]> {
  const member = await ctx.db
    .query("organizationUsers")
    .withIndex("by_user_and_org", (q) =>
      q.eq("userId", userId).eq("organizationId", orgId)
    )
    .first();

  if (!member || member.deletedAt !== undefined) {
    return ["staff"];
  }

  return Array.isArray(member.userType)
    ? member.userType
    : typeof member.userType === "string"
      ? [member.userType]
      : ["staff"];
}

/**
 * Ensures or resolves active dashboard for user
 */
async function resolveActiveUserDashboard(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  userId: string
): Promise<Doc<"dashboards"> | null> {
  // Check user preferences
  const prefs = await ctx.db
    .query("dashboardPreferences")
    .withIndex("by_org_user", (q) => q.eq("organizationId", orgId).eq("userId", userId))
    .first();

  if (prefs?.activeDashboardId) {
    const dash = await ctx.db.get(prefs.activeDashboardId);
    if (dash && dash.organizationId === orgId && dash.deletedAt === undefined) {
      return dash;
    }
  }

  // Find user's own default dashboard
  const userDash = await ctx.db
    .query("dashboards")
    .withIndex("by_org_user", (q) => q.eq("organizationId", orgId).eq("userId", userId))
    .first();

  if (userDash && userDash.deletedAt === undefined) {
    return userDash;
  }

  // Find store default dashboard
  const storeDefault = await ctx.db
    .query("dashboards")
    .withIndex("by_org_scope", (q) => q.eq("organizationId", orgId).eq("scope", "store_default"))
    .first();

  if (storeDefault && storeDefault.deletedAt === undefined) {
    return storeDefault;
  }

  // If none exists, create user default dashboard initialized from Executive Dinner Peak
  if ("insert" in ctx.db) {
    const now = Date.now();
    const newDashId = await (ctx as MutationCtx).db.insert("dashboards", {
      organizationId: orgId,
      userId,
      name: "My Dashboard",
      scope: "user",
      templateKey: "executive_dinner_peak",
      revision: 1,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });

    // Populate placements from template
    const template = getTemplateByKey("executive_dinner_peak") || DEFAULT_DASHBOARD_TEMPLATES[0];
    for (const p of template.placements) {
      await (ctx as MutationCtx).db.insert("dashboardPlacements", {
        organizationId: orgId,
        dashboardId: newDashId,
        widgetId: p.widgetId,
        gridRow: p.gridRow,
        gridCol: p.gridCol,
        width: p.width,
        height: p.height,
        displayOrder: p.displayOrder,
        isEnabled: p.isEnabled,
        configuration: p.configuration,
        configurationVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Upsert preferences
    if (prefs) {
      await (ctx as MutationCtx).db.patch(prefs._id, {
        activeDashboardId: newDashId,
        updatedAt: now,
      });
    } else {
      await (ctx as MutationCtx).db.insert("dashboardPreferences", {
        organizationId: orgId,
        userId,
        activeDashboardId: newDashId,
        autoAlign: true,
        gridResolution: "1440px Fluid",
        selectedTemplateKey: "executive_dinner_peak",
        updatedAt: now,
      });
    }

    const created = await ctx.db.get(newDashId);
    if (!created) throw new Error("Failed to initialize user dashboard");
    return created;
  }

  // Fallback for read-only ctx when not yet created: pick first dashboard or return null
  const anyDash = await ctx.db
    .query("dashboards")
    .withIndex("by_org", (q) => q.eq("organizationId", orgId))
    .first();

  if (anyDash) return anyDash;

  return null;
}

// ==========================================
// 2. WIDGET CATALOG QUERIES
// ==========================================

export const listAvailableWidgets = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    category: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, identity } = await requireMember(ctx, args.organizationId);
    const userRoles = await resolveUserRoles(ctx, org._id, identity.subject);

    let widgets = WIDGET_CATALOG;

    if (args.category) {
      widgets = widgets.filter(
        (w) => w.category.toLowerCase() === args.category!.toLowerCase()
      );
    }

    if (args.searchQuery) {
      const q = args.searchQuery.trim().toLowerCase();
      widgets = widgets.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.category.toLowerCase().includes(q) ||
          (w.subcategory && w.subcategory.toLowerCase().includes(q))
      );
    }

    return widgets.map((w) => {
      const isAuthorized = canUserAccessWidget(userRoles, w.requiredRole);
      return {
        ...w,
        isAvailableToUser: isAuthorized && w.isEnabled,
      };
    });
  },
});

export const getWidgetDefinitionById = query({
  args: {
    widgetId: v.string(),
  },
  handler: async (_ctx, args) => {
    const def = getWidgetDefinition(args.widgetId);
    if (!def) {
      throw new Error(`Widget definition not found for ID: ${args.widgetId}`);
    }
    return def;
  },
});

export const getCatalogWithUserState = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    dashboardId: v.optional(v.id("dashboards")),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, identity } = await requireMember(ctx, args.organizationId);
    const userRoles = await resolveUserRoles(ctx, org._id, identity.subject);

    // Resolve dashboard
    let dashboard: Doc<"dashboards"> | null = null;
    if (args.dashboardId) {
      const d = await ctx.db.get(args.dashboardId);
      if (!d || d.organizationId !== org._id || d.deletedAt !== undefined) {
        throw new Error("Dashboard not found");
      }
      dashboard = d;
    } else {
      dashboard = await resolveActiveUserDashboard(ctx, org._id, identity.subject);
    }

    // Retrieve active placements
    const placements = dashboard
      ? await ctx.db
          .query("dashboardPlacements")
          .withIndex("by_dashboard", (q) => q.eq("dashboardId", dashboard._id))
          .collect()
      : [];

    const placedWidgetMap = new Map<string, Doc<"dashboardPlacements">>();
    for (const p of placements) {
      if (p.isEnabled) {
        placedWidgetMap.set(p.widgetId, p);
      }
    }

    // Calculate per-category statistics
    const categoryCounts: Record<
      string,
      {
        total: number;
        available: number;
        configured: number;
        onDashboard: number;
      }
    > = {};

    for (const cat of WIDGET_CATEGORIES) {
      categoryCounts[cat] = { total: 0, available: 0, configured: 0, onDashboard: 0 };
    }

    const catalogWithState = WIDGET_CATALOG.map((w) => {
      const isAuth = canUserAccessWidget(userRoles, w.requiredRole);
      const isAvailable = isAuth && w.isEnabled;
      const placement = placedWidgetMap.get(w.widgetId);
      const isAlreadyAdded = Boolean(placement);
      const isConfigured = Boolean(
        placement?.configuration &&
          Object.keys(placement.configuration).length > 0
      );

      const stats = categoryCounts[w.category] || { total: 0, available: 0, configured: 0, onDashboard: 0 };
      stats.total += 1;
      if (isAvailable) stats.available += 1;
      if (isAlreadyAdded) stats.onDashboard += 1;
      if (isConfigured) stats.configured += 1;
      categoryCounts[w.category] = stats;

      return {
        ...w,
        isAvailableToUser: isAvailable,
        isAlreadyAdded,
        isConfigured,
        currentPlacement: placement || null,
      };
    });

    const filteredCatalog = args.category
      ? catalogWithState.filter((w) => w.category.toLowerCase() === args.category!.toLowerCase())
      : catalogWithState;

    const totalWidgets = WIDGET_CATALOG.length;
    const availableWidgets = catalogWithState.filter((w) => w.isAvailableToUser).length;
    const onDashboardWidgets = placedWidgetMap.size;

    return {
      widgets: filteredCatalog,
      categoryCounts,
      summary: {
        totalWidgets,
        availableWidgets,
        alreadyOnDashboardCount: onDashboardWidgets,
        activeDashboardId: dashboard?._id,
        activeDashboardName: dashboard?.name,
      },
    };
  },
});

// ==========================================
// 3. DASHBOARD & PLACEMENT RETRIEVAL
// ==========================================

export const getDashboard = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    dashboardId: v.optional(v.id("dashboards")),
  },
  handler: async (ctx, args) => {
    const { org, identity } = await requireMember(ctx, args.organizationId);

    let dashboard: Doc<"dashboards"> | null;
    if (args.dashboardId) {
      const d = await ctx.db.get(args.dashboardId);
      if (!d || d.organizationId !== org._id || d.deletedAt !== undefined) {
        throw new Error("Dashboard not found");
      }
      // Ownership check: user dashboards can only be read by their owner or store admin
      if (d.scope === "user" && d.userId !== identity.subject) {
        const userRoles = await resolveUserRoles(ctx, org._id, identity.subject);
        if (!canUserAccessWidget(userRoles, "admin")) {
          throw new Error("Forbidden. You do not have access to this private dashboard.");
        }
      }
      dashboard = d;
    } else {
      dashboard = await resolveActiveUserDashboard(ctx, org._id, identity.subject);
    }

    if (!dashboard) {
      const defaultTpl = DEFAULT_DASHBOARD_TEMPLATES[0];
      return {
        dashboard: null,
        placements: defaultTpl.placements.map((p, i) => ({
          _id: `temp_${i}` as any,
          _creationTime: Date.now(),
          organizationId: org._id,
          dashboardId: `temp_dash` as any,
          widgetId: p.widgetId,
          gridRow: p.gridRow,
          gridCol: p.gridCol,
          width: p.width,
          height: p.height,
          displayOrder: p.displayOrder,
          isEnabled: p.isEnabled,
          configuration: p.configuration,
          configurationVersion: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })),
        allPlacements: [],
        hasUnsavedDraft: false,
        draftBaseRevision: undefined,
        draftPlacementsCount: 0,
        requiresInitialization: true,
      };
    }

    // Retrieve published placements
    const placements = await ctx.db
      .query("dashboardPlacements")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", dashboard._id))
      .collect();

    // Check if there is an unsaved staging draft
    const draft = await ctx.db
      .query("dashboardDrafts")
      .withIndex("by_org_user_dashboard", (q) =>
        q
          .eq("organizationId", org._id)
          .eq("userId", identity.subject)
          .eq("dashboardId", dashboard._id)
      )
      .first();

    const activePlacements = placements
      .filter((p) => p.isEnabled)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return {
      dashboard,
      placements: activePlacements,
      allPlacements: placements,
      hasUnsavedDraft: Boolean(draft),
      draftBaseRevision: draft?.baseRevision,
      draftPlacementsCount: draft?.placements.length,
    };
  },
});

export const listDashboards = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { org, identity } = await requireMember(ctx, args.organizationId);

    // Retrieve user's personal dashboards
    const userDashboards = await ctx.db
      .query("dashboards")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", identity.subject)
      )
      .collect();

    // Retrieve store default and templates
    const storeDefaults = await ctx.db
      .query("dashboards")
      .withIndex("by_org_scope", (q) => q.eq("organizationId", org._id).eq("scope", "store_default"))
      .collect();

    const templates = await ctx.db
      .query("dashboards")
      .withIndex("by_org_scope", (q) => q.eq("organizationId", org._id).eq("scope", "template"))
      .collect();

    return {
      userDashboards: userDashboards.filter((d) => d.deletedAt === undefined),
      storeDefaults: storeDefaults.filter((d) => d.deletedAt === undefined),
      templates: templates.filter((d) => d.deletedAt === undefined),
      systemTemplates: listAllTemplates(),
    };
  },
});

// ==========================================
// 4. PLACEMENT & DASHBOARD MUTATIONS
// ==========================================

export const createDashboard = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    description: v.optional(v.string()),
    scope: v.optional(
      v.union(v.literal("user"), v.literal("store_default"), v.literal("template"))
    ),
    templateKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, identity } = await requireMember(ctx, args.organizationId);
    const scope = args.scope || "user";

    if (scope === "store_default" || scope === "template") {
      await requireAdmin(ctx, org._id);
    }

    const now = Date.now();
    const dashboardId = await ctx.db.insert("dashboards", {
      organizationId: org._id,
      userId: scope === "user" ? identity.subject : "system",
      name: args.name,
      description: args.description,
      scope,
      templateKey: args.templateKey,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, dashboardId };
  },
});

export const updateDashboard = mutation({
  args: {
    dashboardId: v.id("dashboards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) throw new Error("Dashboard not found");

    if (dashboard.scope === "user" && dashboard.userId !== identity.subject) {
      throw new Error("Forbidden. You cannot modify another user's dashboard.");
    }
    if (dashboard.scope === "store_default" || dashboard.scope === "template") {
      await requireAdmin(ctx, dashboard.organizationId);
    }

    const now = Date.now();
    await ctx.db.patch(dashboard._id, {
      ...(args.name && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      revision: dashboard.revision + 1,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const deleteDashboard = mutation({
  args: {
    dashboardId: v.id("dashboards"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) throw new Error("Dashboard not found");

    if (dashboard.scope === "user" && dashboard.userId !== identity.subject) {
      throw new Error("Forbidden. You cannot delete another user's dashboard.");
    }
    if (dashboard.scope === "store_default" || dashboard.scope === "template") {
      await requireAdmin(ctx, dashboard.organizationId);
    }

    const now = Date.now();
    await ctx.db.patch(dashboard._id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const addWidgetPlacement = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    dashboardId: v.id("dashboards"),
    widgetId: v.string(),
    gridRow: v.optional(v.number()),
    gridCol: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    configuration: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { org, identity } = await requireMember(ctx, args.organizationId);

    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard || dashboard.organizationId !== org._id || dashboard.deletedAt !== undefined) {
      throw new Error("Dashboard not found");
    }

    // Verify ownership
    if (dashboard.scope === "user" && dashboard.userId !== identity.subject) {
      throw new Error("Forbidden. You cannot modify another user's dashboard.");
    }
    if (dashboard.scope === "template") {
      await requireAdmin(ctx, org._id);
    }

    const widgetDef = getWidgetDefinition(args.widgetId);
    if (!widgetDef) {
      throw new Error(`Widget ${args.widgetId} does not exist in catalog.`);
    }

    // Check duplicate placement
    if (!widgetDef.allowMultipleInstances) {
      const existing = await ctx.db
        .query("dashboardPlacements")
        .withIndex("by_dashboard_widget", (q) =>
          q.eq("dashboardId", dashboard._id).eq("widgetId", args.widgetId)
        )
        .first();

      if (existing && existing.isEnabled) {
        throw new Error(`Widget '${widgetDef.name}' is already added to this dashboard.`);
      }
    }

    const placements = await ctx.db
      .query("dashboardPlacements")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", dashboard._id))
      .collect();

    const maxOrder = placements.reduce((max, p) => Math.max(max, p.displayOrder), 0);
    const width = args.width !== undefined ? args.width : widgetDef.defaultDimensions.width;
    const height = args.height !== undefined ? args.height : widgetDef.defaultDimensions.height;
    const gridCol = args.gridCol !== undefined ? args.gridCol : 0;
    const gridRow = args.gridRow !== undefined ? args.gridRow : (placements.length > 0 ? Math.max(...placements.map(p => p.gridRow + p.height)) : 0);

    // Validate boundaries & configuration
    validatePlacementBoundaries(gridCol, width, gridRow, height);
    if (args.configuration !== undefined) {
      validateWidgetConfiguration(args.widgetId, args.configuration);
    }

    const now = Date.now();
    const placementId = await ctx.db.insert("dashboardPlacements", {
      organizationId: org._id,
      dashboardId: dashboard._id,
      widgetId: args.widgetId,
      gridRow,
      gridCol,
      width,
      height,
      displayOrder: maxOrder + 1,
      isEnabled: true,
      configuration: args.configuration,
      configurationVersion: widgetDef.configurationVersion,
      createdAt: now,
      updatedAt: now,
    });

    // Bump dashboard revision
    await ctx.db.patch(dashboard._id, {
      revision: dashboard.revision + 1,
      updatedAt: now,
    });

    return { success: true, placementId };
  },
});

export const removeWidgetPlacement = mutation({
  args: {
    placementId: v.id("dashboardPlacements"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const placement = await ctx.db.get(args.placementId);
    if (!placement) throw new Error("Placement not found");

    const dashboard = await ctx.db.get(placement.dashboardId);
    if (!dashboard) throw new Error("Dashboard not found");

    if (dashboard.scope === "user" && dashboard.userId !== identity.subject) {
      throw new Error("Forbidden. You cannot modify another user's dashboard.");
    }
    if (dashboard.scope === "template") {
      await requireAdmin(ctx, dashboard.organizationId);
    }

    await ctx.db.delete(placement._id);

    const now = Date.now();
    await ctx.db.patch(dashboard._id, {
      revision: dashboard.revision + 1,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const updatePlacementConfig = mutation({
  args: {
    placementId: v.id("dashboardPlacements"),
    configuration: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const placement = await ctx.db.get(args.placementId);
    if (!placement) throw new Error("Placement not found");

    const dashboard = await ctx.db.get(placement.dashboardId);
    if (!dashboard) throw new Error("Dashboard not found");

    if (dashboard.scope === "user" && dashboard.userId !== identity.subject) {
      throw new Error("Forbidden. You cannot modify another user's dashboard.");
    }
    if (dashboard.scope === "template") {
      await requireAdmin(ctx, dashboard.organizationId);
    }

    validateWidgetConfiguration(placement.widgetId, args.configuration);

    const now = Date.now();
    await ctx.db.patch(placement._id, {
      configuration: args.configuration,
      updatedAt: now,
    });

    await ctx.db.patch(dashboard._id, {
      revision: dashboard.revision + 1,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const batchUpdatePlacements = mutation({
  args: {
    dashboardId: v.id("dashboards"),
    placements: v.array(
      v.object({
        placementId: v.id("dashboardPlacements"),
        gridRow: v.number(),
        gridCol: v.number(),
        width: v.number(),
        height: v.number(),
        displayOrder: v.number(),
        isEnabled: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) throw new Error("Dashboard not found");

    if (dashboard.scope === "user" && dashboard.userId !== identity.subject) {
      throw new Error("Forbidden. You cannot modify another user's dashboard.");
    }
    if (dashboard.scope === "template") {
      await requireAdmin(ctx, dashboard.organizationId);
    }

    const now = Date.now();
    for (const p of args.placements) {
      validatePlacementBoundaries(p.gridCol, p.width, p.gridRow, p.height);
      await ctx.db.patch(p.placementId, {
        gridRow: p.gridRow,
        gridCol: p.gridCol,
        width: p.width,
        height: p.height,
        displayOrder: p.displayOrder,
        isEnabled: p.isEnabled,
        updatedAt: now,
      });
    }

    await ctx.db.patch(dashboard._id, {
      revision: dashboard.revision + 1,
      updatedAt: now,
    });

    return { success: true };
  },
});

// ==========================================
// 5. DRAFT & CANVAS STAGING WORKFLOW
// ==========================================

export const createOrUpdateDraft = mutation({
  args: {
    dashboardId: v.id("dashboards"),
    organizationId: v.optional(v.id("organizations")),
    baseRevision: v.number(),
    placements: v.array(widgetPlacementInputValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) throw new Error("Dashboard not found");

    // Optimistic Concurrency / Revision Check
    if (args.baseRevision !== dashboard.revision) {
      throw new Error(
        `Revision conflict: Dashboard has been updated to revision ${dashboard.revision}. Please refresh and reapply your changes.`
      );
    }

    // Validate placements against catalog, boundaries & configs (auto-packing if resized)
    let currentFlowRow = 0;
    let currentFlowCol = 0;

    const sanitizedPlacements = args.placements.map((p, idx) => {
      if (!getWidgetDefinition(p.widgetId)) {
        throw new Error(`Invalid widget ID in draft: ${p.widgetId}`);
      }
      const width = Math.min(12, Math.max(1, p.width || 4));
      const height = Math.max(1, p.height || 1);
      let gridCol = p.gridCol;
      let gridRow = p.gridRow;

      // Auto-align placement coordinates to 12-col boundary if they overflow
      if (gridCol < 0 || gridCol + width > 12) {
        if (currentFlowCol + width > 12) {
          currentFlowRow += 1;
          currentFlowCol = 0;
        }
        gridCol = currentFlowCol;
        gridRow = currentFlowRow;
        currentFlowCol += width;
        if (currentFlowCol >= 12) {
          currentFlowRow += 1;
          currentFlowCol = 0;
        }
      } else {
        currentFlowRow = Math.max(currentFlowRow, gridRow);
        currentFlowCol = gridCol + width;
        if (currentFlowCol >= 12) {
          currentFlowRow += 1;
          currentFlowCol = 0;
        }
      }

      validatePlacementBoundaries(gridCol, width, gridRow, height);
      if (p.configuration !== undefined) {
        validateWidgetConfiguration(p.widgetId, p.configuration);
      }

      return {
        ...p,
        width,
        height,
        gridCol,
        gridRow,
        displayOrder: idx + 1,
        configurationVersion: p.configurationVersion || 1,
      };
    });

    const existingDraft = await ctx.db
      .query("dashboardDrafts")
      .withIndex("by_org_user_dashboard", (q) =>
        q
          .eq("organizationId", dashboard.organizationId)
          .eq("userId", identity.subject)
          .eq("dashboardId", dashboard._id)
      )
      .first();

    const now = Date.now();
    if (existingDraft) {
      await ctx.db.patch(existingDraft._id, {
        baseRevision: args.baseRevision,
        placements: sanitizedPlacements,
        updatedAt: now,
      });
      return { success: true, draftId: existingDraft._id };
    } else {
      const draftId = await ctx.db.insert("dashboardDrafts", {
        organizationId: dashboard.organizationId,
        dashboardId: dashboard._id,
        userId: identity.subject,
        baseRevision: args.baseRevision,
        placements: sanitizedPlacements,
        updatedAt: now,
      });
      return { success: true, draftId };
    }
  },
});

export const getDraft = query({
  args: {
    dashboardId: v.id("dashboards"),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) return null;

    return await ctx.db
      .query("dashboardDrafts")
      .withIndex("by_org_user_dashboard", (q) =>
        q
          .eq("organizationId", dashboard.organizationId)
          .eq("userId", identity.subject)
          .eq("dashboardId", dashboard._id)
      )
      .first();
  },
});

export const applyDraft = mutation({
  args: {
    dashboardId: v.id("dashboards"),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) throw new Error("Dashboard not found");

    if (dashboard.scope === "user" && dashboard.userId !== identity.subject) {
      throw new Error("Forbidden. You cannot apply drafts to another user's dashboard.");
    }
    if (dashboard.scope === "template") {
      await requireAdmin(ctx, dashboard.organizationId);
    }

    const draft = await ctx.db
      .query("dashboardDrafts")
      .withIndex("by_org_user_dashboard", (q) =>
        q
          .eq("organizationId", dashboard.organizationId)
          .eq("userId", identity.subject)
          .eq("dashboardId", dashboard._id)
      )
      .first();

    if (!draft) {
      throw new Error("No staged draft found to apply.");
    }

    // Concurrency conflict check
    if (draft.baseRevision !== dashboard.revision) {
      throw new Error("Stale draft detected. Published dashboard has changed since this draft was started.");
    }

    // Atomically replace published placements
    const existingPlacements = await ctx.db
      .query("dashboardPlacements")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", dashboard._id))
      .collect();

    for (const p of existingPlacements) {
      await ctx.db.delete(p._id);
    }

    const now = Date.now();
    for (const p of draft.placements) {
      await ctx.db.insert("dashboardPlacements", {
        organizationId: dashboard.organizationId,
        dashboardId: dashboard._id,
        widgetId: p.widgetId,
        gridRow: p.gridRow,
        gridCol: p.gridCol,
        width: p.width,
        height: p.height,
        displayOrder: p.displayOrder,
        isEnabled: p.isEnabled,
        configuration: p.configuration,
        configurationVersion: p.configurationVersion,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Delete applied draft
    await ctx.db.delete(draft._id);

    // Increment revision
    const nextRevision = dashboard.revision + 1;
    await ctx.db.patch(dashboard._id, {
      revision: nextRevision,
      updatedAt: now,
    });

    return { success: true, newRevision: nextRevision };
  },
});

export const discardDraft = mutation({
  args: {
    dashboardId: v.id("dashboards"),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) throw new Error("Dashboard not found");

    const draft = await ctx.db
      .query("dashboardDrafts")
      .withIndex("by_org_user_dashboard", (q) =>
        q
          .eq("organizationId", dashboard.organizationId)
          .eq("userId", identity.subject)
          .eq("dashboardId", dashboard._id)
      )
      .first();

    if (draft) {
      await ctx.db.delete(draft._id);
    }

    return { success: true };
  },
});

// ==========================================
// 6. TEMPLATES & RESET TO DEFAULTS
// ==========================================

export const applyTemplate = mutation({
  args: {
    templateKey: v.string(),
    organizationId: v.optional(v.id("organizations")),
    dashboardId: v.optional(v.id("dashboards")),
  },
  handler: async (ctx, args) => {
    const { org, identity } = await requireMember(ctx, args.organizationId);

    const template = getTemplateByKey(args.templateKey);
    if (!template) {
      throw new Error(`Template preset '${args.templateKey}' not found.`);
    }

    let dashboard: Doc<"dashboards"> | null;
    if (args.dashboardId) {
      const d = await ctx.db.get(args.dashboardId);
      if (!d || d.organizationId !== org._id || d.deletedAt !== undefined) {
        throw new Error("Dashboard not found");
      }
      if (d.scope === "user" && d.userId !== identity.subject) {
        throw new Error("Forbidden. You cannot modify another user's dashboard.");
      }
      dashboard = d;
    } else {
      dashboard = await resolveActiveUserDashboard(ctx, org._id, identity.subject);
    }

    if (!dashboard) {
      throw new Error("No active dashboard found to apply template to.");
    }

    // Delete existing placements on this dashboard
    const existing = await ctx.db
      .query("dashboardPlacements")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", dashboard._id))
      .collect();

    for (const p of existing) {
      await ctx.db.delete(p._id);
    }

    const now = Date.now();
    for (const p of template.placements) {
      await ctx.db.insert("dashboardPlacements", {
        organizationId: org._id,
        dashboardId: dashboard._id,
        widgetId: p.widgetId,
        gridRow: p.gridRow,
        gridCol: p.gridCol,
        width: p.width,
        height: p.height,
        displayOrder: p.displayOrder,
        isEnabled: p.isEnabled,
        configuration: p.configuration,
        configurationVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Update preferences with selected template
    const prefs = await ctx.db
      .query("dashboardPreferences")
      .withIndex("by_org_user", (q) => q.eq("organizationId", org._id).eq("userId", identity.subject))
      .first();

    if (prefs) {
      await ctx.db.patch(prefs._id, {
        selectedTemplateKey: args.templateKey,
        updatedAt: now,
      });
    }

    await ctx.db.patch(dashboard._id, {
      templateKey: args.templateKey,
      revision: dashboard.revision + 1,
      updatedAt: now,
    });

    return { success: true, appliedTemplateKey: args.templateKey };
  },
});

export const resetToDefaults = mutation({
  args: {
    dashboardId: v.optional(v.id("dashboards")),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    let dashboard: Doc<"dashboards"> | null = null;
    if (args.dashboardId) {
      dashboard = await ctx.db.get(args.dashboardId);
    } else {
      const org = await resolveStoreOrganization(ctx, args.organizationId);
      dashboard = await resolveActiveUserDashboard(ctx, org._id, identity.subject);
    }
    if (!dashboard) throw new Error("Dashboard not found");

    if (dashboard.scope === "user" && dashboard.userId !== identity.subject) {
      throw new Error("Forbidden. You cannot reset another user's dashboard.");
    }

    // Reset to Executive Dinner Peak template
    const defaultTemplate = DEFAULT_DASHBOARD_TEMPLATES[0];

    const existing = await ctx.db
      .query("dashboardPlacements")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", dashboard._id))
      .collect();

    for (const p of existing) {
      await ctx.db.delete(p._id);
    }

    const now = Date.now();
    for (const p of defaultTemplate.placements) {
      await ctx.db.insert("dashboardPlacements", {
        organizationId: dashboard.organizationId,
        dashboardId: dashboard._id,
        widgetId: p.widgetId,
        gridRow: p.gridRow,
        gridCol: p.gridCol,
        width: p.width,
        height: p.height,
        displayOrder: p.displayOrder,
        isEnabled: p.isEnabled,
        configuration: p.configuration,
        configurationVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(dashboard._id, {
      templateKey: defaultTemplate.templateKey,
      revision: dashboard.revision + 1,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const saveAsTemplate = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    dashboardId: v.id("dashboards"),
    name: v.string(),
    description: v.optional(v.string()),
    templateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdmin(ctx, args.organizationId);

    const sourceDash = await ctx.db.get(args.dashboardId);
    if (!sourceDash || sourceDash.organizationId !== org._id) {
      throw new Error("Source dashboard not found");
    }

    const placements = await ctx.db
      .query("dashboardPlacements")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", sourceDash._id))
      .collect();

    const now = Date.now();
    const newTemplateId = await ctx.db.insert("dashboards", {
      organizationId: org._id,
      userId: "system",
      name: args.name,
      description: args.description,
      scope: "template",
      templateKey: args.templateKey,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });

    for (const p of placements) {
      await ctx.db.insert("dashboardPlacements", {
        organizationId: org._id,
        dashboardId: newTemplateId,
        widgetId: p.widgetId,
        gridRow: p.gridRow,
        gridCol: p.gridCol,
        width: p.width,
        height: p.height,
        displayOrder: p.displayOrder,
        isEnabled: p.isEnabled,
        configuration: p.configuration,
        configurationVersion: p.configurationVersion,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true, templateId: newTemplateId };
  },
});

// ==========================================
// 7. PREFERENCES & SETTINGS
// ==========================================

export const getUserPreferences = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { org, identity } = await requireMember(ctx, args.organizationId);

    const prefs = await ctx.db
      .query("dashboardPreferences")
      .withIndex("by_org_user", (q) => q.eq("organizationId", org._id).eq("userId", identity.subject))
      .first();

    return (
      prefs || {
        organizationId: org._id,
        userId: identity.subject,
        activeDashboardId: undefined,
        autoAlign: true,
        gridResolution: "1440px Fluid",
        selectedTemplateKey: "executive_dinner_peak",
      }
    );
  },
});

export const updateUserPreferences = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    activeDashboardId: v.optional(v.id("dashboards")),
    autoAlign: v.optional(v.boolean()),
    gridResolution: v.optional(v.string()),
    selectedTemplateKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, identity } = await requireMember(ctx, args.organizationId);

    const prefs = await ctx.db
      .query("dashboardPreferences")
      .withIndex("by_org_user", (q) => q.eq("organizationId", org._id).eq("userId", identity.subject))
      .first();

    const now = Date.now();
    if (prefs) {
      await ctx.db.patch(prefs._id, {
        ...(args.activeDashboardId !== undefined && { activeDashboardId: args.activeDashboardId }),
        ...(args.autoAlign !== undefined && { autoAlign: args.autoAlign }),
        ...(args.gridResolution !== undefined && { gridResolution: args.gridResolution }),
        ...(args.selectedTemplateKey !== undefined && { selectedTemplateKey: args.selectedTemplateKey }),
        updatedAt: now,
      });
      return { success: true, preferencesId: prefs._id };
    } else {
      const id = await ctx.db.insert("dashboardPreferences", {
        organizationId: org._id,
        userId: identity.subject,
        activeDashboardId: args.activeDashboardId,
        autoAlign: args.autoAlign ?? true,
        gridResolution: args.gridResolution || "1440px Fluid",
        selectedTemplateKey: args.selectedTemplateKey || "executive_dinner_peak",
        updatedAt: now,
      });
      return { success: true, preferencesId: id };
    }
  },
});

// ==========================================
// 8. UNIFIED WIDGET DATA PROVIDER ENTRYPOINT
// ==========================================

export const getWidgetData = query({
  args: {
    widgetId: v.string(),
    organizationId: v.optional(v.id("organizations")),
    dateRangePreset: v.optional(dateRangePresetValidator),
    fromTimestamp: v.optional(v.number()),
    toTimestamp: v.optional(v.number()),
    stationId: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    paymentMode: v.optional(v.string()),
    orderType: v.optional(v.string()),
    configuration: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<WidgetDataResponse> => {
    const { org, identity } = await requireMember(ctx, args.organizationId);

    const widgetDef = getWidgetDefinition(args.widgetId);
    if (!widgetDef) {
      throw new Error(`Widget ID '${args.widgetId}' not found in catalog.`);
    }

    const userRoles = await resolveUserRoles(ctx, org._id, identity.subject);
    if (!canUserAccessWidget(userRoles, widgetDef.requiredRole)) {
      throw new Error(`Forbidden. Insufficient permissions for widget: ${widgetDef.name}`);
    }

    // Reject cross-store parameter references
    if (args.stationId) {
      try {
        const station = await ctx.db.get(args.stationId as Id<"stations">);
        if (station && station.organizationId !== org._id) {
          throw new Error("Invalid station reference: Cross-store reference rejected (Station belongs to another store).");
        }
      } catch (err: any) {
        if (err?.message?.includes("Cross-store")) throw err;
      }
    }

    return await executeWidgetDataProvider(ctx, org, widgetDef, {
      dateRangePreset: args.dateRangePreset,
      fromTimestamp: args.fromTimestamp,
      toTimestamp: args.toTimestamp,
      stationId: args.stationId,
      employeeId: args.employeeId,
      paymentMode: args.paymentMode,
      orderType: args.orderType,
      configuration: args.configuration,
    });
  },
});

// ==========================================
// 9. IDEMPOTENT INITIALIZATION / PROVISIONING
// ==========================================

export const initializeDefaultTemplates = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const now = Date.now();

    let createdCount = 0;
    for (const tpl of DEFAULT_DASHBOARD_TEMPLATES) {
      const existing = await ctx.db
        .query("dashboards")
        .withIndex("by_org_template", (q) =>
          q.eq("organizationId", org._id).eq("templateKey", tpl.templateKey)
        )
        .first();

      if (!existing) {
        const tplDashId = await ctx.db.insert("dashboards", {
          organizationId: org._id,
          userId: "system",
          name: tpl.name,
          description: tpl.description,
          scope: "template",
          templateKey: tpl.templateKey,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });

        for (const p of tpl.placements) {
          await ctx.db.insert("dashboardPlacements", {
            organizationId: org._id,
            dashboardId: tplDashId,
            widgetId: p.widgetId,
            gridRow: p.gridRow,
            gridCol: p.gridCol,
            width: p.width,
            height: p.height,
            displayOrder: p.displayOrder,
            isEnabled: p.isEnabled,
            configuration: p.configuration,
            configurationVersion: 1,
            createdAt: now,
            updatedAt: now,
          });
        }
        createdCount++;
      }
    }

    // Ensure store default dashboard exists
    const storeDefault = await ctx.db
      .query("dashboards")
      .withIndex("by_org_scope", (q) => q.eq("organizationId", org._id).eq("scope", "store_default"))
      .first();

    if (!storeDefault) {
      const tpl = DEFAULT_DASHBOARD_TEMPLATES[0];
      const storeDashId = await ctx.db.insert("dashboards", {
        organizationId: org._id,
        userId: "store_default",
        name: "Store Default Layout",
        description: "Default store operational dashboard layout",
        scope: "store_default",
        templateKey: tpl.templateKey,
        revision: 1,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });

      for (const p of tpl.placements) {
        await ctx.db.insert("dashboardPlacements", {
          organizationId: org._id,
          dashboardId: storeDashId,
          widgetId: p.widgetId,
          gridRow: p.gridRow,
          gridCol: p.gridCol,
          width: p.width,
          height: p.height,
          displayOrder: p.displayOrder,
          isEnabled: p.isEnabled,
          configuration: p.configuration,
          configurationVersion: 1,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { success: true, seededTemplatesCount: createdCount };
  },
});
