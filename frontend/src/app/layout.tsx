import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { MobileBar, Sidebar } from "@/components/layout/Sidebar";
import { ContextBar, RouteFade } from "@/components/layout/ContextBar";
import { BusyToast } from "@/components/shared/Notice";
import { ChatPanel } from "@/components/chat/ChatPanel";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "BriefForge",
  description: "Turns packaging artwork, content sheets and notes into a checked, source-linked design brief.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="sr-only z-50 rounded bg-talker px-3 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Skip to content
        </a>
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-col lg:pl-60">
          <MobileBar />
          <ContextBar />
          <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 md:px-6 md:py-8">
            <RouteFade>{children}</RouteFade>
          </main>
        </div>
        <ChatPanel />
        <BusyToast />
      </body>
    </html>
  );
}
