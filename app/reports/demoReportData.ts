/**
 * Demo and Mock Data Engine for Reports Module
 * Provides realistic restaurant test records so that all report tables,
 * metrics, charts, pagination, and exports display complete data during testing.
 */

export interface DemoItem {
  _id: string;
  name: string;
  pricePaise: number;
  categoryName: string;
  categoryId: string;
}

export const DEMO_CATEGORIES = [
  {
    _id: "cat_starters",
    name: "Starters",
    category_name: "Starters",
    items: [
      { id: "item_pt", name: "Paneer Tikka", pricePaise: 28000 },
      { id: "item_sr", name: "Veg Spring Rolls", pricePaise: 22000 },
      { id: "item_cc", name: "Crispy Corn Salt & Pepper", pricePaise: 19000 },
      { id: "item_ct", name: "Murgh Malai Tikka", pricePaise: 34000 },
    ],
  },
  {
    _id: "cat_main_course",
    name: "Main Course",
    category_name: "Main Course",
    items: [
      { id: "item_pbm", name: "Paneer Butter Masala", pricePaise: 32000 },
      { id: "item_dm", name: "Dal Makhani Grand", pricePaise: 26000 },
      { id: "item_bc", name: "Classic Butter Chicken", pricePaise: 38000 },
      { id: "item_kp", name: "Kadhai Paneer Special", pricePaise: 31000 },
    ],
  },
  {
    _id: "cat_breads",
    name: "Indian Breads",
    category_name: "Indian Breads",
    items: [
      { id: "item_bn", name: "Butter Naan", pricePaise: 6000 },
      { id: "item_gn", name: "Garlic Naan", pricePaise: 8000 },
      { id: "item_tr", name: "Tandoori Roti", pricePaise: 3500 },
      { id: "item_lp", name: "Lachha Paratha", pricePaise: 7000 },
    ],
  },
  {
    _id: "cat_rice",
    name: "Rice & Biryani",
    category_name: "Rice & Biryani",
    items: [
      { id: "item_jr", name: "Jeera Basmati Rice", pricePaise: 18000 },
      { id: "item_vdb", name: "Awadhi Veg Dum Biryani", pricePaise: 29000 },
      { id: "item_cb", name: "Hyderabadi Chicken Biryani", pricePaise: 36000 },
    ],
  },
  {
    _id: "cat_beverages",
    name: "Beverages & Mocktails",
    category_name: "Beverages & Mocktails",
    items: [
      { id: "item_vm", name: "Classic Virgin Mojito", pricePaise: 15000 },
      { id: "item_ccoffee", name: "Iced Cold Coffee with Gelato", pricePaise: 16000 },
      { id: "item_fls", name: "Fresh Mint Lime Soda", pricePaise: 9000 },
      { id: "item_mc", name: "Special Masala Chai", pricePaise: 5000 },
    ],
  },
  {
    _id: "cat_desserts",
    name: "Desserts",
    category_name: "Desserts",
    items: [
      { id: "item_gj", name: "Gulab Jamun with Rabri", pricePaise: 12000 },
      { id: "item_sb", name: "Sizzling Chocolate Brownie", pricePaise: 21000 },
      { id: "item_rm", name: "Kesar Pista Rasmalai", pricePaise: 13000 },
    ],
  },
];

export const DEMO_ITEMS: DemoItem[] = DEMO_CATEGORIES.flatMap((c) =>
  c.items.map((it) => ({
    _id: it.id,
    name: it.name,
    pricePaise: it.pricePaise,
    categoryName: c.name,
    categoryId: c._id,
  })),
);

export const DEMO_LAYOUTS = [
  { _id: "lay_main", name: "Main Dining Area", totalTables: 6 },
  { _id: "lay_ac", name: "AC Family Banquet", totalTables: 4 },
  { _id: "lay_rooftop", name: "Rooftop Garden Terrace", totalTables: 4 },
  { _id: "lay_bar", name: "Lounge & Bar", totalTables: 2 },
];

