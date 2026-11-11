import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { getBusinesses } from "@/lib/businesses";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Command Center",
  description: "One place for every business: plan, track, and ask.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const businesses = getBusinesses();
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar businesses={businesses} />
          <main className="flex-1 overflow-y-auto scroll-thin">{children}</main>
        </div>
      </body>
    </html>
  );
}
