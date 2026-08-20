import { NextResponse } from "next/server";
import {
  getAdminRole,
  getCompanySessionId,
  isAdminManagerSession,
  isAdminSession,
} from "@/lib/session";

export function jsonUnauthorized(message = "로그인이 필요합니다.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function jsonForbidden(message = "권한이 없습니다.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireCompanyId() {
  const companyId = await getCompanySessionId();
  if (!companyId) return { error: jsonUnauthorized() };
  return { companyId };
}

export async function requireAnyAdmin() {
  if (!(await isAdminSession())) return { error: jsonUnauthorized() };
  return { ok: true as const };
}

export async function requireAdminManager() {
  if (!(await isAdminManagerSession())) {
    if (await isAdminSession()) return { error: jsonForbidden() };
    return { error: jsonUnauthorized() };
  }
  return { ok: true as const };
}

/** S5: 레코드 소속 회원사 2차 검증 */
export function assertRowCompany(
  row: { company_id?: string | null },
  companyId: string,
) {
  return row.company_id === companyId;
}

export async function canViewCostAmount() {
  const role = await getAdminRole();
  return role === "admin_manager";
}

const PRICING_KEYS = [
  "cost_amount",
  "display_price",
  "margin",
  "margin_amount",
  "원가",
  "마진",
] as const;

/** 운영담당자·회원사 API 응답에서 원가·마진 필드 제거 (R3) */
export function stripPricingFields<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const key of PRICING_KEYS) {
    if (key in out) delete out[key];
  }
  return out;
}

export function stripPricingDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripPricingDeep(item)) as T;
  }
  if (value && typeof value === "object") {
    const obj = stripPricingFields(value as Record<string, unknown>);
    for (const [k, v] of Object.entries(obj)) {
      obj[k] = stripPricingDeep(v);
    }
    return obj as T;
  }
  return value;
}
