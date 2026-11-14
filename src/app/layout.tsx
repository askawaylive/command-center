import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PixelClock } from "@/components/PixelClock";
import { QuickChat } from "@/components/QuickChat";
import { FreshPages } from "@/components/FreshAfterEdits";
import { Toaster } from "@/components/Toast";
import { getBusinesses } from "@/lib/businesses";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
        <div className="flex h-screen overflow-hidden">
          <Sidebar businesses={businesses} signOut={Boolean(process.env.APP_PASSWORD)} />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Phones: the sidebar is hidden, so the toggle and clock sit in a top bar instead. */}
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-4 md:hidden">
              <ThemeToggle />
              <PixelClock />
            </div>
            <main className="flex-1 overflow-y-auto scroll-thin">
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
