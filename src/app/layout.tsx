import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { QuickChat } from "@/components/QuickChat";
import { FreshPages } from "@/components/FreshAfterEdits";
import { Toaster } from "@/components/Toast";
import { getBusinesses } from "@/lib/businesses";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f5f0e8" };

export const metadata: Metadata = {
  title: "Command Center",
  description: "One place for every business: plan, track, and ask.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const businesses = await getBusinesses();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className={sans.variable}>
        <div className="flex h-dvh overflow-hidden">
          <Sidebar businesses={businesses} signOut={Boolean(process.env.APP_PASSWORD)} />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Phones: the sidebar is hidden, so the toggle and clock sit in a top bar instead. */}
            <MobileNav businesses={businesses} signOut={Boolean(process.env.APP_PASSWORD)} />
            <main className="flex-1 overflow-y-auto scroll-thin pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
              <FreshPages>{children}</FreshPages>
            </main>
          </div>
          <QuickChat />
          <Toaster />
        </div>
      </body>
    </html>
  );
}
