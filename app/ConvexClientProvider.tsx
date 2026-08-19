"use client";

import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ReactNode, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function DynamicConvexProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const dynamicUrl = searchParams.get("convexUrl");
  const convexUrl = dynamicUrl || process.env.NEXT_PUBLIC_CONVEX_URL;

  const convex = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!convex) {
    return (
      <div style={{ padding: 20, color: "#ef4444", fontFamily: "sans-serif" }}>
        <h2>Convex URL missing</h2>
        <p>
          Please ensure <code>.env.local</code> is populated with <code>NEXT_PUBLIC_CONVEX_URL</code> or pass <code>?convexUrl=...</code> in the address bar.
        </p>
      </div>
    );
  }

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