import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { requireAdmin } from "./organizationUsers";

// ----------------------------------------------------
// CSV PARSING UTILITIES
// ----------------------------------------------------

export interface ParsedCsvRow {
  [key: string]: string;
}

/**
 * Parses raw CSV content following RFC 4180 rules.
 * Handles quoted cells, escaped quotes (""), newlines within quotes, and CRLF line breaks.
 */
export function parseCsvContent(content: string): { headers: string[]; rows: ParsedCsvRow[] } {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Menu file is missing or empty");
  }

  const rawRows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++; // Skip the second quote
        } else {
          // Closing quote
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i++; // Skip \n
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== "")) {
          rawRows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== "")) {
          rawRows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  // Handle remaining cell/row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== "")) {
      rawRows.push(currentRow);
    }
  }

  if (rawRows.length === 0) {
    throw new Error("Menu file is missing or empty");
  }

  // Normalize header keys: lowercase, trimmed, underscores
  const rawHeaders = rawRows[0];
  const headers = rawHeaders.map((h) =>
    h
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
  );

  const rows: ParsedCsvRow[] = [];
  for (let r = 1; r < rawRows.length; r++) {
    const rowCells = rawRows[r];
    // Skip empty lines
    if (!rowCells.some((c) => c !== "")) {
      continue;
    }
    const rowObj: ParsedCsvRow = {};
    for (let c = 0; c < headers.length; c++) {
      const headerKey = headers[c];
      if (headerKey) {
        rowObj[headerKey] = rowCells[c] !== undefined ? rowCells[c] : "";
      }
    }
    rows.push(rowObj);
  }

  return { headers, rows };
}

// ----------------------------------------------------
// IMPORT CONTRACT VALIDATION
// ----------------------------------------------------

const REQUIRED_HEADERS = ["category_name", "item_name", "price"] as const;

