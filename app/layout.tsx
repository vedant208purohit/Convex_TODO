import "./globals.css";
import AppProviders from "./AppProviders";

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
