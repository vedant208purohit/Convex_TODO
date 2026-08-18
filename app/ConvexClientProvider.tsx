"use client";

import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ReactNode, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function DynamicConvexProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const dynamicUrl = searchParams.get("convexUrl");
  const convexUrl = dynamicUrl || process.env.NEXT_PUBLIC_CONVEX_URL!;

  const convex = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
      <DynamicConvexProvider>{children}</DynamicConvexProvider>
    </Suspense>
  );
}