import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { StepIndicator } from "@/components/layout/StepIndicator";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BriefForge - AI Packaging Design Brief Generator",
  description:
    "Transform messy product PDFs, Excel specs, and images into structured, verified packaging design briefs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-slate-50 flex">
          {/* Left Fixed Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 ml-64 flex flex-col min-w-0 min-h-screen">
            <StepIndicator />
            <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
