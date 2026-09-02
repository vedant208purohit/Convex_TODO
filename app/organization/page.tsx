"use client";

import { PosShell } from "../components/PosShell";
import { OrganizationSettings } from "../components/OrganizationSettings";

export default function OrganizationPage() {
  return (
    <PosShell title="Organization" subtitle="Management Portal">
      <OrganizationSettings />
    </PosShell>
  );
}
