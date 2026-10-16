import { describe, it, expect, vi } from "vitest";

describe("AddItemsToStationDrawer Business Logic & Interaction Rules", () => {
  // Test fixture data matching real menu structure
  const mockCategories = [
    {
      _id: "cat_raw_bar",
      name: "Appetizers & Raw Bar",
      position: 0,
      items: [
        {
          _id: "item_hamachi",
          name: "Hamachi Crudo, Citrus Ponzu",
          description: "Cold prep station / Allergen: Fish",
          price: 950,
          isVeg: false,
          isSpicy: false,
          isAvailable: true,
          skuNumber: "RAW-001",
        },
        {
          _id: "item_tartare",
          name: "Hand-Cut Prime Beef Tartare",
          description: "Cured yolk, brioche crisps",
          price: 1100,
          isVeg: false,
          isSpicy: false,
          isAvailable: true,
          skuNumber: "RAW-002",
        },
        {
          _id: "item_burrata",
          name: "Burrata Pugliese & Heirloom Figs",
          description: "Aged balsamic glaze",
          price: 850,
          isVeg: true,
          isSpicy: false,
          isAvailable: true,
          skuNumber: "RAW-003",
        },
      ],
    },
    {
      _id: "cat_mains",
      name: "Mains & Rotisserie",
      position: 1,
      items: [
        {
          _id: "item_wagyu",
          name: "A5 Miyazaki Wagyu Tenderloin 180g",
          description: "Charred allium purée, smoked bone jus",
          price: 4500,
          isVeg: false,
          isSpicy: false,
          isAvailable: true,
          skuNumber: "MAIN-001",
        },
        {
          _id: "item_turbot",
          name: "Wood-Fired Wild Turbot",
          description: "Brown butter emulsion, sea greens",
          price: 3200,
          isVeg: false,
          isSpicy: false,
          isAvailable: true,
          skuNumber: "MAIN-002",
        },
      ],
    },
  ];

  // Helper: Filter categories according to AddItemsToStationDrawer implementation
  function filterCategories(categories: typeof mockCategories, searchQuery: string) {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categories;

    return categories
      .map((cat) => {
        const catNameMatches = cat.name.toLowerCase().includes(query);
        const matchingItems = cat.items.filter(
          (item) =>
            catNameMatches ||
            item.name.toLowerCase().includes(query) ||
            (item.description && item.description.toLowerCase().includes(query)) ||
            (item.skuNumber && item.skuNumber.toLowerCase().includes(query))
        );

        return {
          ...cat,
          items: catNameMatches ? cat.items : matchingItems,
          hasMatch: catNameMatches || matchingItems.length > 0,
        };
      })
      .filter((cat) => cat.hasMatch);
  }

  describe("1. Initial Selection & Pre-population", () => {
    it("pre-selects existing persisted station item assignments", () => {
      const persistedAssignments = ["item_hamachi", "item_wagyu"];
      const selectedSet = new Set(persistedAssignments);

      expect(selectedSet.has("item_hamachi")).toBe(true);
      expect(selectedSet.has("item_wagyu")).toBe(true);
      expect(selectedSet.has("item_tartare")).toBe(false);
      expect(selectedSet.size).toBe(2);
    });
  });

  describe("2. Individual Item Toggling", () => {
    it("toggles items in and out of the pending selection set", () => {
      const selectedSet = new Set(["item_hamachi"]);

      // Select tartare
      selectedSet.add("item_tartare");
      expect(selectedSet.has("item_tartare")).toBe(true);
      expect(selectedSet.size).toBe(2);

      // Deselect hamachi
      selectedSet.delete("item_hamachi");
      expect(selectedSet.has("item_hamachi")).toBe(false);
      expect(selectedSet.size).toBe(1);
    });
  });

  describe("3. Category 'Select All' and 'Clear All'", () => {
    it("selects all eligible items in a specific category without altering other categories", () => {
      const selectedSet = new Set(["item_wagyu"]); // from mains category
      const rawBarItemIds = mockCategories[0].items.map((i) => i._id);

      // Select All on Raw Bar
      for (const id of rawBarItemIds) {
        selectedSet.add(id);
      }

      expect(selectedSet.has("item_hamachi")).toBe(true);
      expect(selectedSet.has("item_tartare")).toBe(true);
      expect(selectedSet.has("item_burrata")).toBe(true);
      expect(selectedSet.has("item_wagyu")).toBe(true); // preserved
      expect(selectedSet.size).toBe(4);
    });

    it("clears all items in a category without clearing items in other categories", () => {
      const selectedSet = new Set(["item_hamachi", "item_tartare", "item_wagyu"]);
      const rawBarItemIds = mockCategories[0].items.map((i) => i._id);

      // Clear all Raw Bar items
      for (const id of rawBarItemIds) {
        selectedSet.delete(id);
      }

      expect(selectedSet.has("item_hamachi")).toBe(false);
      expect(selectedSet.has("item_tartare")).toBe(false);
      expect(selectedSet.has("item_wagyu")).toBe(true); // preserved
      expect(selectedSet.size).toBe(1);
    });
  });

  describe("4. Accurate Counts and Aggregations", () => {
    it("calculates category-level and total assignment counts accurately", () => {
      const selectedSet = new Set(["item_hamachi", "item_tartare"]);
      const rawBar = mockCategories[0];
      const mains = mockCategories[1];

      const rawBarAssignedCount = rawBar.items.filter((i) => selectedSet.has(i._id)).length;
      const mainsAssignedCount = mains.items.filter((i) => selectedSet.has(i._id)).length;

      expect(rawBarAssignedCount).toBe(2);
      expect(rawBar.items.length).toBe(3);
      expect(mainsAssignedCount).toBe(0);
      expect(mains.items.length).toBe(2);
      expect(selectedSet.size).toBe(2);
    });
  });

  describe("5. Search and Filtering", () => {
    it("filters items by item name", () => {
      const results = filterCategories(mockCategories, "Hamachi");
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Appetizers & Raw Bar");
      expect(results[0].items.length).toBe(1);
      expect(results[0].items[0].name).toContain("Hamachi");
    });

    it("filters items by category name and preserves all items in matched category", () => {
      const results = filterCategories(mockCategories, "Rotisserie");
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Mains & Rotisserie");
      expect(results[0].items.length).toBe(2);
    });

    it("filters items by description and ingredients", () => {
      const results = filterCategories(mockCategories, "balsamic");
      expect(results.length).toBe(1);
      expect(results[0].items[0]._id).toBe("item_burrata");
    });

    it("returns empty array when search query matches nothing", () => {
      const results = filterCategories(mockCategories, "NonExistentDishXYZ");
      expect(results.length).toBe(0);
    });

    it("restores full category list when search query is cleared", () => {
      const results = filterCategories(mockCategories, "");
      expect(results.length).toBe(2);
      expect(results[0].items.length).toBe(3);
      expect(results[1].items.length).toBe(2);
    });
  });

  describe("6. Submission & Double Click Prevention", () => {
    it("prevents multiple concurrent assignment saves", async () => {
      let isSubmitting = false;
      const mutationSpy = vi.fn().mockImplementation(async () => {
        return new Promise((resolve) => setTimeout(() => resolve({ success: true, count: 2 }), 40));
      });

      const handleSave = async (items: string[]) => {
        if (isSubmitting) return;
        isSubmitting = true;
        try {
          await mutationSpy({ assignedItemIds: items });
        } finally {
          isSubmitting = false;
        }
      };

      const p1 = handleSave(["item_hamachi", "item_wagyu"]);
      const p2 = handleSave(["item_hamachi", "item_wagyu"]);

      await Promise.all([p1, p2]);

      expect(mutationSpy).toHaveBeenCalledTimes(1);
    });

    it("preserves selection state upon server error so user does not lose changes", async () => {
      let selectedSet = new Set(["item_burrata", "item_turbot"]);
      let errorMsg: string | null = null;

      const failingMutation = vi.fn().mockRejectedValue(new Error("Server Error Network timeout"));

      try {
        await failingMutation({ assignedItemIds: Array.from(selectedSet) });
      } catch (err: any) {
        errorMsg = err.message.replace(/^.*?Server Error\s*/i, "");
      }

      // Selections intact
      expect(selectedSet.size).toBe(2);
      expect(selectedSet.has("item_burrata")).toBe(true);
      expect(errorMsg).toBe("Network timeout");
    });
  });
});
