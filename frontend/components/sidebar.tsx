"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Beaker, Users, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/simulate", label: "Simulator", icon: Beaker },
  { href: "/personas", label: "Personas", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-[220px] border-r border-border/60 bg-sidebar flex flex-col z-40">
      <div className="h-16 flex items-center px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="text-primary-foreground text-sm font-semibold tracking-tight">M</span>
          </div>
          <div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">Crew M</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 pt-2 space-y-0.5">
        <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.08em] px-3 pb-2 pt-2">Navigation</p>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 ${
                isActive
                  ? "bg-primary/8 text-primary font-medium"
                  : "text-foreground/50 hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className={`w-[18px] h-[18px] ${isActive ? "text-primary" : "text-foreground/40"}`} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-foreground/50 hover:text-foreground hover:bg-muted/60 transition-all duration-200"
        >
          <Settings className="w-[18px] h-[18px] text-foreground/40" strokeWidth={1.75} />
          Settings
        </Link>
        <div className="px-3 pt-3 pb-1 border-t border-border/40">
          <p className="text-[11px] text-muted-foreground/70">
            Plum Product Marketing
          </p>
        </div>
      </div>
    </aside>
  );
}
