"use client";

import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ReactNode, useMemo } from "react";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
  const convex = useMemo(() => new ConvexReactClient(convexUrl || "https://dummy.convex.cloud"), [convexUrl]);

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