export const DEMO_TABLES = [
  { _id: "tbl_1", number: 1, layoutId: "lay_main", tableName: "Table 1", capacity: 4, currentOrderId: null },
  { _id: "tbl_2", number: 2, layoutId: "lay_main", tableName: "Table 2", capacity: 4, currentOrderId: "demo_active_2" },
  { _id: "tbl_3", number: 3, layoutId: "lay_main", tableName: "Table 3", capacity: 6, currentOrderId: null },
  { _id: "tbl_4", number: 4, layoutId: "lay_main", tableName: "Table 4", capacity: 2, currentOrderId: null },
  { _id: "tbl_5", number: 5, layoutId: "lay_main", tableName: "Table 5", capacity: 8, currentOrderId: null },
  { _id: "tbl_6", number: 6, layoutId: "lay_main", tableName: "Table 6", capacity: 4, currentOrderId: null },
  { _id: "tbl_7", number: 7, layoutId: "lay_ac", tableName: "Table 7", capacity: 6, currentOrderId: "demo_active_7" },
  { _id: "tbl_8", number: 8, layoutId: "lay_ac", tableName: "Table 8", capacity: 4, currentOrderId: null },
  { _id: "tbl_9", number: 9, layoutId: "lay_ac", tableName: "Table 9", capacity: 8, currentOrderId: null },
  { _id: "tbl_10", number: 10, layoutId: "lay_rooftop", tableName: "Table 10", capacity: 4, currentOrderId: null },
  { _id: "tbl_11", number: 11, layoutId: "lay_rooftop", tableName: "Table 11", capacity: 4, currentOrderId: null },
  { _id: "tbl_12", number: 12, layoutId: "lay_rooftop", tableName: "Table 12", capacity: 6, currentOrderId: null },
  { _id: "tbl_13", number: 13, layoutId: "lay_bar", tableName: "Bar Table 1", capacity: 2, currentOrderId: null },
  { _id: "tbl_14", number: 14, layoutId: "lay_bar", tableName: "Bar Table 2", capacity: 2, currentOrderId: null },
];

export const DEMO_PROCESSES = [
  { _id: "proc_1", name: "Order Placed", stepNumber: 1, color: "#3b82f6", targetMinutes: 3 },
  { _id: "proc_2", name: "Kitchen Prep", stepNumber: 2, color: "#f59e0b", targetMinutes: 15 },
  { _id: "proc_3", name: "Food Plated", stepNumber: 3, color: "#8b5cf6", targetMinutes: 4 },
  { _id: "proc_4", name: "Served to Table", stepNumber: 4, color: "#10b981", targetMinutes: 2 },
];

export const DEMO_CUSTOMERS = [
  { name: "Rahul Sharma", phone: "+91 98765 43210", email: "rahul.sharma@example.com", id: "cust_1" },
  { name: "Priya Patel", phone: "+91 98234 56789", email: "priya.patel@example.com", id: "cust_2" },
  { name: "Amit Verma", phone: "+91 98112 23344", email: "amit.verma@example.com", id: "cust_3" },
  { name: "Sneha Rao", phone: "+91 98998 87766", email: "sneha.rao@example.com", id: "cust_4" },
  { name: "Vikram Singh", phone: "+91 97112 24455", email: "vikram.singh@example.com", id: "cust_5" },
  { name: "Ananya Iyer", phone: "+91 96554 43322", email: "ananya.iyer@example.com", id: "cust_6" },
  { name: "Deepak Mehta", phone: "+91 95443 32211", email: "deepak.mehta@example.com", id: "cust_7" },
  { name: "Kavita Nair", phone: "+91 94332 21100", email: "kavita.nair@example.com", id: "cust_8" },
  { name: "Rohan Joshi", phone: "+91 93221 10099", email: "rohan.joshi@example.com", id: "cust_9" },
  { name: "Meera Kulkarni", phone: "+91 92110 09988", email: "meera.k@example.com", id: "cust_10" },
];

/**
 * Generates realistic restaurant test orders across the specified date range.
 * Always returns rich, structured orders so all tables are populated for testing.
 */
