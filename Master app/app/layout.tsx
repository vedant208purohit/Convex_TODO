import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";

export const metadata = {
  title: "Convex Master Control Plane",
  description: "Company provisioning and management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
