"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CustomerOrderingHome } from "../../components/customer/CustomerOrderingHome";
import { CustomerLoadingSkeleton } from "../../components/customer/CustomerLoadingSkeleton";

function CustomerOrderCartContent() {
  const searchParams = useSearchParams();

  const qrId = searchParams.get("qr_id") || undefined;
  const tableId = searchParams.get("table_id") || undefined;
  const tableNumber = searchParams.get("table_number") || undefined;
  const tableToken =
    searchParams.get("tableToken") ||
    searchParams.get("token") ||
    searchParams.get("identifier") ||
    undefined;

  return (
    <CustomerOrderingHome
      qrId={qrId}
      tableId={tableId}
      tableNumber={tableNumber}
      identifier={tableToken}
      initialTab="orders"
    />
  );
}

export default function CustomerOrderCartPage() {
  return (
    <Suspense fallback={<CustomerLoadingSkeleton />}>
      <CustomerOrderCartContent />
    </Suspense>
  );
}
