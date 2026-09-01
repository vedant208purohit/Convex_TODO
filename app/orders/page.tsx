"use client";

import { PosShell } from "../components/PosShell";
import { PosSeatingSection } from "../components/PosSeatingSection";

export default function OrdersPage() {
  return (
    <PosShell title="Orders & Seating" subtitle="Cashier & Waiter Portal">
      <div className="space-y-6">
        <PosSeatingSection />
      </div>
    </PosShell>
  );
}
