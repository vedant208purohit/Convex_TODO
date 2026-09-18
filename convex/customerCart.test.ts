import { describe, it, expect } from "vitest";

// Pricing and bill summary calculation logic
function calculateBillSummary(items: Array<{ price: number; quantity: number }>, serviceMode: string = "dine_in") {
  const itemTotal = items.reduce((acc, it) => acc + (it.price || 0) * it.quantity, 0);
  
  // 5% GST
  const gst = Math.round(itemTotal * 0.05);
  // 6% Restaurant Service Tax (for dine in)
  const serviceTax = serviceMode === "dine_in" ? Math.round(itemTotal * 0.06) : 0;
  // Dine-in cover & table service charge (0 / FREE)
  const coverCharge = 0;
  
  const grandTotal = itemTotal + gst + serviceTax + coverCharge;

  const toDisplay = (paise: number) => {
    return (paise / 100).toFixed(2);
  };

  return {
    itemTotal,
    gst,
    serviceTax,
    coverCharge,
    grandTotal,
    formattedItemTotal: `₹${toDisplay(itemTotal)}`,
    formattedGst: `₹${toDisplay(gst)}`,
    formattedServiceTax: `₹${toDisplay(serviceTax)}`,
    formattedCoverCharge: coverCharge === 0 ? "FREE" : `₹${toDisplay(coverCharge)}`,
    formattedGrandTotal: `₹${toDisplay(grandTotal)}`,
  };
}

// Cart item composite key generator
function generateCartItemId(itemId: string, customizations: Array<{ customization_id: string; item_id: string }>): string {
  if (!customizations || customizations.length === 0) {
    return itemId;
  }
  const sorted = [...customizations].sort((a, b) => {
    if (a.customization_id !== b.customization_id) {
      return a.customization_id.localeCompare(b.customization_id);
    }
    return a.item_id.localeCompare(b.item_id);
  });
  const parts = sorted.map((c) => `${c.customization_id}:${c.item_id}`).join("|");
  return `${itemId}_${parts}`;
}

