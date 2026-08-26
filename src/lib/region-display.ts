/** influencers.region — ISO 정규화·배지 */

const ALIAS: Record<string, string> = {
  "south korea": "KR",
  korea: "KR",
  japan: "JP",
  china: "CN",
  "united states": "US",
  usa: "US",
  "united kingdom": "GB",
  "hong kong": "HK",
  taiwan: "TW",
};

export function normalizeRegionCode(raw: string | null | undefined): string | null {
  const s = String(raw || "")
    .trim()
    .toUpperCase();
  if (!s) return null;
  if (s === "UK") return "GB";
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

/** IG about.country ("South Korea") → ISO */
export function regionFromCountryLabel(
  raw: string | null | undefined,
): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  return normalizeRegionCode(s) || ALIAS[s.toLowerCase()] || null;
}

/** "🇯🇵 일본" */
export function regionBadgeText(code: string | null | undefined): string | null {
  const iso = normalizeRegionCode(code);
  if (!iso) return null;
  const A = 0x1f1e6;
  const flag = String.fromCodePoint(
    ...[...iso].map((c) => A + (c.charCodeAt(0) - 65)),
  );
  let label = iso;
  try {
    label = new Intl.DisplayNames(["ko"], { type: "region" }).of(iso) || iso;
  } catch {
    /* keep */
  }
  return `${flag} ${label}`;
}