export function generateDemoOrders(startDate: Date, endDate: Date): any[] {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Number of days to generate
  const totalDays = Math.max(1, Math.min(31, Math.ceil((endMs - startMs) / dayMs)));
  const demoOrders: any[] = [];

  const paymentModes = ["Cash", "UPI", "Credit Card", "Debit Card"];
  const paymentModeWeights = [0.4, 0.35, 0.15, 0.1]; // 40% Cash, 35% UPI, 15% CC, 10% DC

  let globalOrderSeq = 1001;

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const currentDayTs = startMs + dayOffset * dayMs;
    const currentDayDate = new Date(currentDayTs);

    // Generate 7 to 14 orders per day
    const ordersTodayCount = 7 + ((dayOffset * 3 + 2) % 8);

    for (let ordIdx = 0; ordIdx < ordersTodayCount; ordIdx++) {
      globalOrderSeq += 1;
      const orderNum = `ORD-2025-${globalOrderSeq}`;
      const tokenNum = `${ordIdx + 1}`;

      // Distribute hours: lunch rush (12:30 to 15:30) or dinner rush (19:00 to 22:30)
      const isLunch = ordIdx % 2 === 0;
      const hour = isLunch ? 12 + (ordIdx % 3) : 19 + (ordIdx % 4);
      const minute = (ordIdx * 17) % 60;
      const second = (ordIdx * 23) % 60;

      const orderDate = new Date(
        currentDayDate.getFullYear(),
        currentDayDate.getMonth(),
        currentDayDate.getDate(),
        hour,
        minute,
        second,
      );
      const createdAt = orderDate.getTime();
      const serviceDurationMinutes = 25 + ((ordIdx * 7) % 35); // 25 to 60 mins
      const updatedAt = createdAt + serviceDurationMinutes * 60 * 1000;

      // Select customer
      const cust = DEMO_CUSTOMERS[(dayOffset * 2 + ordIdx) % DEMO_CUSTOMERS.length];

      // Select table & layout
      const table = DEMO_TABLES[ordIdx % DEMO_TABLES.length];
      const layout = DEMO_LAYOUTS.find((l) => l._id === table.layoutId) || DEMO_LAYOUTS[0];

      // Select 2 to 4 items
      const numItems = 2 + ((ordIdx + dayOffset) % 3);
      const orderItems: any[] = [];
      let subtotal = 0;

      for (let it = 0; it < numItems; it++) {
        const itemIndex = (dayOffset * 3 + ordIdx * 2 + it) % DEMO_ITEMS.length;
        const catalogItem = DEMO_ITEMS[itemIndex];
        const qty = 1 + (it % 2 === 0 ? 1 : 0);
        const itemGross = catalogItem.pricePaise * qty;
        subtotal += itemGross;

        orderItems.push({
          itemId: catalogItem._id,
          name: catalogItem.name,
          categoryName: catalogItem.categoryName,
          price: catalogItem.pricePaise,
          unitPrice: catalogItem.pricePaise,
          quantity: qty,
          totalPrice: itemGross,
          notes: "",
        });
      }

      // Tax (5% GST)
      const taxTotal = Math.round(subtotal * 0.05);

      // Discount (1 in 4 orders gets 10% promotional discount)
      const hasDiscount = ordIdx % 4 === 1;
      const discountAmount = hasDiscount ? Math.round(subtotal * 0.1) : 0;
      const totalAmount = subtotal + taxTotal - discountAmount;

      // Select payment mode based on weight
      const randMode = (ordIdx * 7 + dayOffset * 5) % 100;
      let paymentMode = "Cash";
      if (randMode < 40) paymentMode = "Cash";
      else if (randMode < 75) paymentMode = "UPI";
      else if (randMode < 90) paymentMode = "Credit Card";
      else paymentMode = "Debit Card";

      // Status
      const isCancelled = ordIdx === 9 && dayOffset % 3 === 0;
      const orderStatusName = isCancelled ? "Cancelled" : "Completed";
      const paymentStatus = isCancelled ? "Refunded" : "Completed";

      // Order Type
      const orderType = ordIdx % 6 === 0 ? "Takeaway" : ordIdx % 7 === 0 ? "Delivery" : "DineIn";

      demoOrders.push({
        _id: `demo_order_${globalOrderSeq}`,
        orderNumber: orderNum,
        tokenNumber: tokenNum,
        orderType,
        orderStatusName,
        paymentStatus,
        paymentMode,
        paymentMethod: paymentMode,
        createdAt,
        updatedAt,
        isCompleted: !isCancelled,
        isRejected: isCancelled,
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerEmail: cust.email,
        tableId: table._id,
        tableNumber: String(table.number),
        tableName: table.tableName,
        layoutId: layout._id,
        layoutName: layout.name,
        items: orderItems,
        item_count: orderItems.reduce((acc, i) => acc + i.quantity, 0),
        subtotal,
        taxTotal,
        discountAmount,
        totalAmount,
        payments: [
          {
            mode: paymentMode,
            paymentMode,
            payAmount: totalAmount,
            amount: totalAmount,
            status: isCancelled ? "Refunded" : "Completed",
          },
        ],
      });
    }
  }

  // Sort descending by createdAt
  return demoOrders.sort((a, b) => b.createdAt - a.createdAt);
}