export function validateCsvHeaders(headers: string[]) {
  const missingHeaders: string[] = [];
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      missingHeaders.push(required);
    }
  }

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required CSV headers: ${missingHeaders.join(", ")}. Required headers are: category_name, item_name, price`
    );
  }
}

// ----------------------------------------------------
// CONVEX MUTATION: importCsv
// ----------------------------------------------------

export interface ImportErrorDetail {
  row: number;
  error: string;
}

export interface ImportCsvResult {
  success: boolean;
  totalRows: number;
  categoriesCreated: number;
  categoriesUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  categoryItemsLinked: number;
  skippedRows: number;
  errors: ImportErrorDetail[];
}

export const importCsv = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    csvContent: v.string(),
    menuId: v.optional(v.id("menus")),
  },
  handler: async (ctx, args): Promise<ImportCsvResult> => {
    // 1. Authenticate caller and enforce Admin permissions
    const { org } = await requireAdmin(ctx, args.organizationId);

    // 2. Parse CSV
    const { headers, rows } = parseCsvContent(args.csvContent);

    // 3. Validate required CSV headers
    validateCsvHeaders(headers);

    if (rows.length === 0) {
      return {
        success: true,
        totalRows: 0,
        categoriesCreated: 0,
        categoriesUpdated: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        categoryItemsLinked: 0,
        skippedRows: 0,
        errors: [],
      };
    }

    // 4. Resolve target menu (specified menuId, active default menu, or create default menu)
    let targetMenuId: Id<"menus">;
    if (args.menuId) {
      const explicitMenu = await ctx.db.get(args.menuId);
      if (
        !explicitMenu ||
        explicitMenu.organizationId !== org._id ||
        explicitMenu.deletedAt !== undefined
      ) {
        throw new Error("Specified target menu not found for this organization");
      }
      targetMenuId = explicitMenu._id;
    } else {
      const existingMenus = await ctx.db
        .query("menus")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      const defaultMenu =
        existingMenus.find((m) => m.isDefault && m.isActive) ||
        existingMenus.find((m) => m.isDefault) ||
        existingMenus.find((m) => m.isActive) ||
        existingMenus[0];

      if (defaultMenu) {
        targetMenuId = defaultMenu._id;
      } else {
        const now = Date.now();
        targetMenuId = await ctx.db.insert("menus", {
          organizationId: org._id,
          name: "Main Menu",
          description: "Default store menu",
          isDefault: true,
          isActive: true,
          position: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 5. Pre-load active categories, items, and itemTypes for the organization to enable fast lookups
    const orgCategories = await ctx.db
      .query("categories")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const categoryMap = new Map<string, Doc<"categories">>();
    for (const cat of orgCategories) {
      categoryMap.set(cat.name.trim().toLowerCase(), cat);
    }

    const orgItems = await ctx.db
      .query("items")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const itemMap = new Map<string, Doc<"items">>();
    for (const item of orgItems) {
      itemMap.set(item.name.trim().toLowerCase(), item);
    }

    const orgItemTypes = await ctx.db
      .query("itemTypes")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const itemTypeMap = new Map<string, Doc<"itemTypes">>();
    for (const it of orgItemTypes) {
      itemTypeMap.set(it.name.trim().toLowerCase(), it);
    }

    // Helper: Find or create ItemType
    async function getOrCreateItemType(name: string): Promise<Id<"itemTypes">> {
      const normalized = name.trim().toLowerCase();
      const existing = itemTypeMap.get(normalized);
      if (existing) return existing._id;

      const now = Date.now();
      const newId = await ctx.db.insert("itemTypes", {
        organizationId: org._id,
        name: name.trim(),
        createdAt: now,
      });

      const doc = await ctx.db.get(newId);
      if (doc) itemTypeMap.set(normalized, doc);
      return newId;
    }

    const createdCategoryIds = new Set<string>();
    const updatedCategoryIds = new Set<string>();
    const createdItemIds = new Set<string>();
    const updatedItemIds = new Set<string>();
    let categoryItemsLinked = 0;
    let skippedRows = 0;
    const errors: ImportErrorDetail[] = [];

    // 6. Process rows
    for (let index = 0; index < rows.length; index++) {
      const rowNum = index + 2; // Line number in CSV (1-indexed header + 1-indexed data)
      const row = rows[index];

      // Extract and validate category name
      const categoryName = (row["category_name"] || "").trim();
      const categoryNameGu = (row["category_name_gu"] || "").trim() || undefined;

      if (!categoryName) {
        errors.push({ row: rowNum, error: "category_name is required" });
        skippedRows++;
        continue;
      }

      // Extract and validate item name
      const itemName = (row["item_name"] || "").trim();
      const itemNameGu = (row["item_name_gu"] || "").trim() || undefined;

      if (!itemName) {
        errors.push({ row: rowNum, error: "item_name is required" });
        skippedRows++;
        continue;
      }

      // Extract and validate price
      const priceRaw = (row["price"] || "").trim();
      if (!priceRaw || isNaN(Number(priceRaw)) || Number(priceRaw) < 0) {
        errors.push({
          row: rowNum,
          error: `price must be a valid non-negative number (received: '${row["price"] || ""}')`,
        });
        skippedRows++;
        continue;
      }

      const parsedPriceNumber = Number(priceRaw);
      // Convert standard currency unit to minor units (cents/paise), e.g. 10.50 -> 1050
      const priceInCents = Math.round(parsedPriceNumber * 100);

      // Extract additional optional fields
      const skuNumber = (row["code"] || row["sku_number"] || row["sku"] || "").trim() || undefined;
      const description =
        (row["item_description"] || row["description"] || "").trim() || undefined;

      // Vegetarian flags
      const vegRaw = (row["vegetarian"] || "").trim().toLowerCase();
      const nonVegRaw = (row["non_vegetarian"] || "").trim().toLowerCase();
      const isVegSpecified = vegRaw === "true" || vegRaw === "1" || vegRaw === "yes";
      const isNonVegSpecified = nonVegRaw === "true" || nonVegRaw === "1" || nonVegRaw === "yes";

      let isVeg = true;
      if (isNonVegSpecified) {
        isVeg = false;
      } else if (isVegSpecified) {
        isVeg = true;
      }

      // Quantity fields
      const quantityRaw = (row["quantity"] || "").trim();
      const quantityUnit = (row["quantity_unit"] || "").trim() || undefined;
      const parsedQuantity = quantityRaw && !isNaN(Number(quantityRaw)) ? Number(quantityRaw) : undefined;
      const showQuantity = Boolean(parsedQuantity !== undefined && quantityUnit);

      // Taxable flag (isGst)
      const taxableRaw = (row["taxable"] || row["is_gst"] || "").trim().toLowerCase();
      const isGst = taxableRaw === "true" || taxableRaw === "1" || taxableRaw === "yes";

      // Calorie fields
      const calorie = (row["calorie"] || "").trim() || undefined;
      const calorieMetric = (row["calorie_metric"] || "").trim() || (calorie ? "kcal" : undefined);
      const showCalorie = Boolean(calorie && calorieMetric);

      const now = Date.now();

      // --- Category Find or Create / Update ---
      const normalizedCatName = categoryName.toLowerCase();
      let categoryDoc = categoryMap.get(normalizedCatName);

      if (categoryDoc) {
        // Update category name / localization
        const patchData: { name: string; name_gu?: string; updatedAt: number } = {
          name: categoryName,
          updatedAt: now,
        };
        if (categoryNameGu !== undefined) {
          patchData.name_gu = categoryNameGu;
        }

        await ctx.db.patch(categoryDoc._id, patchData);
        categoryDoc = { ...categoryDoc, ...patchData };
        categoryMap.set(normalizedCatName, categoryDoc);

        if (!createdCategoryIds.has(categoryDoc._id)) {
          updatedCategoryIds.add(categoryDoc._id);
        }
      } else {
        // Insert new category
        const catPosition = categoryMap.size;
        const newCatId = await ctx.db.insert("categories", {
          organizationId: org._id,
          menuId: targetMenuId,
          name: categoryName,
          name_gu: categoryNameGu,
          position: catPosition,
          published: true,
          createdAt: now,
          updatedAt: now,
        });

        const createdDoc = await ctx.db.get(newCatId);
        if (createdDoc) {
          categoryDoc = createdDoc;
          categoryMap.set(normalizedCatName, createdDoc);
        }
        createdCategoryIds.add(newCatId);
      }

      if (!categoryDoc) {
        errors.push({ row: rowNum, error: `Failed to resolve category '${categoryName}'` });
        skippedRows++;
        continue;
      }

      // --- Resolve ItemTypes ---
      const itemTypeIds: Id<"itemTypes">[] = [];
      if (isVegSpecified) {
        const vegTypeId = await getOrCreateItemType("Vegetarian");
        itemTypeIds.push(vegTypeId);
      } else if (isNonVegSpecified) {
        const nonVegTypeId = await getOrCreateItemType("Non vegetarian");
        itemTypeIds.push(nonVegTypeId);
      }

      // --- Item Find or Create / Update ---
      const normalizedItemName = itemName.toLowerCase();
      let itemDoc = itemMap.get(normalizedItemName);

      if (itemDoc) {
        // Merge itemTypeIds
        const existingTypeIds = itemDoc.itemTypeIds || [];
        const mergedTypeIds = Array.from(new Set([...existingTypeIds, ...itemTypeIds]));

        const updateData: {
          price: number;
          description?: string;
          skuNumber?: string;
          showQuantity: boolean;
          quantity?: number;
          quantityUnit?: string;
          isGst: boolean;
          showCalorie: boolean;
          calorie?: string;
          calorieMetric?: string;
          isVeg: boolean;
          itemTypeIds?: Id<"itemTypes">[];
          updatedAt: number;
        } = {
          price: priceInCents,
          description: description !== undefined ? description : itemDoc.description,
          skuNumber: skuNumber !== undefined ? skuNumber : itemDoc.skuNumber,
          showQuantity,
          quantity: parsedQuantity !== undefined ? parsedQuantity : itemDoc.quantity,
          quantityUnit: quantityUnit !== undefined ? quantityUnit : itemDoc.quantityUnit,
          isGst,
          showCalorie,
          calorie: calorie !== undefined ? calorie : itemDoc.calorie,
          calorieMetric: calorieMetric !== undefined ? calorieMetric : itemDoc.calorieMetric,
          isVeg: isVegSpecified || isNonVegSpecified ? isVeg : itemDoc.isVeg,
          itemTypeIds: mergedTypeIds.length > 0 ? mergedTypeIds : itemDoc.itemTypeIds,
          updatedAt: now,
        };

        await ctx.db.patch(itemDoc._id, updateData);
        itemDoc = { ...itemDoc, ...updateData };
        itemMap.set(normalizedItemName, itemDoc);

        if (!createdItemIds.has(itemDoc._id)) {
          updatedItemIds.add(itemDoc._id);
        }
      } else {
        // Insert new item
        const newItemId = await ctx.db.insert("items", {
          organizationId: org._id,
          name: itemName,
          price: priceInCents,
          description,
          published: true,
          isAvailable: true,
          isGst,
          isVeg,
          isSpicy: false,
          showItemType: true,
          showQuantity,
          quantity: parsedQuantity,
          quantityUnit,
          skuNumber,
          markAsBestseller: false,
          favouriteItem: false,
          showCalorie,
          calorie,
          calorieMetric: calorieMetric || "kcal",
          daysOfUnavailable: 0,
          itemTypeIds: itemTypeIds.length > 0 ? itemTypeIds : undefined,
          createdAt: now,
          updatedAt: now,
        });

        const createdItem = await ctx.db.get(newItemId);
        if (createdItem) {
          itemDoc = createdItem;
          itemMap.set(normalizedItemName, createdItem);
        }
        createdItemIds.add(newItemId);
      }

      if (!itemDoc) {
        errors.push({ row: rowNum, error: `Failed to resolve item '${itemName}'` });
        skippedRows++;
        continue;
      }

      // --- Category-Item Link (categoryItems) ---
      const existingLinks = await ctx.db
        .query("categoryItems")
        .withIndex("by_category", (q) => q.eq("categoryId", categoryDoc!._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("itemId"), itemDoc!._id),
            q.eq(q.field("deletedAt"), undefined)
          )
        )
        .first();

      if (!existingLinks) {
        const currentCategoryItems = await ctx.db
          .query("categoryItems")
          .withIndex("by_category", (q) => q.eq("categoryId", categoryDoc!._id))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect();

        await ctx.db.insert("categoryItems", {
          organizationId: org._id,
          categoryId: categoryDoc._id,
          itemId: itemDoc._id,
          position: currentCategoryItems.length,
          published: true,
          createdAt: now,
        });
        categoryItemsLinked++;
      }
    }

    return {
      success: errors.length === 0,
      totalRows: rows.length,
      categoriesCreated: createdCategoryIds.size,
      categoriesUpdated: updatedCategoryIds.size,
      itemsCreated: createdItemIds.size,
      itemsUpdated: updatedItemIds.size,
      categoryItemsLinked,
      skippedRows,
      errors,
    };
  },
});
