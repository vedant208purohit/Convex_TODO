"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { KdsTerminalView } from "../../../components/kds/KdsTerminalView";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface StationTerminalPageProps {
  params: Promise<{ id: string }>;
}

export default function StationTerminalPage({ params }: StationTerminalPageProps) {
  const resolvedParams = use(params);
  const stationId = resolvedParams.id as Id<"stations">;
  const router = useRouter();

  // 1. Organization Context
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  return (
    <KdsTerminalView
      stationId={stationId}
      organizationId={activeOrg?._id}
      onBack={() => router.push("/kds")}
    />
  );
}
