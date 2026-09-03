"use client";

import { PosShell } from "../../components/PosShell";
import { OrderProcessesView } from "../../components/order-processes/OrderProcessesView";

export default function OrderProcessesPage() {
  return (
    <PosShell title="Settings" subtitle="Order Processes">
      <OrderProcessesView />
    </PosShell>
  );
}
