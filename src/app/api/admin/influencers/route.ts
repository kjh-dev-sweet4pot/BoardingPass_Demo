import { NextRequest, NextResponse } from "next/server";
import { normalizeHandle } from "@/lib/auth";
import { requireAnyAdmin, requireAdminManager } from "@/lib/access";
import { isAdminTestCompany } from "@/lib/company";
import { scheduleInfluencerProfileFetch } from "@/lib/influencer-profile-image";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const INFLUENCER_SELECT =
  "id, name, instagram_handle, instagram_handle_normalized, sns_url, profile_image_path, followers, region, notes, phone, email, created_at, updated_at";

/**
 * GET /api/admin/influencers?unassigned=1&q=검색어
 * unassigned=1: 어떤 회사에도 캐스팅된 적 없는 인플루언서만 (사이트 배정용 로스터).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { searchParams } = new URL(request.url);
  const unassigned = searchParams.get("unassigned") === "1";
  const q = searchParams.get("q")?.trim().toLowerCase() || "";

  // q 없이 최대 500명을 한꺼번에 조인하면 castings/allocations 쪽 매칭 행이
  // PostgREST 기본 상한(1000행)에 걸려 일부만 세어지는 문제가 있었다.
  // 검색어가 없을 땐(드롭다운을 그냥 열었을 때) 소수만 보여줘 후보군을 작게 유지한다.
  let query = supabase
    .from("influencers")
    .select(INFLUENCER_SELECT)
    .order("updated_at", { ascending: false })
    .limit(q ? 500 : 20);
  if (q) query = query.or(`name.ilike.%${q}%,instagram_handle_normalized.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  let influencers = data || [];

  let companyCountById = new Map<string, number>();

  if (influencers.length) {
    const ids = influencers.map((i) => i.id);
    // 인플루언서-회사 연결은 castings(사이트 배정)와 allocations(엑셀 업로드) 두 경로 모두에서 생긴다.
    const [{ data: castRows, error: castErr }, { data: allocRows, error: allocErr }] = await Promise.all([
      supabase
        .from("castings")
        .select("influencer_id, company_id, companies ( name, login_id )")
        .in("influencer_id", ids)
        .range(0, 9999),
      supabase
        .from("allocations")
        .select("influencer_id, company_id, companies ( name, login_id )")
        .in("influencer_id", ids)
        .range(0, 9999),
    ]);
    if (castErr) return NextResponse.json({ error: castErr.message }, { status: 500 });
    if (allocErr) return NextResponse.json({ error: allocErr.message }, { status: 500 });

    type CompanyRow = { name: string; login_id: string };
    const testCastSet = new Set<string>();
    const realCastSet = new Set<string>();
    const realCompaniesByInf = new Map<string, Set<string>>();
    for (const row of [...(castRows ?? []), ...(allocRows ?? [])]) {
      const companiesRaw = row.companies as unknown as CompanyRow | CompanyRow[] | null;
      const company = Array.isArray(companiesRaw) ? companiesRaw[0] : companiesRaw;
      const infId = row.influencer_id as string;
      const companyId = row.company_id as string | null;
      if (!company || !companyId) continue;
      if (isAdminTestCompany(company)) {
        testCastSet.add(infId);
        continue;
      }
      realCastSet.add(infId);
      const set = realCompaniesByInf.get(infId) ?? new Set<string>();
      set.add(companyId);
      realCompaniesByInf.set(infId, set);
    }
    companyCountById = new Map([...realCompaniesByInf].map(([infId, set]) => [infId, set.size]));

    // 테스트 회원사에 배정된 이력이 있는 인플루언서는 전부 제외한다.
    influencers = influencers.filter((i) => !testCastSet.has(i.id as string));
    if (unassigned) {
      influencers = influencers.filter((i) => !realCastSet.has(i.id as string));
    }
  }

  return NextResponse.json({
    influencers: influencers.map((i) => ({
      ...i,
      company_count: companyCountById.get(i.id as string) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: {
    name?: string;
    instagram_handle?: string;
    sns_url?: string | null;
    notes?: string | null;
    region?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const handle = normalizeHandle(String(body.instagram_handle || ""));
  if (!handle) {
    return NextResponse.json(
      { error: "인스타그램 핸들을 입력하세요." },
      { status: 400 },
    );
  }
  const name = String(body.name || "").trim() || handle;
  const snsUrl = String(body.sns_url || "").trim();
  if (snsUrl && !/^https?:\/\//i.test(snsUrl)) {
    return NextResponse.json(
      { error: "SNS URL은 http:// 또는 https:// 로 시작해야 합니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("influencers")
    .insert({
      name,
      instagram_handle: handle,
      instagram_handle_normalized: handle,
      sns_url: snsUrl || null,
      notes: String(body.notes || "").trim() || null,
      region: String(body.region || "").trim() || null,
    })
    .select(INFLUENCER_SELECT)
    .single();

  if (error || !data) {
    const msg = error?.message || "인플루언서 생성에 실패했습니다.";
    const status = msg.toLowerCase().includes("unique") ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409 ? "이미 등록된 인스타그램 핸들입니다." : msg,
      },
      { status },
    );
  }

  scheduleInfluencerProfileFetch(supabase, data.id, {
    handle,
    snsUrl: snsUrl || null,
  });

  return NextResponse.json({ influencer: data });
}
