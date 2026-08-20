"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InfLocaleEnsure, useInfLocale } from "@/components/inf-locale-provider";

export function InfBottomNav() {
  return (
    <InfLocaleEnsure>
      <InfBottomNavInner />
    </InfLocaleEnsure>
  );
}

function InfBottomNavInner() {
  const pathname = usePathname();
  const { t } = useInfLocale();
  const items = [
    { href: "/inf", label: t.allocationsTab },
    { href: "/inf/submit", label: t.contentSubmitTab },
    { href: "/inf/publish", label: t.contentPublishTab },
  ];

  return (
    <nav className="sticky bottom-0 z-20 border-t border-[#eee] bg-white/95 px-2 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-md gap-1">
        {items.map((item) => {
          const active =
            item.href === "/inf"
              ? pathname === "/inf"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 rounded-xl py-3 text-center text-xs font-semibold leading-tight sm:text-sm ${
                active ? "bg-[#F5EDE3] text-[#6B3B1F]" : "text-[#999]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
