import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Convex Master Control Plane",
  description: "Company provisioning and management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const app = <ConvexClientProvider>{children}</ConvexClientProvider>;

  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {publishableKey ? <ClerkProvider publishableKey={publishableKey}>{app}</ClerkProvider> : app}
      </body>
    </html>
  );
}
