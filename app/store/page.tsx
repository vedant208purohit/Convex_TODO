"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CustomerOrderingHome } from "../components/customer/CustomerOrderingHome";
import { CustomerLoadingSkeleton } from "../components/customer/CustomerLoadingSkeleton";

function CustomerStoreContent() {
  const searchParams = useSearchParams();

  const qrId = searchParams.get("qr_id") || undefined;
  const tableId = searchParams.get("table_id") || undefined;
  const tableNumber = searchParams.get("table_number") || undefined;
  const identifier = searchParams.get("identifier") || searchParams.get("token") || undefined;

  return (
    <CustomerOrderingHome
      qrId={qrId}
      tableId={tableId}
      tableNumber={tableNumber}
      identifier={identifier}
    />
  );
}

export default function CustomerStorePage() {
  return (
    <Suspense fallback={<CustomerLoadingSkeleton />}>
      <CustomerStoreContent />
    </Suspense>
  );
}