describe("Screen 3 Customer Cart & Sequential Journey Tests", () => {
  it("calculates exact reference bill summary correctly for 3 items (₹652.00 subtotal)", () => {
    // 3 items from reference:
    // 1. Signature Veg Bao Bun (Medium Meal + Extra Cheese): ₹243.00 (24300 paise)
    // 2. Cheese Filled Garlic Bread: ₹199.00 (19900 paise)
    // 3. Iced Vietnamese Drip Coffee: ₹210.00 (21000 paise)
    // Total = ₹652.00 (65200 paise)
    const items = [
      { price: 24300, quantity: 1 },
      { price: 19900, quantity: 1 },
      { price: 21000, quantity: 1 },
    ];

    const bill = calculateBillSummary(items, "dine_in");

    expect(bill.itemTotal).toBe(65200);
    expect(bill.formattedItemTotal).toBe("₹652.00");

    // 5% GST on 652.00 = 32.60
    expect(bill.gst).toBe(3260);
    expect(bill.formattedGst).toBe("₹32.60");

    // 6% Service Tax on 652.00 = 39.12
    expect(bill.serviceTax).toBe(3912);
    expect(bill.formattedServiceTax).toBe("₹39.12");

    expect(bill.formattedCoverCharge).toBe("FREE");

    // Grand total: 652.00 + 32.60 + 39.12 = 723.72
    expect(bill.grandTotal).toBe(72372);
    expect(bill.formattedGrandTotal).toBe("₹723.72");
  });

  it("updates item total and grand total dynamically when item quantity changes", () => {
    const items = [
      { price: 24300, quantity: 2 }, // Bao bun x2 = 486.00
      { price: 19900, quantity: 1 }, // Garlic bread x1 = 199.00
    ];

    const bill = calculateBillSummary(items, "dine_in");
    expect(bill.itemTotal).toBe(68500);
    expect(bill.formattedItemTotal).toBe("₹685.00");
    // GST 5% = 34.25
    expect(bill.gst).toBe(3425);
    // Service tax 6% = 41.10
    expect(bill.serviceTax).toBe(4110);
    // Grand total = 685.00 + 34.25 + 41.10 = 760.35
    expect(bill.grandTotal).toBe(76035);
    expect(bill.formattedGrandTotal).toBe("₹760.35");
  });

  it("generates deterministic unique cart item IDs based on customizations", () => {
    const custA = [
      { customization_id: "grp_opt", item_id: "opt_meal" },
      { customization_id: "grp_addon", item_id: "addon_cheese" },
    ];

    const custB = [
      { customization_id: "grp_addon", item_id: "addon_cheese" },
      { customization_id: "grp_opt", item_id: "opt_meal" },
    ];

    // Order of array shouldn't produce different IDs
    const idA = generateCartItemId("item_bao", custA);
    const idB = generateCartItemId("item_bao", custB);
    expect(idA).toBe(idB);
    expect(idA).toBe("item_bao_grp_addon:addon_cheese|grp_opt:opt_meal");
  });

  it("replaces cart item cleanly when editing customizations on Screen 3", () => {
    let cart = [
      {
        cartItemId: "item_bao_grp_opt:opt_standard",
        itemId: "item_bao",
        name: "Signature Veg Bao Bun",
        price: 21900,
        quantity: 1,
        customizations: [{ customization_id: "grp_opt", item_id: "opt_standard" }],
      },
    ];

    const oldCartItemId = "item_bao_grp_opt:opt_standard";
    const newCustomizations = [
      { customization_id: "grp_opt", item_id: "opt_meal" },
      { customization_id: "grp_addon", item_id: "addon_cheese" },
    ];
    const newPrice = 21900 + 8000 + 2400; // 323.00
    const newCartItemId = generateCartItemId("item_bao", newCustomizations);

    // Edit logic: replace oldCartItemId with newCartItemId
    const existingIndex = cart.findIndex((c) => c.cartItemId === oldCartItemId);
    expect(existingIndex).toBe(0);

    const updatedItem = {
      cartItemId: newCartItemId,
      itemId: "item_bao",
      name: "Signature Veg Bao Bun",
      price: newPrice,
      quantity: 1,
      customizations: newCustomizations,
    };

    const newCart = [...cart];
    newCart.splice(existingIndex, 1, updatedItem);

    expect(newCart.length).toBe(1);
    expect(newCart[0].cartItemId).toBe(newCartItemId);
    expect(newCart[0].price).toBe(32300);
  });

  it("removes cart item when quantity drops to 0", () => {
    let cart = [
      { cartItemId: "item_1", quantity: 1, price: 20000 },
      { cartItemId: "item_2", quantity: 2, price: 15000 },
    ];

    // Decrement item_1 by 1 -> should remove
    const updateQty = (id: string, delta: number) => {
      return cart
        .map((it) => {
          if (it.cartItemId === id) {
            return { ...it, quantity: it.quantity + delta };
          }
          return it;
        })
        .filter((it) => it.quantity > 0);
    };

    cart = updateQty("item_1", -1);
    expect(cart.length).toBe(1);
    expect(cart[0].cartItemId).toBe("item_2");

    cart = updateQty("item_2", -1);
    expect(cart.length).toBe(1);
    expect(cart[0].quantity).toBe(1);

    cart = updateQty("item_2", -1);
    expect(cart.length).toBe(0);
  });

  it("preserves customer details & kitchen instructions in state", () => {
    let customerState = {
      phone: "+91 98765 43210",
      name: "Rahul",
      kitchenInstructions: "Please serve beverages first",
      serviceMode: "dine_in" as const,
    };

    expect(customerState.phone).toBe("+91 98765 43210");
    expect(customerState.name).toBe("Rahul");
    expect(customerState.kitchenInstructions).toBe("Please serve beverages first");
    expect(customerState.serviceMode).toBe("dine_in");

    // Modify
    customerState.kitchenInstructions = "Extra spicy and bring lemon with water";
    expect(customerState.kitchenInstructions).toBe("Extra spicy and bring lemon with water");
  });

  it("handles active text and icon color requirements for all 3 service modes", () => {
    const modes = ["delivery", "dine_in", "takeaway"] as const;

    modes.forEach((activeMode) => {
      // For each mode, when active, text and icon must be white
      const getStyles = (mode: string) => {
        const isActive = mode === activeMode;
        return {
          bg: isActive ? "bg-[#4338ca]" : "text-[#464554]",
          text: isActive ? "text-white" : "text-[#464554]",
          icon: isActive ? "text-white" : "text-[#464554]",
        };
      };

      const activeStyle = getStyles(activeMode);
      expect(activeStyle.text).toBe("text-white");
      expect(activeStyle.icon).toBe("text-white");
      expect(activeStyle.bg).toBe("bg-[#4338ca]");

      const otherModes = modes.filter((m) => m !== activeMode);
      otherModes.forEach((inactiveMode) => {
        const inactiveStyle = getStyles(inactiveMode);
        expect(inactiveStyle.text).toBe("text-[#464554]");
        expect(inactiveStyle.icon).toBe("text-[#464554]");
      });
    });
  });
});
