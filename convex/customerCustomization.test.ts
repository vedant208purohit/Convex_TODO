import { describe, it, expect } from "vitest";

interface SelectedCustomization {
  customizationId: string;
  customizationName: string;
  optionId: string;
  optionName: string;
  price: number; // in paise
}

interface CustomizationItemOption {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
}

interface CustomizationGroup {
  id: string;
  name: string;
  customization_type: string;
  required: boolean;
  max_selected: number;
  customization_items: CustomizationItemOption[];
}

interface ProductItem {
  id: string;
  name: string;
  price: number; // in paise
  customizations?: CustomizationGroup[];
}

function calculateCustomizedPrice(
  basePrice: number,
  selectedCustomizations: SelectedCustomization[],
  quantity: number
): { unitPrice: number; grandTotal: number; formattedGrandTotal: string } {
  const addonsTotal = selectedCustomizations.reduce((sum, c) => sum + (c.price || 0), 0);
  const unitPrice = basePrice + addonsTotal;
  const grandTotal = unitPrice * quantity;
  return {
    unitPrice,
    grandTotal,
    formattedGrandTotal: `₹${(grandTotal / 100).toFixed(2)}`,
  };
}

function validateRequiredSelections(
  groups: CustomizationGroup[],
  selectedOptionsMap: Record<string, string[]>
): boolean {
  return groups.every((group) => {
    if (!group.required) return true;
    const chosen = selectedOptionsMap[group.id] || [];
    return chosen.length > 0;
  });
}

function buildCartItemId(
  itemId: string,
  customizations?: SelectedCustomization[],
  preferences?: string[]
): string {
  const custKeys = (customizations || [])
    .map((c) => c.optionId)
    .sort()
    .join("_");
  const prefKeys = (preferences || [])
    .sort()
    .join("_");
  const suffix = [custKeys, prefKeys].filter(Boolean).join("__");
  return suffix ? `${itemId}_${suffix}` : itemId;
}

describe("Screen 2 — Customer Product Customization Logic & Pricing", () => {
  const sampleBaoDish: ProductItem = {
    id: "item_bao_signature",
    name: "Signature Veg Bao Bun",
    price: 21900, // ₹219.00
    customizations: [
      {
        id: "cust_group_options",
        name: "Choose Option",
        customization_type: "Add-Ons",
        required: true,
        max_selected: 1,
        customization_items: [
          { id: "opt_duo", name: "Standard Bao Duo (2 pcs)", price: 0, is_available: true },
          { id: "opt_combo", name: "Medium Meal Combo", price: 8000, is_available: true },
          { id: "opt_feast", name: "Bao Feast Box", price: 13000, is_available: true },
        ],
      },
      {
        id: "cust_group_addons",
        name: "Add-Ons & Extras",
        customization_type: "Add-Ons",
        required: false,
        max_selected: 3,
        customization_items: [
          { id: "addon_cheese", name: "Extra Melted Cheese Slice", price: 2400, is_available: true },
          { id: "addon_dip", name: "Extra Peri Peri Dip", price: 3500, is_available: true },
          { id: "addon_patty", name: "Extra Crispy Patty", price: 6500, is_available: true },
        ],
      },
      {
        id: "cust_group_prep",
        name: "Chef Prep Preferences",
        customization_type: "Preparations",
        required: false,
        max_selected: 4,
        customization_items: [
          { id: "prep_no_onion", name: "No Onion", price: 0, is_available: true },
          { id: "prep_less_spicy", name: "Less Spicy", price: 0, is_available: true },
        ],
      },
    ],
  };

  it("calculates base price when standard included option is selected", () => {
    const selected: SelectedCustomization[] = [
      {
        customizationId: "cust_group_options",
        customizationName: "Choose Option",
        optionId: "opt_duo",
        optionName: "Standard Bao Duo (2 pcs)",
        price: 0,
      },
    ];

    const result = calculateCustomizedPrice(sampleBaoDish.price, selected, 1);
    expect(result.unitPrice).toBe(21900);
    expect(result.grandTotal).toBe(21900);
    expect(result.formattedGrandTotal).toBe("₹219.00");
  });

  it("accurately computes price with required option upgrade and optional add-on (₹219 + ₹24 = ₹243)", () => {
    const selected: SelectedCustomization[] = [
      {
        customizationId: "cust_group_options",
        customizationName: "Choose Option",
        optionId: "opt_duo",
        optionName: "Standard Bao Duo (2 pcs)",
        price: 0,
      },
      {
        customizationId: "cust_group_addons",
        customizationName: "Add-Ons & Extras",
        optionId: "addon_cheese",
        optionName: "Extra Melted Cheese Slice",
        price: 2400, // ₹24.00
      },
    ];

    const result = calculateCustomizedPrice(sampleBaoDish.price, selected, 1);
    expect(result.unitPrice).toBe(24300);
    expect(result.grandTotal).toBe(24300);
    expect(result.formattedGrandTotal).toBe("₹243.00");
  });

  it("scales grand total linearly with quantity stepper (₹243 x 2 = ₹486)", () => {
    const selected: SelectedCustomization[] = [
      {
        customizationId: "cust_group_options",
        customizationName: "Choose Option",
        optionId: "opt_duo",
        optionName: "Standard Bao Duo (2 pcs)",
        price: 0,
      },
      {
        customizationId: "cust_group_addons",
        customizationName: "Add-Ons & Extras",
        optionId: "addon_cheese",
        optionName: "Extra Melted Cheese Slice",
        price: 2400,
      },
    ];

    const result = calculateCustomizedPrice(sampleBaoDish.price, selected, 2);
    expect(result.unitPrice).toBe(24300);
    expect(result.grandTotal).toBe(48600);
    expect(result.formattedGrandTotal).toBe("₹486.00");
  });

  it("enforces required option validation before allowing add-to-cart", () => {
    const emptySelections: Record<string, string[]> = {
      cust_group_options: [],
      cust_group_addons: ["addon_cheese"],
    };

    expect(validateRequiredSelections(sampleBaoDish.customizations!, emptySelections)).toBe(false);

    const validSelections: Record<string, string[]> = {
      cust_group_options: ["opt_duo"],
      cust_group_addons: ["addon_cheese"],
    };

    expect(validateRequiredSelections(sampleBaoDish.customizations!, validSelections)).toBe(true);
  });

  it("generates deterministic composite cartItemIds distinguishing different customizations and preferences", () => {
    const cartId1 = buildCartItemId(sampleBaoDish.id, [
      { customizationId: "c1", customizationName: "Opts", optionId: "opt_duo", optionName: "Duo", price: 0 },
    ]);

    const cartId2 = buildCartItemId(sampleBaoDish.id, [
      { customizationId: "c1", customizationName: "Opts", optionId: "opt_duo", optionName: "Duo", price: 0 },
      { customizationId: "c2", customizationName: "Addons", optionId: "addon_cheese", optionName: "Cheese", price: 2400 },
    ]);

    const cartIdWithPref = buildCartItemId(
      sampleBaoDish.id,
      [
        { customizationId: "c1", customizationName: "Opts", optionId: "opt_duo", optionName: "Duo", price: 0 },
      ],
      ["No Onion"]
    );

    expect(cartId1).toBe("item_bao_signature_opt_duo");
    expect(cartId2).toBe("item_bao_signature_addon_cheese_opt_duo");
    expect(cartIdWithPref).toBe("item_bao_signature_opt_duo__No Onion");
    expect(cartId1).not.toBe(cartId2);
    expect(cartId1).not.toBe(cartIdWithPref);
  });
});
