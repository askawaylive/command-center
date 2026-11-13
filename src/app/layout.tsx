import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className={`${sans.variable} ${serif.variable}`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar businesses={businesses} signOut={Boolean(process.env.APP_PASSWORD)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-12 shrink-0 items-center justify-end border-b border-line px-4">
              <ThemeToggle />
            </div>
            <main className="flex-1 overflow-y-auto scroll-thin">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
