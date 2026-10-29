"use client";

import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./ConvexClientProvider";
import GlobalOrderAutoPrinter from "./components/GlobalOrderAutoPrinter";
import { ReactNode } from "react";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <GlobalOrderAutoPrinter />
        {children}
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
