import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crew M",
  description: "AI-powered campaign intelligence for Plum",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-1">
                <span className="text-lg font-semibold tracking-tight">Crew M</span>
                <span className="text-xs text-zinc-500 ml-2">Campaign Intelligence</span>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                  Dashboard
                </Link>
                <Link href="/personas" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                  Persona Explorer
                </Link>
                <Link href="/simulator" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                  Campaign Simulator
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
