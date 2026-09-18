import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCompanyMailHtml,
  packMailLogRecipients,
  sendCompanyMailViaResend,
} from "@/lib/company-mail";
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from "@/lib/company-notifications";
import { engagementRate } from "@/lib/content-insights";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

async function loadSettings(supabase: Db, companyId: string): Promise<NotificationSettings> {
  const { data } = await supabase
    .from("company_notification_settings")
    .select("weekly_report, on_publish, high_engagement")
    .eq("company_id", companyId)
    .maybeSingle();
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(data || {}) };
}

async function sendAndLog(
  supabase: Db,
  input: {
    companyId: string;
    campaignId?: string | null;
    kind: "발행 알림" | "고인게이지 알림" | "리포트";
    to: string;
    subject: string;
    body: string;
  },
) {
  const html = buildCompanyMailHtml(input.body);
  let error: string | null = null;
  try {
    await sendCompanyMailViaResend({ to: [input.to], subject: input.subject, body: input.body, html });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await supabase.from("company_mail_logs").insert({
    company_id: input.companyId,
    campaign_id: input.campaignId || null,
    kind: input.kind,
    to_emails: packMailLogRecipients([input.to], []),
    subject: input.subject,
    body: input.body,
    sent_at: error ? null : new Date().toISOString(),
    error,
    created_by: "system",
  });
  return { error };
}

/** 콘텐츠 발행 URL 등록 직후 호출 — 그 배정의 회원사에 발행 알림을 보낸다. */
export async function notifyOnPublish(supabase: Db, allocationId: string | null) {
  if (!allocationId) return;
  const { data: alloc } = await supabase
    .from("allocations")
    .select("company_id, campaign_id, influencer_id, campaigns(name), influencers(name)")
    .eq("id", allocationId)
    .maybeSingle();
  if (!alloc?.company_id) return;

  const settings = await loadSettings(supabase, alloc.company_id);
  if (!settings.on_publish) return;

  const { data: company } = await supabase
    .from("companies")
    .select("name, contact_email")
    .eq("id", alloc.company_id)
    .maybeSingle();
  if (!company?.contact_email) return;

  const campaignRel = alloc.campaigns as { name: string | null } | { name: string | null }[] | null;
  const campaignName = (Array.isArray(campaignRel) ? campaignRel[0]?.name : campaignRel?.name) || "";
  const infRel = alloc.influencers as { name: string } | { name: string }[] | null;
  const influencerName = (Array.isArray(infRel) ? infRel[0]?.name : infRel?.name) || "인플루언서";

  const campaignLine = campaignName ? `캠페인: ${campaignName}\n` : "";
  await sendAndLog(supabase, {
    companyId: alloc.company_id,
    campaignId: alloc.campaign_id,
    kind: "발행 알림",
    to: company.contact_email,
    subject: `[BrandSlam] ${company.name} 신규 콘텐츠 발행 — ${influencerName}`,
    body: `${company.name} 담당자님께\n\n${campaignLine}${influencerName} 님이 콘텐츠를 발행했습니다.\n\n회원사 사이트 성과 탭에서 확인하실 수 있습니다.\n`,
  });
}

/**
 * 발행완료 콘텐츠 중 아직 알림을 안 보낸 것을 골라, 같은 회원사의 평균 참여율과 비교한다.
 * 평균의 HIGH_ENGAGEMENT_MULTIPLIER배 이상이고(§사용자 확정: "평균 대비 N배"), 비교할 표본이
 * 최소 MIN_SAMPLE건은 있어야 보낸다 — 그래야 "이 회원사 기준" 평균이 의미가 있다.
 */
const HIGH_ENGAGEMENT_MULTIPLIER = 2;
const MIN_SAMPLE = 3;

export async function checkHighEngagementAndNotify(supabase: Db) {
  const { data: links } = await supabase
    .from("creator_links")
    .select(
      "id, allocation_id, views, likes, comments, high_engagement_alerted, allocations!inner(company_id, campaign_id, influencer_id, influencers(name))",
    )
    .eq("content_status", "발행완료")
    .not("views", "is", null)
    .gt("views", 0);
  if (!links?.length) return { checked: 0, notified: 0 };

  type Row = (typeof links)[number];
  const companyOf = (r: Row) => {
    const rel = r.allocations as { company_id: string } | { company_id: string }[];
    return Array.isArray(rel) ? rel[0]?.company_id : rel?.company_id;
  };

  const byCompany = new Map<string, Row[]>();
  for (const r of links) {
    const companyId = companyOf(r);
    if (!companyId) continue;
    const list = byCompany.get(companyId) ?? [];
    list.push(r);
    byCompany.set(companyId, list);
  }

  let notified = 0;
  for (const [companyId, rows] of byCompany) {
    if (rows.length < MIN_SAMPLE) continue;
    const rates = rows.map((r) => engagementRate(r.views || 0, r.likes || 0, r.comments || 0));
    const avg = rates.reduce((s, v) => s + v, 0) / rates.length;
    if (avg <= 0) continue;

    const settings = await loadSettings(supabase, companyId);
    if (!settings.high_engagement) continue;

    const { data: company } = await supabase
      .from("companies")
      .select("name, contact_email")
      .eq("id", companyId)
      .maybeSingle();
    if (!company?.contact_email) continue;

    for (const r of rows) {
      if (r.high_engagement_alerted) continue;
      const rate = engagementRate(r.views || 0, r.likes || 0, r.comments || 0);
      if (rate < avg * HIGH_ENGAGEMENT_MULTIPLIER) continue;

      const rel = r.allocations as unknown as {
        campaign_id: string | null;
        influencers: { name: string } | { name: string }[] | null;
      };
      const infRel = rel.influencers;
      const influencerName = (Array.isArray(infRel) ? infRel[0]?.name : infRel?.name) || "인플루언서";

      const { error } = await sendAndLog(supabase, {
        companyId,
        campaignId: rel.campaign_id,
        kind: "고인게이지 알림",
        to: company.contact_email,
        subject: `[BrandSlam] ${company.name} 콘텐츠 반응 급상승 — ${influencerName}`,
        body: `${company.name} 담당자님께\n\n${influencerName} 님의 콘텐츠 참여율이 이 캠페인 평균(${avg.toFixed(
          1,
        )}%)의 ${HIGH_ENGAGEMENT_MULTIPLIER}배 이상(${rate.toFixed(1)}%)입니다.\n\n회원사 사이트 성과 탭에서 확인해 보세요.\n`,
      });
      if (!error) {
        await supabase.from("creator_links").update({ high_engagement_alerted: true }).eq("id", r.id);
        notified += 1;
      }
    }
  }
  return { checked: links.length, notified };
}

/** 매주 금요일 오후: 최근 7일 성과를 회원사별로 요약해서 보낸다. */
export async function sendWeeklyReports(supabase: Db) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, contact_email")
    .eq("is_active", true)
    .not("contact_email", "is", null);
  if (!companies?.length) return { sent: 0 };

  let sent = 0;
  for (const company of companies) {
    const settings = await loadSettings(supabase, company.id);
    if (!settings.weekly_report || !company.contact_email) continue;

    const { data: links } = await supabase
      .from("creator_links")
      .select("views, likes, comments, published_at, allocations!inner(company_id)")
      .eq("allocations.company_id", company.id)
      .gte("published_at", since);
    const rows = links || [];
    const published = rows.length;
    const totalViews = rows.reduce((s, r) => s + (r.views || 0), 0);
    const totalLikes = rows.reduce((s, r) => s + (r.likes || 0), 0);
    const totalComments = rows.reduce((s, r) => s + (r.comments || 0), 0);

    const { error } = await sendAndLog(supabase, {
      companyId: company.id,
      kind: "리포트",
      to: company.contact_email,
      subject: `[BrandSlam] ${company.name} 주간 리포트`,
      body: `${company.name} 담당자님께\n\n지난 7일간 성과를 보내드립니다.\n\n발행 콘텐츠: ${published}건\n조회수 합계: ${totalViews.toLocaleString(
        "ko-KR",
      )}\n좋아요 합계: ${totalLikes.toLocaleString("ko-KR")}\n댓글 합계: ${totalComments.toLocaleString(
        "ko-KR",
      )}\n\n자세한 내용은 회원사 사이트 성과 탭에서 확인하실 수 있습니다.\n`,
    });
    if (!error) sent += 1;
  }
  return { sent };
}
