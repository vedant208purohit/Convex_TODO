"use client";

import React, { use } from "react";
import { CustomerOrderingHome } from "../../components/customer/CustomerOrderingHome";

export default function CustomerOrderTokenPage({
  params,
}: {
  params: Promise<{ tableToken: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.tableToken;

  return (
    <CustomerOrderingHome
      identifier={token}
    />
  );
}
