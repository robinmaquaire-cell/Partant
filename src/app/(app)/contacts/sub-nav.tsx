"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/contacts", label: "Contacts", icon: "🤝" },
  { href: "/contacts/listes", label: "Listes", icon: "📣" },
  { href: "/contacts/groupes", label: "Groupes", icon: "👥" },
];

export function ContactsSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-2xl p-1 mb-4 bg-card border-[1.5px] border-line">
      {SECTIONS.map((s) => {
        const active =
          s.href === "/contacts"
            ? pathname === "/contacts"
            : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`flex-1 text-center py-2 rounded-xl text-sm font-bold ${
              active
                ? "bg-signal text-white"
                : "text-ink-soft"
            }`}
          >
            <span className="mr-1">{s.icon}</span>
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
