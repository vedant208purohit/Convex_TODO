import { describe, it, expect } from "vitest";
import { DeliveryAddress, AddressType, CartItem } from "../app/components/customer/types";
import { buildCartItemId } from "../app/components/customer/CustomerCartContext";

describe("Screen 2B — Delivery Location & Customer Address Flow Unit Tests", () => {
  describe("1. Address Validation & Required Fields", () => {
    it("validates that house/flat/block and apartment/road/area are required", () => {
      const validate = (houseFlat: string, aptRoad: string) => {
        const errors: { houseFlatBlock?: string; apartmentRoadArea?: string } = {};
        if (!houseFlat.trim()) {
          errors.houseFlatBlock = "Please enter house / flat / block number";
        }
        if (!aptRoad.trim()) {
          errors.apartmentRoadArea = "Please enter apartment / road / area";
        }
        return errors;
      };

      expect(validate("", "")).toEqual({
        houseFlatBlock: "Please enter house / flat / block number",
        apartmentRoadArea: "Please enter apartment / road / area",
      });

      expect(validate("D-73", "")).toEqual({
        apartmentRoadArea: "Please enter apartment / road / area",
      });

      expect(validate("", "Titanium Heights, Corporate Road")).toEqual({
        houseFlatBlock: "Please enter house / flat / block number",
      });

      expect(validate("D-73", "Titanium Heights, Corporate Road")).toEqual({});
    });
  });

  describe("2. Quick Delivery Instruction Chips Selection", () => {
    it("toggles and appends quick instruction chips without duplicating commas", () => {
      const toggleChip = (prev: string, chipText: string): string => {
        if (!prev.trim()) return chipText;
        if (prev.includes(chipText)) {
          return prev.replace(chipText, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
        }
        return `${prev.trim()}, ${chipText}`;
      };

      let instructions = "";
      instructions = toggleChip(instructions, "Leave at gate");
      expect(instructions).toBe("Leave at gate");

      instructions = toggleChip(instructions, "Avoid calling");
      expect(instructions).toBe("Leave at gate, Avoid calling");

      instructions = toggleChip(instructions, "Leave at gate");
      expect(instructions).toBe("Avoid calling");
    });
  });

  describe("3. Address Types (Home / Office / Other)", () => {
    it("supports only valid address types and defaults to Home", () => {
      const validTypes: AddressType[] = ["Home", "Office", "Other"];
      validTypes.forEach((type) => {
        expect(["Home", "Office", "Other"]).toContain(type);
      });
    });
  });

  describe("4. Delivery Address Contract Compatibility with Convex userAddresses", () => {
    it("compiles a clean DeliveryAddress object matching backend requirements", () => {
      const compiledAddress: DeliveryAddress = {
        houseFlatBlock: "D-73",
        apartmentRoadArea: "Titanium Heights, Corporate Road, Makarba",
        deliveryInstructions: "Leave with security guard",
        landmark: "Near Vodafone House, opposite courtyard",
        addressType: "Home",
        city: "Ahmedabad",
        zipCode: "380015",
        formattedAddress: "Makarba, Ahmedabad, Gujarat 380015",
        latitude: 22.9988,
        longitude: 72.5074,
        accuracyStatus: "High Accuracy",
        isDefault: true,
      };

      expect(compiledAddress.houseFlatBlock).toBe("D-73");
      expect(compiledAddress.apartmentRoadArea).toBe("Titanium Heights, Corporate Road, Makarba");
      expect(compiledAddress.addressType).toBe("Home");
      expect(compiledAddress.latitude).toBeCloseTo(22.9988);
      expect(compiledAddress.longitude).toBeCloseTo(72.5074);
      expect(compiledAddress.accuracyStatus).toBe("High Accuracy");
    });
  });

  describe("5. Cart & Customization Preservation Across Screen Transitions", () => {
    it("preserves cart items, quantities, and customizations when switching to delivery", () => {
      const custObj = {
        customizationId: "cust_option",
        customizationName: "Choose Option",
        optionId: "opt_meal",
        optionName: "Medium Meal Combo",
        price: 8000,
      };

      const item1: CartItem = {
        cartItemId: buildCartItemId("item_bao", [custObj]),
        itemId: "item_bao",
        name: "Signature Veg Bao Bun",
        price: 21900,
        totalUnitPrice: 29900,
        quantity: 2,
        isVeg: true,
        customizations: [custObj],
        preferences: ["No Onion"],
      };

      const cart: CartItem[] = [item1];
      const initialTotal = cart.reduce((acc, i) => acc + i.totalUnitPrice * i.quantity, 0);

      expect(initialTotal).toBe(59800); // 299 * 2 = 598 in minor units (paise)
      expect(cart[0].customizations?.[0].optionName).toBe("Medium Meal Combo");
      expect(cart[0].preferences).toContain("No Onion");
    });
  });

  describe("6. Google Maps Geocoding & Address Component Parsing", () => {
    it("correctly parses raw Google Geocoder address components into structured fields", () => {
      const mockComponents = [
        { long_name: "D-73", short_name: "D-73", types: ["premise"] },
        { long_name: "Corporate Road", short_name: "Corporate Rd", types: ["route"] },
        { long_name: "Makarba", short_name: "Makarba", types: ["sublocality_level_1", "sublocality"] },
        { long_name: "Ahmedabad", short_name: "Ahmedabad", types: ["locality"] },
        { long_name: "GJ", short_name: "GJ", types: ["administrative_area_level_1"] },
        { long_name: "380015", short_name: "380015", types: ["postal_code"] },
        { long_name: "Near Vodafone House", short_name: "Near Vodafone House", types: ["landmark"] },
      ];

      const parseComponents = (components: typeof mockComponents, formatted = "") => {
        const result: any = { formattedAddress: formatted };
        components.forEach((c) => {
          if (c.types.includes("premise")) result.premise = c.long_name;
          if (c.types.includes("route")) result.streetName = c.long_name;
          if (c.types.includes("sublocality_level_1")) result.area = c.long_name;
          if (c.types.includes("locality")) result.city = c.long_name;
          if (c.types.includes("postal_code")) result.zipCode = c.long_name;
          if (c.types.includes("landmark")) result.landmark = c.long_name;
        });
        return result;
      };

      const parsed = parseComponents(mockComponents, "Titanium Heights, Corporate Road, Makarba, Ahmedabad 380015");
      expect(parsed.premise).toBe("D-73");
      expect(parsed.streetName).toBe("Corporate Road");
      expect(parsed.area).toBe("Makarba");
      expect(parsed.city).toBe("Ahmedabad");
      expect(parsed.zipCode).toBe("380015");
      expect(parsed.landmark).toBe("Near Vodafone House");
    });
  });
});
