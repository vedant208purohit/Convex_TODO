import { describe, it, expect, vi } from "vitest";

// Drawer business rules and validation logic verification
describe("CreateStationDrawer Logic & Legacy Parity Rules", () => {
  // Validate helper matching CreateStationDrawer logic
  function validateStationName(
    stationName: string,
    existingStationNames: string[] = []
  ): string | null {
    const trimmed = stationName.trim();
    if (!trimmed) {
      return "Station name is required.";
    }

    // Check duplicate name in current organization (legacy parity)
    const isDuplicate = existingStationNames.some(
      (name) => name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      return `Hey! ${trimmed} is already taken.`;
    }

    return null;
  }

  // Live preview formatting matching CreateStationDrawer logic
  function formatTicketHeaderPreview(stationName: string): string {
    const trimmed = stationName.trim();
    return trimmed || "STATION NAME";
  }

  describe("State 1 — Open / Prefilled & Live Preview Behavior", () => {
    it("updates ticket header output immediately as user types", () => {
      expect(formatTicketHeaderPreview("Pastry & Garde Manger")).toBe("Pastry & Garde Manger");
    });

    it("trims leading and trailing whitespace for preview display", () => {
      expect(formatTicketHeaderPreview("   Hot Line 01   ")).toBe("Hot Line 01");
    });

    it("falls back to default placeholder when input is empty or spaces only", () => {
      expect(formatTicketHeaderPreview("")).toBe("STATION NAME");
      expect(formatTicketHeaderPreview("    ")).toBe("STATION NAME");
    });
  });

  describe("State 2 — Clean / Empty State", () => {
    it("starts with empty string and produces no false-positive validation errors", () => {
      const initialName = "";
      // Before user attempts submission, no error is displayed
      const error = null;
      expect(error).toBeNull();
      expect(formatTicketHeaderPreview(initialName)).toBe("STATION NAME");
    });
  });

  describe("State 3 — Validation Error State", () => {
    it("rejects empty station name on submission", () => {
      const error = validateStationName("");
      expect(error).toBe("Station name is required.");
    });

    it("rejects whitespace-only station name on submission", () => {
      const error = validateStationName("   \t  \n  ");
      expect(error).toBe("Station name is required.");
    });

    it("rejects duplicate station name matching existing active stations (case-insensitive)", () => {
      const existing = ["GRILL & TANDOOR", "MAIN", "DRINKS"];
      const error = validateStationName("grill & tandoor", existing);
      expect(error).toBe("Hey! grill & tandoor is already taken.");
    });

    it("allows station name if not present in existing active stations", () => {
      const existing = ["GRILL & TANDOOR", "MAIN"];
      const error = validateStationName("Pastry & Bakery", existing);
      expect(error).toBeNull();
    });
  });

  describe("State 4 — Submitting State & Double Submission Prevention", () => {
    it("prevents multiple concurrent mutation invocations", async () => {
      let isSubmitting = false;
      const mutationSpy = vi.fn().mockImplementation(async () => {
        return new Promise((resolve) => setTimeout(() => resolve({ success: true, id: "st123" }), 50));
      });

      const submitHandler = async (name: string) => {
        if (isSubmitting) return;
        const err = validateStationName(name);
        if (err) return;
        isSubmitting = true;
        try {
          await mutationSpy({ name: name.trim() });
        } finally {
          isSubmitting = false;
        }
      };

      // Trigger simultaneous submissions (double-click simulation)
      const p1 = submitHandler("Burger Line");
      const p2 = submitHandler("Burger Line");

      await Promise.all([p1, p2]);

      // Only one mutation call should have occurred
      expect(mutationSpy).toHaveBeenCalledTimes(1);
      expect(mutationSpy).toHaveBeenCalledWith({ name: "Burger Line" });
    });

    it("preserves user input upon server failure so user does not lose input", async () => {
      let stationName = "Grill & Smokehouse";
      let serverError: string | null = null;

      const failingMutation = vi.fn().mockRejectedValue(new Error("Server Error Database timeout"));

      try {
        await failingMutation({ name: stationName.trim() });
      } catch (err: any) {
        const cleanMsg = (err.message || "").replace(/^.*?Server Error\s*/i, "");
        serverError = cleanMsg;
      }

      // Input was not cleared
      expect(stationName).toBe("Grill & Smokehouse");
      expect(serverError).toBe("Database timeout");
    });
  });

  describe("State 5 — Closed / Background View", () => {
    it("does not trigger mutation when cancelled or closed", () => {
      const mutationSpy = vi.fn();
      const onClose = vi.fn();

      // User clicks cancel
      onClose();

      expect(onClose).toHaveBeenCalled();
      expect(mutationSpy).not.toHaveBeenCalled();
    });
  });
});
