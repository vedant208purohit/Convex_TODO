"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { ReactNode, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function DynamicConvexProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dynamicUrl = mounted ? searchParams.get("convexUrl") : null;
  const convexUrl = dynamicUrl || (mounted ? process.env.NEXT_PUBLIC_CONVEX_URL : null);

  const convex = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!convex) {
    return (
      <div style={{ padding: 20, color: "#ef4444", fontFamily: "sans-serif" }}>
        <h2>Loading POS deployment...</h2>
        <p>Please wait while the selected Convex deployment is resolved.</p>
      </div>
    );
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
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
