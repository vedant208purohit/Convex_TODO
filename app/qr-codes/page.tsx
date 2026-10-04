"use client";

import { PosShell } from "../components/PosShell";
import { OrganizationQrManagement } from "../components/OrganizationQrManagement";

export default function QrCodesPage() {
  return (
    <PosShell title="QR Management" subtitle="PREST Operations">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 min-w-0">
        <OrganizationQrManagement />
      </div>
    </PosShell>
  );
}
