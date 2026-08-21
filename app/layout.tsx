import "./globals.css";
import dynamic from "next/dynamic";

const AppProviders = dynamic(() => import("./AppProviders"), {
  ssr: false,
});

export const metadata = {
  title: "Store POS Application",
  description: "Store POS with Clerk authentication",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
