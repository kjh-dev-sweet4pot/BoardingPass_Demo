export type CompanyMatchInput = {
  id: string;
  name: string;
  aliases?: string[] | null;
  is_active: boolean;
};

/** 앞뒤 공백 제거, 소문자, 공백·(주)·주식회사 제거 */
export function normalizeCompanyKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/주식회사/g, "")
    .replace(/\(주\)/g, "")
    .replace(/\s+/g, "");
}

export function normalizeLoginId(raw: string) {
  return raw.trim().toLowerCase();
}

/** /com 목업 UI 전용. DB 회원사 login_id = company (23yearsold). */
export const DEMO_COMPANY_LOGIN_ID = "company";

export function isDemoCompany(company: { login_id?: string | null }) {
  return normalizeLoginId(company.login_id || "") === DEMO_COMPANY_LOGIN_ID;
}

export function matchCompany(
  raw: string,
  companies: CompanyMatchInput[],
): CompanyMatchInput | null {
  const key = normalizeCompanyKey(raw);
  if (!key) return null;

  for (const company of companies) {
    if (normalizeCompanyKey(company.name) === key) return company;
  }
  for (const company of companies) {
    for (const alias of company.aliases || []) {
      if (normalizeCompanyKey(alias) === key) return company;
    }
  }
  return null;
}
