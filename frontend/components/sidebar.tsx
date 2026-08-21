"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/simulate", label: "Campaign Simulator", icon: SimulatorIcon },
  { href: "/personas", label: "Persona Explorer", icon: PersonasIcon },
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
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon active={isActive} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150"
        >
          <SettingsIcon active={false} />
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

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className={`flex-shrink-0 transition-transform duration-150 ${active ? "scale-110" : ""}`}>
      <path fillRule="evenodd" clipRule="evenodd" d="M1.5.499939c-.552285 0-1 .447715-1 1.000001v6c0 .55228.447715 1 1 1h4c.55229 0 1-.44772 1-1v-6c0-.552286-.44771-1.000001-1-1.000001h-4Zm6 1.000001c0-.552286.44772-1.000001 1-1.000001h4c.5523 0 1 .447715 1 1.000001v2.01c0 .55228-.4477 1-1 1h-4c-.55228 0-1-.44772-1-1v-2.01Zm0 5c0-.55229.44772-1 1-1h4c.5523 0 1 .44771 1 1v5.99996c0 .5523-.4477 1-1 1h-4c-.55228 0-1-.4477-1-1V6.49994Zm-7 3.98996c0-.55226.447715-.99997 1-.99997h4c.55229 0 1 .44771 1 .99997v2.01c0 .5523-.44771 1-1 1h-4c-.552285 0-1-.4477-1-1v-2.01Z" fill="url(#dash_grad)" />
      <defs>
        <linearGradient id="dash_grad" x1="13.456" x2="-1.939" y1="13.503" y2="4.843" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff51e3" />
          <stop offset="1" stopColor="#1b4dff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SimulatorIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className={`flex-shrink-0 transition-transform duration-150 ${active ? "scale-110" : ""}`}>
      <path fillRule="evenodd" clipRule="evenodd" d="M4.75.499939c-.55229 0-1 .447715-1 1.000001v4c0 .55228.44772 1 1 1h1.5v.75H3c-.9665 0-1.75.7835-1.75 1.75v.5H1c-.552285 0-1 .44771-1 .99996v2c0 .5523.447715 1 1 1h2c.55228 0 1-.4477 1-1v-2c0-.55225-.44772-.99996-1-.99996h-.25v-.5c0-.13807.11193-.25.25-.25h3.25v.75H6c-.55228 0-1 .44771-1 .99996v2c0 .5523.44772 1 1 1h2c.55228 0 1-.4477 1-1v-2c0-.55225-.44772-.99996-1-.99996h-.25v-.75H11c.1381 0 .25.11193.25.25v.5H11c-.5523 0-1 .44771-1 .99996v2c0 .5523.4477 1 1 1h2c.5523 0 1-.4477 1-1v-2c0-.55225-.4477-.99996-1-.99996h-.25v-.5c0-.9665-.7835-1.75-1.75-1.75H7.75v-.75h1.5c.55229 0 1-.44772 1-1v-4c0-.552286-.44772-1.000001-1-1.000001h-4.5Z" fill="url(#sim_grad)" />
      <defs>
        <linearGradient id="sim_grad" x1="2.288" x2="13.187" y1="3" y2="9.503" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd600" />
          <stop offset="1" stopColor="#00d078" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PersonasIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className={`flex-shrink-0 transition-transform duration-150 ${active ? "scale-110" : ""}`}>
      <path fillRule="evenodd" clipRule="evenodd" d="M7 7.49994c-1.933 0-3.5-1.567-3.5-3.5v-2c0-.13261.05268-.25979.14645-.35355.25468-.24534.56531-.43635.87994-.59366C5.08754.772153 5.91362.499939 7 .499939s1.91246.272214 2.47361.552791c.31663.15831.62099.35084.87999.59366.0937.09376.1464.22094.1464.35355v2c0 1.933-1.567 3.5-3.5 3.5ZM.536568 12.8075C1.59107 10.2788 4.08715 8.49994 6.99989 8.49994c2.91273 0 5.40881 1.77886 6.46331 4.30756.0644.1543.0473.3306-.0454.4697-.0927.1392-.2489.2227-.4161.2227H.998049c-.167203 0-.32334-.0835-.416067-.2227-.092727-.1391-.109769-.3154-.045414-.4697Z" fill="url(#pers_grad)" />
      <defs>
        <linearGradient id="pers_grad" x1=".998" x2="15.816" y1="1.55" y2="9.905" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d078" />
          <stop offset="1" stopColor="#007df0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className={`flex-shrink-0 transition-transform duration-150 ${active ? "scale-110" : ""}`}>
      <path fillRule="evenodd" clipRule="evenodd" d="M5.55693.689231 5.09385 1.88462l-1.59384.90461-1.27077-.19385c-.2116-.02872-.42696.00612-.61871.10008-.19176.09396-.35125.2428-.45821.42762l-.430774.75384c-.110383.18776-.16124.40458-.145859.62184.015382.21726.096278.42475.232013.59509l.80769 1.00153v1.80924L.829238 8.90615c-.135735.17034-.216631.37783-.232012.59509-.015381.21726.035476.43408.145859.62186l.430765.7538c.10697.1848.26646.3337.45822.4276.19175.094.40711.1288.61871.1001l1.27077-.1938 1.5723.9046.46308 1.1954c.0781.2024.2155.3765.39421.4994.17871.123.39039.1892.60733.1898h.90461c.21694-.0006.42863-.0668.60734-.1898.17871-.1229.31611-.297.3942-.4994l.46308-1.1954 1.5723-.9046 1.2708.1938c.2116.0287.4269-.0061.6187-.1001.1917-.0939.3512-.2428.4582-.4276l.4308-.7538c.1104-.18778.1612-.4046.1458-.62186-.0154-.21726-.0962-.42475-.232-.59509l-.8077-1.00153V6.09538l.7862-1.00153c.1357-.17034.2166-.37783.232-.59509.0154-.21726-.0355-.43408-.1459-.62184l-.4307-.75384c-.107-.18482-.2665-.33366-.4582-.42762-.1918-.09396-.4072-.1288-.6188-.10008l-1.2707.19385-1.57234-.90461L8.44309.689231c-.0781-.202393-.2155-.376481-.39421-.499464C7.87017.0667842 7.65848.00064083 7.44155 0h-.88308c-.21694.00064083-.42862.0667842-.60733.189767-.17871.122983-.31611.297071-.39421.499464ZM7.00002 9.25c1.24264 0 2.25-1.00736 2.25-2.25s-1.00736-2.25-2.25-2.25c-1.24265 0-2.25 1.00736-2.25 2.25s1.00735 2.25 2.25 2.25Z" fill="url(#cog_grad)" />
      <defs>
        <linearGradient id="cog_grad" x1="2.674" x2="13.454" y1="2.692" y2="8.176" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd600" />
          <stop offset="1" stopColor="#00d078" />
        </linearGradient>
      </defs>
    </svg>
  );
}
