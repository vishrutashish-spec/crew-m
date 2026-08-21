"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FlaskConical,
  Users,
  Target,
  BarChart3,
  Lightbulb,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/simulate", label: "Simulate", icon: FlaskConical },
  { href: "/audience", label: "Build Audience", icon: Target },
  { href: "/personas", label: "Personas", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: BarChart3 },
  { href: "/insights", label: "Insights", icon: Lightbulb },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-60 border-r border-border bg-sidebar flex flex-col z-40">
      <div className="h-14 flex items-center px-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-plum flex items-center justify-center">
            <span className="text-plum-foreground text-xs font-bold">M</span>
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight text-foreground">Crew M</span>
            <span className="text-[10px] text-muted-foreground block leading-none">Campaign Intelligence</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <Settings className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          Settings
        </Link>
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] text-muted-foreground leading-tight">
            Plum Product Marketing
          </p>
          <p className="text-[10px] text-muted-foreground/60 leading-tight">
            Synthetic data mode
          </p>
        </div>
      </div>
    </aside>
  );
}
