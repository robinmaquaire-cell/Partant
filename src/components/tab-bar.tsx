"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Événements", icon: "🗓" },
  { href: "/calendrier", label: "Calendrier", icon: "📅" },
  { href: "/contacts", label: "Contacts", icon: "🤝" },
  { href: "/listes", label: "Listes", icon: "👥" },
  { href: "/profil", label: "Profil", icon: "⚙️" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around py-2 z-20 bg-card border-t-[1.5px] border-line">
      {TABS.map((t) => {
        const active =
          t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-col items-center px-1.5 py-1 rounded-xl ${
              active ? "text-signal font-bold" : "text-ink-soft font-medium"
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="text-[10px] mt-0.5 whitespace-nowrap">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
