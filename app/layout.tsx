import "./globals.css";
import AppProviders from "./AppProviders";
import { EB_Garamond, Inter } from "next/font/google";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
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
    <html lang="en" suppressHydrationWarning className={`${ebGaramond.variable} ${inter.variable}`}>
      <body suppressHydrationWarning className="font-sans antialiased text-[#1c1b1b] bg-[#fdf8f7]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
