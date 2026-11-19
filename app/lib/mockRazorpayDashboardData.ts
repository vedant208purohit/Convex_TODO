/**
 * Razorpay Payments Dashboard — Mock Development Data
 * Used strictly for Screen 6 frontend implementation and previews.
 *
 * IMPORTANT:
 * DO NOT insert these records into Convex or use as real production transactions.
 * No real API secrets or credentials are stored here.
 */

export interface RazorpayMetricCardData {
  id: string;
  title: string;
  value: string;
  supportingText: string;
  badge?: string;
  icon: string;
}

export interface TrendBarPoint {
  label: string;
  value: number; // 0 to 100 relative
  formattedAmount: string;
  isLatest?: boolean;
}

export interface RazorpayTransactionItem {
  id: string;
  truncatedId: string;
  amount: string;
  customerEmail: string;
  paymentMethod: "UPI" | "Net Banking" | "Card";
  methodIcon: string;
  date: string;
  status: "Success" | "Failed" | "Pending";
  statusIcon: string;
}

export interface RazorpayIntegrationStatusData {
  statusText: string;
  isLive: boolean;
  headline: string;
  description: string;
  maskedKeyId: string;
  maskedSecret: string;
  environment: string;
  webhookSecret: string;
}

export const razorpayDashboardMetrics: RazorpayMetricCardData[] = [
  {
    id: "today-revenue",
    title: "Today's Revenue",
    value: "₹15,000",
    supportingText: "+12% from yesterday",
    icon: "payments",
  },
  {
    id: "successful-payments",
    title: "Successful Payments",
    value: "120",
    badge: "Success",
    supportingText: "98.2% Success Rate",
    icon: "check_circle",
  },
  {
    id: "failed-payments",
    title: "Failed Payments",
    value: "5",
    badge: "Failed",
    supportingText: "Avg. 1.2% failure rate",
    icon: "cancel",
  },
  {
    id: "pending-payments",
    title: "Pending Payments",
    value: "3",
    badge: "Pending",
    supportingText: "Awaiting confirmation",
    icon: "schedule",
  },
];

export const razorpayPaymentTrends: Record<"7D" | "30D" | "1Y", TrendBarPoint[]> = {
  "7D": [
    { label: "Monday", value: 40, formattedAmount: "₹8,000" },
    { label: "Tuesday", value: 60, formattedAmount: "₹12,000" },
    { label: "Wednesday", value: 35, formattedAmount: "₹7,000" },
    { label: "Thursday", value: 80, formattedAmount: "₹16,000" },
    { label: "Friday", value: 55, formattedAmount: "₹11,000" },
    { label: "Saturday", value: 90, formattedAmount: "₹18,000" },
    { label: "Sunday", value: 70, formattedAmount: "₹14,000", isLatest: true },
  ],
  "30D": [
    { label: "Week 1", value: 45, formattedAmount: "₹65,000" },
    { label: "Week 2", value: 70, formattedAmount: "₹98,500" },
    { label: "Week 3", value: 60, formattedAmount: "₹84,000" },
    { label: "Week 4", value: 88, formattedAmount: "₹125,000", isLatest: true },
  ],
  "1Y": [
    { label: "Jan", value: 35, formattedAmount: "₹210,000" },
    { label: "Feb", value: 42, formattedAmount: "₹250,000" },
    { label: "Mar", value: 50, formattedAmount: "₹300,000" },
    { label: "Apr", value: 48, formattedAmount: "₹290,000" },
    { label: "May", value: 65, formattedAmount: "₹390,000" },
    { label: "Jun", value: 58, formattedAmount: "₹345,000" },
    { label: "Jul", value: 72, formattedAmount: "₹430,000" },
    { label: "Aug", value: 68, formattedAmount: "₹410,000" },
    { label: "Sep", value: 78, formattedAmount: "₹470,000" },
    { label: "Oct", value: 85, formattedAmount: "₹510,000" },
    { label: "Nov", value: 90, formattedAmount: "₹550,000" },
    { label: "Dec", value: 95, formattedAmount: "₹590,000", isLatest: true },
  ],
};

export const razorpayRecentTransactions: RazorpayTransactionItem[] = [
  {
    id: "pay_N9S2J8xyz123",
    truncatedId: "pay_N9S2J8...",
    amount: "₹1,200.00",
    customerEmail: "amit.verma@email.com",
    paymentMethod: "UPI",
    methodIcon: "payments",
    date: "Today, 14:22",
    status: "Success",
    statusIcon: "check_circle",
  },
  {
    id: "pay_M8K3L1xyz456",
    truncatedId: "pay_M8K3L1...",
    amount: "₹3,450.00",
    customerEmail: "sarah.j@outlook.com",
    paymentMethod: "Net Banking",
    methodIcon: "account_balance",
    date: "Today, 13:45",
    status: "Success",
    statusIcon: "check_circle",
  },
  {
    id: "pay_K2J4H9xyz789",
    truncatedId: "pay_K2J4H9...",
    amount: "₹850.00",
    customerEmail: "priya.rao@gmail.com",
    paymentMethod: "Card",
    methodIcon: "credit_card",
    date: "Today, 12:10",
    status: "Failed",
    statusIcon: "cancel",
  },
  {
    id: "pay_P5M0Q3xyz012",
    truncatedId: "pay_P5M0Q3...",
    amount: "₹2,100.00",
    customerEmail: "rahul.khanna@biz.in",
    paymentMethod: "UPI",
    methodIcon: "payments",
    date: "Today, 11:30",
    status: "Pending",
    statusIcon: "schedule",
  },
];

export const razorpayIntegrationStatus: RazorpayIntegrationStatusData = {
  statusText: "INTEGRATION STATUS",
  isLive: true,
  headline: "Razorpay is Live",
  description: "Your API keys are active and transactions are flowing seamlessly.",
  maskedKeyId: "rzp_live_••••••••••••Nb0",
  maskedSecret: "••••••••••••••••••••••••",
  environment: "Live Production Mode",
  webhookSecret: "whsec_••••••••••••••••",
};

