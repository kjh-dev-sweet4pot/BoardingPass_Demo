import { isMoneyOk, parseMoney } from "@/lib/money";

export const COMPANY_CONTRACT_STAGES = [
  "최초미팅",
  "계약 조건 논의중",
  "계약 완료",
  "캠페인 진행중",
  "캠페인 진행 완료",
  "종료",
  "계약 파기",
] as const;

export type CompanyContractStage = (typeof COMPANY_CONTRACT_STAGES)[number];

export const COMPANY_SELECT_BASE =
  "id, name, login_id, aliases, contact, is_active, created_at, updated_at";
export const COMPANY_SELECT_MAIL =
  "id, name, login_id, aliases, contact, contact_email, is_active, created_at, updated_at";
export const COMPANY_SELECT =
  "id, name, login_id, aliases, contact, contact_email, is_active, created_at, updated_at, first_meet_on, planned_start_on, planned_end_on, contract_stage, budget_amount, spent_amount, guideline_url";

const COMPANY_CRM_COLUMNS = [
  "first_meet_on",
  "planned_start_on",
  "planned_end_on",
  "contract_stage",
  "budget_amount",
  "spent_amount",
  "guideline_url",
] as const;

export function isMissingColumnError(message: string, column: string) {
  const m = message.toLowerCase();
  return m.includes(column.toLowerCase()) && (m.includes("column") || m.includes("schema"));
}

export function isMissingCompanyCrmColumn(message: string) {
  return COMPANY_CRM_COLUMNS.some((c) => isMissingColumnError(message, c));
}

/** SELECT 재시도용. write(update/insert)와 묶지 말 것. */
export function companySelectAfterColumnError(message: string) {
  if (isMissingCompanyCrmColumn(message)) return COMPANY_SELECT_MAIL;
  if (isMissingColumnError(message, "contact_email")) return COMPANY_SELECT_BASE;
  return null;
}

export function parseCompanyDate(raw: unknown): string | null | typeof Number.NaN {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.NaN;
  const t = Date.parse(`${s}T00:00:00+09:00`);
  if (!Number.isFinite(t)) return Number.NaN;
  return s;
}

export function parseContractStage(
  raw: unknown,
): CompanyContractStage | null | typeof Number.NaN {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return (COMPANY_CONTRACT_STAGES as readonly string[]).includes(s)
    ? (s as CompanyContractStage)
    : Number.NaN;
}

const CRM_BODY_KEYS = [
  "first_meet_on",
  "planned_start_on",
  "planned_end_on",
  "contract_stage",
  "budget_amount",
  "spent_amount",
  "guideline_url",
] as const;

/**
 * 회원사 등록·수정 body → DB 컬럼.
 * patch 모드에서는 전달된 키만 반영.
 */
export function companyCrmFieldsFromBody(
  body: Record<string, unknown>,
  mode: "create" | "patch",
): { fields: Record<string, unknown>; error?: string } {
  const fields: Record<string, unknown> = {};
  const want = (key: (typeof CRM_BODY_KEYS)[number]) =>
    mode === "create" || Object.prototype.hasOwnProperty.call(body, key);

  if (want("first_meet_on")) {
    const d = parseCompanyDate(body.first_meet_on);
    if (Number.isNaN(d)) return { fields, error: "최초 미팅 일자 형식이 올바르지 않습니다." };
    fields.first_meet_on = d;
  }
  if (want("planned_start_on")) {
    const d = parseCompanyDate(body.planned_start_on);
    if (Number.isNaN(d)) return { fields, error: "소요예정 시작일 형식이 올바르지 않습니다." };
    fields.planned_start_on = d;
  }
  if (want("planned_end_on")) {
    const d = parseCompanyDate(body.planned_end_on);
    if (Number.isNaN(d)) return { fields, error: "소요예정 종료일 형식이 올바르지 않습니다." };
    fields.planned_end_on = d;
  }
  if (
    typeof fields.planned_start_on === "string" &&
    typeof fields.planned_end_on === "string" &&
    fields.planned_start_on > fields.planned_end_on
  ) {
    return { fields, error: "소요예정 종료일이 시작일보다 빠릅니다." };
  }
  if (want("contract_stage")) {
    const s = parseContractStage(body.contract_stage);
    if (Number.isNaN(s)) return { fields, error: "계약 진행 단계 값이 올바르지 않습니다." };
    fields.contract_stage = s;
  }
  if (want("budget_amount")) {
    const n = parseMoney(body.budget_amount);
    if (n !== null && !isMoneyOk(n)) {
      return { fields, error: "배정 예산 형식이 올바르지 않습니다." };
    }
    fields.budget_amount = n;
  }
  if (want("spent_amount")) {
    const n = parseMoney(body.spent_amount);
    if (n !== null && !isMoneyOk(n)) {
      return { fields, error: "소요 비용 형식이 올바르지 않습니다." };
    }
    fields.spent_amount = n;
  }
  if (want("guideline_url")) {
    const u = String(body.guideline_url || "").trim();
    fields.guideline_url = u || null;
  }
  return { fields };
}

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

if (process.env.RUN_COMPANY_CRM_SELF_CHECK === "1") {
  if (
    companySelectAfterColumnError("column first_meet_on of relation companies does not exist") !==
    COMPANY_SELECT_MAIL
  ) {
    throw new Error("companySelectAfterColumnError CRM");
  }
  if (
    companySelectAfterColumnError(
      "Could not find the 'contact_email' column of 'companies' in the schema cache",
    ) !== COMPANY_SELECT_BASE
  ) {
    throw new Error("companySelectAfterColumnError email");
  }
  if (companySelectAfterColumnError("duplicate key value violates unique constraint") !== null) {
    throw new Error("companySelectAfterColumnError should ignore non-column errors");
  }
  if (parseCompanyDate("2026-09-03") !== "2026-09-03") {
    throw new Error("parseCompanyDate failed");
  }
  if (!Number.isNaN(parseCompanyDate("09/03/2026") as number)) {
    throw new Error("parseCompanyDate should reject");
  }
  if (parseContractStage("계약 파기") !== "계약 파기") {
    throw new Error("parseContractStage failed");
  }
  const crm = companyCrmFieldsFromBody(
    {
      first_meet_on: "2026-09-01",
      planned_start_on: "2026-09-01",
      planned_end_on: "2026-12-31",
      contract_stage: "캠페인 진행중",
      budget_amount: "35,000,000",
      spent_amount: "",
      guideline_url: " https://drive.example/g ",
    },
    "create",
  );
  if (
    crm.error ||
    crm.fields.budget_amount !== 35_000_000 ||
    crm.fields.spent_amount !== null ||
    crm.fields.guideline_url !== "https://drive.example/g"
  ) {
    throw new Error("companyCrmFieldsFromBody failed");
  }
  console.log("company CRM self-check ok");
}
