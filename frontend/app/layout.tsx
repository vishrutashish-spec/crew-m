import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

// Inter carries body copy; Vollkorn is loaded from /public/fonts via @font-face
// in globals.css and owns every heading, figure and chart label.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crew M",
  description: "Campaign intelligence for Plum product marketing",
};

// Applies the saved theme (or the OS preference) before first paint, so
// neither theme ever flashes. Runs synchronously during HTML parsing.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("crewm-theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <Sidebar />
        <main className="ml-[236px] min-h-screen">
          <div className="mx-auto w-full max-w-[1500px] px-8 xl:px-12 py-9">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
