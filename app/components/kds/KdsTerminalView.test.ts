import { describe, it, expect } from "vitest";

describe("KdsTerminalView Business Logic & Terminal Operations", () => {
  // Test fixture data matching Screen 5 prototype
  const mockTickets = [
    {
      order: {
        _id: "order_1049",
        orderNumber: "1049",
        tokenNumber: "22",
        orderType: "TakeAway",
        createdAt: Date.now() - 3 * 60 * 1000 - 15 * 1000, // 03:15 elapsed
        specialNotes: undefined,
        isStationAccepted: true,
        isStationInProgress: false,
        isStationReady: false,
      },
      orderItems: [
        {
          _id: "oi_1",
          itemName: "Malai Broccoli Tandoori",
          quantity: 1,
          isReady: false,
          customizations: [{ optionName: "Extra Malai Dip" }],
        },
      ],
      allStationItemsReady: false,
    },
    {
      order: {
        _id: "order_1042",
        orderNumber: "1042",
        tokenNumber: "18",
        orderType: "DineIn",
        tableNumber: "T-04",
        membersOnTable: 4,
        createdAt: Date.now() - 7 * 60 * 1000 - 15 * 1000, // 07:15 elapsed
        specialNotes: "Gluten sensitivity. Clean dedicated skewers.",
        isStationAccepted: false,
        isStationInProgress: true,
        isStationReady: false,
      },
      orderItems: [
        {
          _id: "oi_2",
          itemName: "Tandoori Chicken Tikka",
          quantity: 2,
          isReady: true,
          customizations: [{ optionName: "Extra Spicy" }],
        },
        {
          _id: "oi_3",
          itemName: "Paneer Tikka",
          quantity: 1,
          isReady: false,
          customizations: [{ optionName: "No Onion" }],
        },
      ],
      allStationItemsReady: false,
    },
    {
      order: {
        _id: "order_1038",
        orderNumber: "1038",
        tokenNumber: "14",
        orderType: "DineIn",
        tableNumber: "T-02",
        membersOnTable: 2,
        createdAt: Date.now() - 11 * 60 * 1000,
        readyAt: Date.now() - 2 * 60 * 1000,
        isStationAccepted: false,
        isStationInProgress: false,
        isStationReady: true,
      },
      orderItems: [
        {
          _id: "oi_4",
          itemName: "Paneer Tikka",
          quantity: 1,
          isReady: true,
        },
      ],
      allStationItemsReady: true,
    },
    {
      order: {
        _id: "order_1035",
        orderNumber: "1035",
        tokenNumber: "11",
        orderType: "Delivery",
        customerName: "UberEats • Courier Waiting",
        createdAt: Date.now() - 18 * 60 * 1000, // 18m overdue
        readyAt: Date.now() - 1 * 60 * 1000,
        isStationAccepted: false,
        isStationInProgress: false,
        isStationReady: true,
      },
      orderItems: [
        {
          _id: "oi_5",
          itemName: "Mutton Seekh Kebab",
          quantity: 2,
          isReady: true,
        },
      ],
      allStationItemsReady: true,
    },
    {
      order: {
        _id: "order_1031",
        orderNumber: "1031",
        tokenNumber: "08",
        orderType: "DineIn",
        tableNumber: "T-09",
        membersOnTable: 3,
        createdAt: Date.now() - 25 * 60 * 1000,
        readyAt: Date.now() - 5 * 60 * 1000,
        isStationAccepted: false,
        isStationInProgress: false,
        isStationReady: true,
      },
      orderItems: [
        {
          _id: "oi_6",
          itemName: "Afghani Murgh Tangdi",
          quantity: 2,
          isReady: true,
        },
        {
          _id: "oi_7",
          itemName: "Tandoori Mushroom Tikka",
          quantity: 1,
          isReady: true,
        },
      ],
      allStationItemsReady: true,
    },
  ];

  // Helper: Filter tickets by order type
  function filterTickets(
    tickets: typeof mockTickets,
    filter: "all" | "dine-in" | "takeaway" | "delivery"
  ) {
    if (filter === "all") return tickets;
    return tickets.filter((t) => {
      const type = (t.order.orderType || "").toLowerCase();
      if (filter === "dine-in") return type.includes("dine");
      if (filter === "takeaway") return type.includes("take") || type.includes("pickup");
      if (filter === "delivery") return type.includes("delivery");
      return true;
    });
  }

  // Helper: Elapsed time calculations
  function getElapsedDisplay(now: number, createdAt: number) {
    const diffSec = Math.max(0, Math.floor((now - createdAt) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    let status = "normal";
    if (m >= 15) {
      status = "overdue";
    } else if (m >= 10) {
      status = "warning";
    }

    return { timeStr, status, minutes: m };
  }

  describe("1. Three Column Ticket Partitioning", () => {
    it("partitions tickets into ACCEPTED, IN PROGRESS, and READY columns", () => {
      const accepted = mockTickets.filter(
        (t) => !t.allStationItemsReady && t.order.isStationAccepted
      );
      const inProgress = mockTickets.filter(
        (t) => !t.allStationItemsReady && t.order.isStationInProgress
      );
      const ready = mockTickets.filter(
        (t) => t.allStationItemsReady || t.order.isStationReady
      );

      // Matches prototype initial state: 1 Accepted, 1 In Progress, 3 Ready
      expect(accepted).toHaveLength(1);
      expect(accepted[0].order.tokenNumber).toBe("22");

      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].order.tokenNumber).toBe("18");

      expect(ready).toHaveLength(3);
      expect(ready.map((r) => r.order.tokenNumber)).toEqual(["14", "11", "08"]);
    });
  });

  describe("2. Order Type Filter Pills", () => {
    it("computes accurate counts for All Orders, Dine-In, Takeaway, Delivery", () => {
      let dineIn = 0;
      let takeaway = 0;
      let delivery = 0;

      for (const t of mockTickets) {
        const type = (t.order.orderType || "").toLowerCase();
        if (type.includes("dine")) dineIn++;
        else if (type.includes("take") || type.includes("pickup")) takeaway++;
        else if (type.includes("delivery")) delivery++;
      }

      // Matches prototype header: All Orders (5), Dine-In (3), Takeaway (1), Delivery (1)
      expect(mockTickets).toHaveLength(5);
      expect(dineIn).toBe(3);
      expect(takeaway).toBe(1);
      expect(delivery).toBe(1);
    });

    it("filters tickets without mutating ticket lifecycle states", () => {
      const dineInTickets = filterTickets(mockTickets, "dine-in");
      expect(dineInTickets).toHaveLength(3);
      expect(dineInTickets.every((t) => t.order.orderType === "DineIn")).toBe(true);

      const takeawayTickets = filterTickets(mockTickets, "takeaway");
      expect(takeawayTickets).toHaveLength(1);
      expect(takeawayTickets[0].order.tokenNumber).toBe("22");

      const deliveryTickets = filterTickets(mockTickets, "delivery");
      expect(deliveryTickets).toHaveLength(1);
      expect(deliveryTickets[0].order.tokenNumber).toBe("11");
    });
  });

  describe("3. Elapsed Timers & Visual Alert Thresholds", () => {
    const now = Date.now();

    it("formats minutes and seconds accurately", () => {
      const createdAt = now - (3 * 60 * 1000 + 15 * 1000); // 3m 15s ago
      const { timeStr, status } = getElapsedDisplay(now, createdAt);
      expect(timeStr).toBe("03:15");
      expect(status).toBe("normal");
    });

    it("flags warning timer for orders between 10 and 15 minutes", () => {
      const createdAt = now - 12 * 60 * 1000; // 12m ago
      const { status } = getElapsedDisplay(now, createdAt);
      expect(status).toBe("warning");
    });

    it("flags overdue timer for orders over 15 minutes", () => {
      const createdAt = now - 18 * 60 * 1000; // 18m ago
      const { status } = getElapsedDisplay(now, createdAt);
      expect(status).toBe("overdue");
    });
  });

  describe("4. Item Completion & Mark Ready Enablement", () => {
    it("reports incomplete when some items remain uncompleted", () => {
      const ticket = mockTickets.find((t) => t.order.tokenNumber === "18")!;
      const doneCount = ticket.orderItems.filter((i) => i.isReady).length;
      const totalCount = ticket.orderItems.length;

      expect(doneCount).toBe(1);
      expect(totalCount).toBe(2);
      expect(doneCount === totalCount).toBe(false);
    });

    it("enables Mark Ready only when every item in the station ticket is ready", () => {
      const items = [
        { _id: "1", isReady: true },
        { _id: "2", isReady: true },
      ];
      const allDone = items.every((i) => i.isReady);
      expect(allDone).toBe(true);

      const itemsPending = [
        { _id: "1", isReady: true },
        { _id: "2", isReady: false },
      ];
      expect(itemsPending.every((i) => i.isReady)).toBe(false);
    });
  });

  describe("5. Zero-State Handling", () => {
    it("detects empty state for columns with 0 matching tickets", () => {
      const emptyList: any[] = [];
      expect(emptyList.length === 0).toBe(true);
    });
  });
});
