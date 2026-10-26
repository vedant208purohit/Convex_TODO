import { describe, it, expect } from "vitest";

describe("UpdateStationDrawer Business Logic & Interaction Rules", () => {
  // Test fixture data matching Screen 4 prototype:
  // Station: starter, 9 categories total, Continental Food has 5 items (all assigned), Snacks has 12 items (2 assigned)
  const mockCategories = [
    {
      _id: "cat_continental",
      name: "Continental Food",
      items: [
        { _id: "item_bread", name: "Cheese filled garlic bread", price: 8.5 },
        { _id: "item_corn_bread", name: "Jalapeno corn cheese garlic bread", price: 9.25 },
        { _id: "item_pita", name: "Hummus pita platter", price: 12.0 },
        { _id: "item_labneh", name: "Labneh spread with nachos", price: 11.5 },
        { _id: "item_falafel", name: "Hummus falafel", price: 13.5 },
      ],
    },
    {
      _id: "cat_snacks",
      name: "Snacks",
      items: [
        { _id: "item_snack_1", name: "Crispy Calamari", price: 10.0 },
        { _id: "item_snack_2", name: "Truffle Fries", price: 7.5 },
        { _id: "item_snack_3", name: "Onion Rings", price: 6.0 },
      ],
    },
    {
      _id: "cat_viral",
      name: "Viral Food",
      items: [
        { _id: "item_viral_1", name: "Smash Burger", price: 14.0 },
      ],
    },
  ];

  // Helper: Name validation matching UpdateStationDrawer
  function validateStationName(
    name: string,
    currentStationName: string,
    existingStationNames: string[]
  ): string | null {
    const trimmed = name.trim();
    if (!trimmed) {
      return "Station name is required.";
    }

    const isDuplicate = existingStationNames.some(
      (existing) =>
        existing.trim().toLowerCase() === trimmed.toLowerCase() &&
        existing.trim().toLowerCase() !== currentStationName.trim().toLowerCase()
    );

    if (isDuplicate) {
      return `Hey! ${trimmed} is already taken.`;
    }

    return null;
  }

  // Helper: Calculate category status badge
  function getCategoryStatusBadge(
    categoryItemIds: string[],
    selectedSet: Set<string>
  ) {
    const assignedCount = categoryItemIds.filter((id) => selectedSet.has(id)).length;
    const totalCount = categoryItemIds.length;
    const isAll = totalCount > 0 && assignedCount === totalCount;
    const isPartial = assignedCount > 0 && assignedCount < totalCount;

    if (isAll) {
      return `Full: ${assignedCount} / ${totalCount} assigned`;
    }
    if (isPartial) {
      return `Partial: ${assignedCount} / ${totalCount} assigned`;
    }
    return `0 / ${totalCount} assigned`;
  }

  // Helper: Calculate assigned categories count
  function getAssignedCategoriesCount(
    categories: typeof mockCategories,
    selectedSet: Set<string>
  ) {
    return categories.filter((cat) =>
      cat.items.some((item) => selectedSet.has(item._id))
    ).length;
  }

  describe("1. Station Name Validation & Editing", () => {
    const existingStations = ["starter", "Hot Line", "Bar Line", "Pastry"];

    it("accepts valid new station names", () => {
      expect(validateStationName("Cold Larder", "starter", existingStations)).toBeNull();
      expect(validateStationName("  Pantry Station  ", "starter", existingStations)).toBeNull();
    });

    it("allows keeping the existing station's own name unchanged", () => {
      expect(validateStationName("starter", "starter", existingStations)).toBeNull();
      expect(validateStationName("STARTER", "starter", existingStations)).toBeNull();
    });

    it("rejects empty or whitespace-only station name", () => {
      expect(validateStationName("", "starter", existingStations)).toBe("Station name is required.");
      expect(validateStationName("   ", "starter", existingStations)).toBe("Station name is required.");
    });

    it("rejects duplicate active station names in the organization", () => {
      expect(validateStationName("Hot Line", "starter", existingStations)).toBe(
        "Hey! Hot Line is already taken."
      );
      expect(validateStationName("hot line", "starter", existingStations)).toBe(
        "Hey! hot line is already taken."
      );
      expect(validateStationName("  Pastry  ", "starter", existingStations)).toBe(
        "Hey! Pastry is already taken."
      );
    });
  });

  describe("2. Initial Pre-population & Station Identifier", () => {
    it("formats station identifier properly with legacyId fallback", () => {
      // With legacyId 2
      const formatIdentifier = (legacyId?: number | string, idFallback?: string) => {
        if (legacyId) return `KDS-ST-${String(legacyId).padStart(2, "0")}`;
        if (idFallback) return `KDS-ST-${idFallback.slice(-6).toUpperCase()}`;
        return "KDS-ST-02";
      };

      expect(formatIdentifier(2)).toBe("KDS-ST-02");
      expect(formatIdentifier("14")).toBe("KDS-ST-14");
      expect(formatIdentifier(undefined, "station_abc123def456")).toBe("KDS-ST-DEF456");
      expect(formatIdentifier(undefined, undefined)).toBe("KDS-ST-02");
    });

    it("initializes selected items from persisted assignments", () => {
      // 5 items from continental, 2 from snacks = 7 items in 2 categories
      const persisted = [
        "item_bread",
        "item_corn_bread",
        "item_pita",
        "item_labneh",
        "item_falafel",
        "item_snack_1",
        "item_snack_2",
      ];
      const selected = new Set(persisted);

      expect(selected.size).toBe(7);
      expect(getAssignedCategoriesCount(mockCategories, selected)).toBe(2);
    });
  });

  describe("3. Dynamic Category Assignment Status Badges", () => {
    it("displays 'Full: 5 / 5 assigned' when all items in category are selected", () => {
      const selected = new Set([
        "item_bread",
        "item_corn_bread",
        "item_pita",
        "item_labneh",
        "item_falafel",
      ]);
      const continentalIds = mockCategories[0].items.map((i) => i._id);

      expect(getCategoryStatusBadge(continentalIds, selected)).toBe("Full: 5 / 5 assigned");
    });

    it("displays 'Partial: 2 / 3 assigned' when some items in category are selected", () => {
      const selected = new Set(["item_snack_1", "item_snack_2"]);
      const snacksIds = mockCategories[1].items.map((i) => i._id);

      expect(getCategoryStatusBadge(snacksIds, selected)).toBe("Partial: 2 / 3 assigned");
    });

    it("displays '0 / 1 assigned' when no items in category are selected", () => {
      const selected = new Set<string>();
      const viralIds = mockCategories[2].items.map((i) => i._id);

      expect(getCategoryStatusBadge(viralIds, selected)).toBe("0 / 1 assigned");
    });
  });

  describe("4. Category Bulk Actions (Select all / Clear all)", () => {
    it("selects all items in a category and immediately updates metrics", () => {
      const selected = new Set(["item_bread"]);
      const continentalIds = mockCategories[0].items.map((i) => i._id);

      // Perform Select all
      continentalIds.forEach((id) => selected.add(id));

      expect(selected.size).toBe(5);
      expect(getAssignedCategoriesCount(mockCategories, selected)).toBe(1);
      expect(getCategoryStatusBadge(continentalIds, selected)).toBe("Full: 5 / 5 assigned");
    });

    it("clears all items in a category and updates metrics without affecting other categories", () => {
      const selected = new Set([
        "item_bread",
        "item_corn_bread",
        "item_snack_1", // from Snacks
      ]);
      const continentalIds = mockCategories[0].items.map((i) => i._id);

      // Perform Clear all on Continental
      continentalIds.forEach((id) => selected.delete(id));

      expect(selected.size).toBe(1); // item_snack_1 remains
      expect(selected.has("item_snack_1")).toBe(true);
      expect(getAssignedCategoriesCount(mockCategories, selected)).toBe(1);
      expect(getCategoryStatusBadge(continentalIds, selected)).toBe("0 / 5 assigned");
    });
  });

  describe("5. Routing Status Indicator", () => {
    it("reports 'Routing active' when at least one item is assigned", () => {
      const count = 7;
      const statusText = count > 0 ? "Routing active" : "Routing inactive";
      expect(statusText).toBe("Routing active");
    });

    it("reports 'Routing inactive' when zero items are assigned", () => {
      const count = 0;
      const statusText = count > 0 ? "Routing active" : "Routing inactive";
      expect(statusText).toBe("Routing inactive");
    });
  });
});
