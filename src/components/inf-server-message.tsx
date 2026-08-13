"use client";

import { InfLocaleEnsure, useInfLocale } from "@/components/inf-locale-provider";

export function InfServerMessage({
  kind,
}: {
  kind: "serverConfigError";
}) {
  return (
    <InfLocaleEnsure>
      <InfServerMessageInner kind={kind} />
    </InfLocaleEnsure>
  );
}

function InfServerMessageInner({
  kind,
}: {
  kind: "serverConfigError";
}) {
  const { t } = useInfLocale();
  return <p className="text-sm text-red-400">{t[kind]}</p>;
}
