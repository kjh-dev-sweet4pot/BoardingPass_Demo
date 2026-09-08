import {
  COMPANY_CONTRACT_STAGES,
  companyCrmFieldsFromBody,
  normalizeLoginId,
} from "@/lib/company";

export type CompanyImportDraft = {
  name: string;
  login_id: string;
  password: string;
  contact: string;
  contact_email: string;
  aliases: string[];
  first_meet_on: string | null;
  planned_start_on: string | null;
  planned_end_on: string | null;
  contract_stage: string | null;
  budget_amount: string | null;
  spent_amount: string | null;
  guideline_url: string | null;
};

export type CompanyCsvRow = CompanyImportDraft & {
  rowNumber: number;
  errors: string[];
  ok: boolean;
};

const FIELD_ALIASES: Record<string, keyof CompanyImportDraft> = {
  name: "name",
  회원사: "name",
  회원사명: "name",
  표시명: "name",
  login_id: "login_id",
  loginid: "login_id",
  아이디: "login_id",
  로그인아이디: "login_id",
  password: "password",
  비밀번호: "password",
  contact: "contact",
  연락처: "contact",
  담당자: "contact",
  contact_email: "contact_email",
  email: "contact_email",
  수신메일: "contact_email",
  이메일: "contact_email",
  aliases: "aliases",
  별칭: "aliases",
  first_meet_on: "first_meet_on",
  최초미팅: "first_meet_on",
  planned_start_on: "planned_start_on",
  소요예정시작: "planned_start_on",
  planned_end_on: "planned_end_on",
  소요예정종료: "planned_end_on",
  contract_stage: "contract_stage",
  계약단계: "contract_stage",
  budget_amount: "budget_amount",
  배정예산: "budget_amount",
  spent_amount: "spent_amount",
  소요비용: "spent_amount",
  guideline_url: "guideline_url",
  가이드라인: "guideline_url",
};

function normHeader(raw: string) {
  return raw.trim().toLowerCase().replace(/[\s_\-()]/g, "");
}

function aliasKey(header: string): keyof CompanyImportDraft | null {
  const raw = header.trim();
  if (FIELD_ALIASES[raw]) return FIELD_ALIASES[raw];
  const compact = normHeader(raw);
  for (const [alias, key] of Object.entries(FIELD_ALIASES)) {
    if (normHeader(alias) === compact) return key;
  }
  return null;
}

function cell(v: unknown) {
  return String(v ?? "").replace(/^\uFEFF/, "").trim();
}

export const COMPANY_CSV_TEMPLATE_HEADER =
  "name,login_id,password,contact_email,contact,aliases,first_meet_on,planned_start_on,planned_end_on,contract_stage,budget_amount,spent_amount,guideline_url";

export function companyCsvTemplate() {
  const stage = COMPANY_CONTRACT_STAGES[0];
  return `${COMPANY_CSV_TEMPLATE_HEADER}\n샘플회원사,sampleco,brandslam2026,ops@sample.com,,샘플별칭,2026-09-01,,,${stage},35000000,,\n`;
}

export function parseCompanyImportRows(
  records: Record<string, unknown>[],
): CompanyCsvRow[] {
  const seenLogin = new Set<string>();
  const seenName = new Set<string>();
  const out: CompanyCsvRow[] = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]!;
    const draft: CompanyImportDraft = {
      name: "",
      login_id: "",
      password: "",
      contact: "",
      contact_email: "",
      aliases: [],
      first_meet_on: null,
      planned_start_on: null,
      planned_end_on: null,
      contract_stage: null,
      budget_amount: null,
      spent_amount: null,
      guideline_url: null,
    };
    for (const [k, v] of Object.entries(rec)) {
      const key = aliasKey(k);
      if (!key) continue;
      if (key === "aliases") {
        draft.aliases = cell(v)
          .split(/[,;|]/)
          .map((a) => a.trim())
          .filter(Boolean);
        continue;
      }
      if (
        key === "first_meet_on" ||
        key === "planned_start_on" ||
        key === "planned_end_on" ||
        key === "contract_stage" ||
        key === "budget_amount" ||
        key === "spent_amount" ||
        key === "guideline_url"
      ) {
        draft[key] = cell(v) || null;
        continue;
      }
      draft[key] = cell(v);
    }

    draft.login_id = normalizeLoginId(draft.login_id);
    const errors: string[] = [];
    if (!draft.name) errors.push("회원사명 없음");
    if (!draft.login_id) errors.push("로그인 아이디 없음");
    if (!draft.password) errors.push("비밀번호 없음");
    if (draft.name && seenName.has(draft.name.toLowerCase())) {
      errors.push("파일 안 회원사명 중복");
    }
    if (draft.login_id && seenLogin.has(draft.login_id)) {
      errors.push("파일 안 로그인 아이디 중복");
    }
    const crm = companyCrmFieldsFromBody(
      {
        first_meet_on: draft.first_meet_on,
        planned_start_on: draft.planned_start_on,
        planned_end_on: draft.planned_end_on,
        contract_stage: draft.contract_stage,
        budget_amount: draft.budget_amount,
        spent_amount: draft.spent_amount,
        guideline_url: draft.guideline_url,
      },
      "create",
    );
    if (crm.error) errors.push(crm.error);
    if (draft.name) seenName.add(draft.name.toLowerCase());
    if (draft.login_id) seenLogin.add(draft.login_id);

    out.push({
      ...draft,
      rowNumber: i + 2,
      errors,
      ok: errors.length === 0,
    });
  }
  return out;
}

if (process.env.RUN_COMPANY_CSV_SELF_CHECK === "1") {
  const rows = parseCompanyImportRows([
    {
      회원사명: "에이",
      로그인아이디: "ACo",
      비밀번호: "pw1",
      별칭: "에이, A",
    },
    { name: "", login_id: "x", password: "p" },
  ]);
  if (rows.length !== 2 || !rows[0]!.ok || rows[0]!.login_id !== "aco") {
    throw new Error("parseCompanyImportRows ok row");
  }
  if (rows[1]!.ok || !rows[1]!.errors.includes("회원사명 없음")) {
    throw new Error("parseCompanyImportRows error row");
  }
  console.log("company-csv self-check ok");
}
