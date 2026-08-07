"use client";

import { useInfLocale } from "@/components/inf-locale-provider";

export function InfServerMessage({
  kind,
}: {
  kind: "serverConfigError";
}) {
  const { t } = useInfLocale();
  return <p className="text-sm text-red-400">{t[kind]}</p>;
}
