import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCompanyMailHtml,
  packMailLogRecipients,
  sendCompanyMailViaResend,
} from "@/lib/company-mail";
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from "@/lib/company-notifications";
import { engagementRate } from "@/lib/content-insights";
import { CREATOR_PLATFORM_LABEL, resolveCreatorPlatform } from "@/lib/creator-link";

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
    html?: string;
  },
) {
  const html = input.html || buildCompanyMailHtml(input.body);
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

export function buildPublishNotificationHtml(input: {
  companyName: string;
  influencerName: string;
  campaignName?: string | null;
  storeName?: string | null;
  productName?: string | null;
  platform: string;
  url?: string | null;
}) {
  const { companyName, influencerName, campaignName, storeName, productName, platform, url } = input;
  const storeProd = [storeName, productName].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName} 신규 콘텐츠 발행</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    
    <div style="background-color:#1e293b;padding:28px 24px;color:#ffffff;">
      <div style="font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">BrandSlam Publish Alert</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">[${companyName}] 신규 콘텐츠 발행 알림</h1>
      <p style="margin:8px 0 0 0;font-size:13px;color:#cbd5e1;">크리에이터 <strong>${influencerName}</strong> 님의 콘텐츠가 정상 발행되었습니다.</p>
    </div>

    <div style="padding:24px;">
      <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px 0;">
        <strong>${companyName}</strong> 담당자님 안녕하세요.<br/>
        진행 중인 캠페인의 새로운 인플루언서 콘텐츠가 업로드되어 안내드립니다.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
        <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 14px 0;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
          📌 발행 콘텐츠 정보
        </h2>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;">
          <tr>
            <td width="90" style="padding:6px 0;color:#64748b;font-weight:600;">크리에이터</td>
            <td style="padding:6px 0;color:#0f172a;font-weight:700;">${influencerName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">발행 채널</td>
            <td style="padding:6px 0;">
              <span style="display:inline-block;padding:3px 8px;font-size:11px;font-weight:600;border-radius:4px;background:#e2e8f0;color:#334155;">${platform}</span>
            </td>
          </tr>
          ${
            campaignName
              ? `<tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">캠페인</td>
            <td style="padding:6px 0;color:#334155;">${campaignName}</td>
          </tr>`
              : ""
          }
          ${
            storeProd
              ? `<tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">매장 / 상품</td>
            <td style="padding:6px 0;color:#334155;">${storeProd}</td>
          </tr>`
              : ""
          }
          ${
            url
              ? `<tr>
            <td style="padding:8px 0 0 0;color:#64748b;font-weight:600;vertical-align:middle;">콘텐츠 원본</td>
            <td style="padding:8px 0 0 0;">
              <a href="${url}" target="_blank" style="display:inline-block;background:#eff6ff;color:#2563eb;padding:5px 12px;border-radius:6px;font-weight:600;font-size:12px;text-decoration:none;border:1px solid #bfdbfe;">
                업로드된 게시물 보러가기 →
              </a>
            </td>
          </tr>`
              : ""
          }
        </table>
      </div>

      <div style="background:#f1f5f9;border-radius:8px;padding:14px 16px;margin-bottom:24px;font-size:12.5px;color:#475569;line-height:1.5;">
        💡 <strong>안내</strong>: 실시간 조회수, 좋아요, 댓글 등의 성과 데이터는 시스템 수집 주기에 맞춰 자동으로 수집되어 회원사 사이트에 반영됩니다.
      </div>

      <div style="text-align:center;padding:8px 0;">
        <a href="https://boarding-pass-meeting.vercel.app/com" target="_blank" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          회원사 대시보드에서 성과 확인하기
        </a>
      </div>
    </div>

    <div style="background-color:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.5;">
      본 메일은 BrandSlam 자동 알림 시스템에 의해 발송되었습니다.<br/>
      알림 수신 설정 변경은 회원사 사이트 설정 페이지에서 가능합니다.<br/>
      <strong style="color:#64748b;">BrandSlam</strong> · <a href="mailto:manager@slam-global.com" style="color:#64748b;text-decoration:none;">manager@slam-global.com</a>
    </div>

  </div>
</body>
</html>`;
}

export function buildHighEngagementNotificationHtml(input: {
  companyName: string;
  influencerName: string;
  campaignName?: string | null;
  platform: string;
  url?: string | null;
  rate: number;
  avgRate: number;
  views: number;
  likes: number;
  comments: number;
  saves?: number | null;
}) {
  const { companyName, influencerName, campaignName, platform, url, rate, avgRate, views, likes, comments, saves } =
    input;
  const ratio = avgRate > 0 ? (rate / avgRate).toFixed(1) : "2.0";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName} 콘텐츠 반응 급상승 알림</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    
    <div style="background-color:#1e293b;padding:28px 24px;color:#ffffff;">
      <div style="display:inline-block;padding:4px 10px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:#ea580c;color:#ffffff;border-radius:20px;margin-bottom:10px;">
        🔥 High Engagement Alert
      </div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">[${companyName}] 콘텐츠 반응 급상승 감지!</h1>
      <p style="margin:8px 0 0 0;font-size:13px;color:#cbd5e1;">크리에이터 <strong>${influencerName}</strong> 님의 콘텐츠가 평균 대비 <strong>${ratio}배</strong>의 반응을 얻고 있습니다.</p>
    </div>

    <div style="padding:24px;">
      <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px 0;">
        <strong>${companyName}</strong> 담당자님 안녕하세요.<br/>
        진행 중인 캠페인에서 일반 콘텐츠 대비 유독 반응(좋아요/댓글)이 폭발적인 고성과 콘텐츠가 감지되어 긴급 공유드립니다.
      </p>

      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;margin-bottom:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:#c2410c;margin-bottom:4px;">캠페인 평균 대비 참여율 성과</div>
        <div style="font-size:28px;font-weight:900;color:#ea580c;">
          ${ratio}<span style="font-size:18px;font-weight:700;">배 급상승</span>
        </div>
        <div style="font-size:12.5px;color:#7c2d12;margin-top:6px;">
          해당 콘텐츠 참여율(ER): <strong>${rate.toFixed(2)}%</strong> (캠페인 평균: ${avgRate.toFixed(2)}%)
        </div>
      </div>

      <div style="margin-bottom:24px;">
        <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px 0;">📊 현재 집계 지표</h2>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px;">
          <tr>
            <td width="25%" style="background:#f1f5f9;border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:3px;">조회수</div>
              <div style="font-size:16px;font-weight:800;color:#2563eb;">${views.toLocaleString("ko-KR")}</div>
            </td>
            <td width="25%" style="background:#f1f5f9;border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:3px;">좋아요</div>
              <div style="font-size:16px;font-weight:800;color:#dc2626;">${likes.toLocaleString("ko-KR")}</div>
            </td>
            <td width="25%" style="background:#f1f5f9;border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:3px;">댓글</div>
              <div style="font-size:16px;font-weight:800;color:#0f172a;">${comments.toLocaleString("ko-KR")}</div>
            </td>
            <td width="25%" style="background:#f1f5f9;border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:3px;">저장수</div>
              <div style="font-size:16px;font-weight:800;color:#0f172a;">${saves != null ? saves.toLocaleString("ko-KR") : "-"}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;">
            ${influencerName}
            <span style="display:inline-block;margin-left:6px;padding:2px 6px;font-size:11px;border-radius:4px;background:#e2e8f0;color:#334155;font-weight:500;">${platform}</span>
          </div>
          ${campaignName ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${campaignName}</div>` : ""}
        </div>
        ${
          url
            ? `<div style="margin-top:10px;">
          <a href="${url}" target="_blank" style="display:inline-block;background:#eff6ff;color:#2563eb;padding:5px 12px;border-radius:6px;font-weight:600;font-size:12px;text-decoration:none;border:1px solid #bfdbfe;">
            게시물 원본 바로가기 →
          </a>
        </div>`
            : ""
        }
      </div>

      <div style="text-align:center;padding:8px 0;">
        <a href="https://boarding-pass-meeting.vercel.app/com" target="_blank" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          회원사 대시보드에서 상세 추이 확인하기
        </a>
      </div>
    </div>

    <div style="background-color:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.5;">
      본 메일은 BrandSlam 자동 감지 시스템에 의해 발송되었습니다.<br/>
      알림 수신 설정 변경은 회원사 사이트 설정 페이지에서 가능합니다.<br/>
      <strong style="color:#64748b;">BrandSlam</strong> · <a href="mailto:manager@slam-global.com" style="color:#64748b;text-decoration:none;">manager@slam-global.com</a>
    </div>

  </div>
</body>
</html>`;
}

export type PublishNotificationItem = {
  influencerName: string;
  campaignName?: string | null;
  storeName?: string | null;
  productName?: string | null;
  platform: string;
  url?: string | null;
};

export function buildBatchPublishNotificationHtml(input: {
  companyName: string;
  items: PublishNotificationItem[];
}) {
  const { companyName, items } = input;
  if (items.length === 1) {
    return buildPublishNotificationHtml({
      companyName,
      influencerName: items[0].influencerName,
      campaignName: items[0].campaignName,
      storeName: items[0].storeName,
      productName: items[0].productName,
      platform: items[0].platform,
      url: items[0].url,
    });
  }

  const itemsHtml = items
    .map((item, idx) => {
      const storeProd = [item.storeName, item.productName].filter(Boolean).join(" · ");
      const isXhs = item.platform.includes("샤오홍슈");
      const platBg = isXhs ? "#fee2e2" : "#fce7f3";
      const platColor = isXhs ? "#b91c1c" : "#be185d";

      return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:${
        idx === items.length - 1 ? "0" : "12px"
      };">
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;">
              <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">
                ${item.influencerName}
                <span style="display:inline-block;margin-left:6px;padding:2px 8px;font-size:11px;font-weight:600;border-radius:4px;background:${platBg};color:${platColor};">${item.platform}</span>
              </div>
              ${item.campaignName ? `<div style="font-size:12.5px;color:#64748b;margin-bottom:2px;">${item.campaignName}</div>` : ""}
              ${storeProd ? `<div style="font-size:12.5px;color:#334155;font-weight:500;">${storeProd}</div>` : ""}
            </td>
            ${
              item.url
                ? `<td width="130" align="right" style="vertical-align:middle;">
              <a href="${item.url}" target="_blank" style="display:inline-block;background:#eff6ff;color:#2563eb;padding:7px 12px;border-radius:6px;font-weight:600;font-size:12px;text-decoration:none;border:1px solid #bfdbfe;white-space:nowrap;">
                게시물 보기 →
              </a>
            </td>`
                : ""
            }
          </tr>
        </table>
      </div>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName} 신규 콘텐츠 발행 알림</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    
    <div style="background-color:#1e293b;padding:28px 24px;color:#ffffff;">
      <div style="display:inline-block;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:#2563eb;color:#ffffff;border-radius:20px;margin-bottom:10px;">
        신규 발행 알림 (${items.length}건)
      </div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">[${companyName}] 신규 콘텐츠 발행 알림</h1>
      <p style="margin:8px 0 0 0;font-size:13px;color:#cbd5e1;">새로운 인플루언서 콘텐츠 <strong>${items.length}건</strong>이 등록되었습니다.</p>
    </div>

    <div style="padding:24px;">
      <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px 0;">
        <strong>${companyName}</strong> 담당자님 안녕하세요.<br/>
        진행 중인 캠페인의 새로운 인플루언서 콘텐츠가 업로드되어 안내드립니다.
      </p>

      <div style="margin-bottom:24px;">
        <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 14px 0;">
          📌 발행 콘텐츠 목록 (${items.length}건)
        </h2>
        ${itemsHtml}
      </div>

      <div style="background:#f1f5f9;border-radius:8px;padding:14px 16px;margin-bottom:24px;font-size:12.5px;color:#475569;line-height:1.5;">
        💡 <strong>안내</strong>: 실시간 조회수, 좋아요, 댓글 등의 성과 데이터는 시스템 수집 주기에 맞춰 자동으로 수집되어 회원사 사이트에 반영됩니다.
      </div>

      <div style="text-align:center;padding:8px 0;">
        <a href="https://boarding-pass-meeting.vercel.app/com" target="_blank" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          회원사 대시보드에서 성과 확인하기
        </a>
      </div>
    </div>

    <div style="background-color:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.5;">
      본 메일은 BrandSlam 자동 알림 시스템에 의해 발송되었습니다.<br/>
      알림 수신 설정 변경은 회원사 사이트 설정 페이지에서 가능합니다.<br/>
      <strong style="color:#64748b;">BrandSlam</strong> · <a href="mailto:manager@slam-global.com" style="color:#64748b;text-decoration:none;">manager@slam-global.com</a>
    </div>

  </div>
</body>
</html>`;
}

export const PUBLISH_BATCH_DELAY_MS = 60 * 60 * 1000; // 1시간 delay

type PendingPublishBatch = {
  companyId: string;
  allocationIds: Set<string>;
  timer: NodeJS.Timeout;
  firstQueuedAt: number;
};

const pendingPublishBatches = new Map<string, PendingPublishBatch>();

/** 1시간 대기 후 모인 콘텐츠들을 회원사로 발송 */
export async function flushPublishBatch(supabase: Db, companyId: string) {
  const batch = pendingPublishBatches.get(companyId);
  if (!batch) return;
  pendingPublishBatches.delete(companyId);
  clearTimeout(batch.timer);

  const allocationIds = Array.from(batch.allocationIds);
  if (!allocationIds.length) return;

  const settings = await loadSettings(supabase, companyId);
  if (!settings.on_publish) return;

  const { data: company } = await supabase
    .from("companies")
    .select("name, contact_email")
    .eq("id", companyId)
    .maybeSingle();
  if (!company?.contact_email) return;

  const { data: allocs } = await supabase
    .from("allocations")
    .select("id, campaign_id, influencer_id, campaigns(name), influencers(name), stores(name), products(name)")
    .in("id", allocationIds);

  const { data: links } = await supabase
    .from("creator_links")
    .select("allocation_id, url, publish_url, platform")
    .in("allocation_id", allocationIds)
    .order("submitted_at", { ascending: false });

  const linkMap = new Map<string, { url: string; platform: string }>();
  for (const l of links || []) {
    if (!linkMap.has(l.allocation_id)) {
      linkMap.set(l.allocation_id, {
        url: (l.publish_url || l.url || "").trim(),
        platform: l.platform || "SNS",
      });
    }
  }

  const items: PublishNotificationItem[] = [];
  const seenUrls = new Set<string>();

  for (const alloc of allocs || []) {
    const l = linkMap.get(alloc.id);
    const linkUrl = l?.url || "";
    const dedupeKey = linkUrl.toLowerCase() || alloc.id;
    if (seenUrls.has(dedupeKey)) continue;
    seenUrls.add(dedupeKey);

    const campaignRel = alloc.campaigns as { name: string | null } | { name: string | null }[] | null;
    const campaignName = (Array.isArray(campaignRel) ? campaignRel[0]?.name : campaignRel?.name) || "";
    const infRel = alloc.influencers as { name: string } | { name: string }[] | null;
    const influencerName = (Array.isArray(infRel) ? infRel[0]?.name : infRel?.name) || "인플루언서";
    const storeRel = alloc.stores as { name: string } | { name: string }[] | null;
    const storeName = (Array.isArray(storeRel) ? storeRel[0]?.name : storeRel?.name) || "";
    const productRel = alloc.products as { name: string } | { name: string }[] | null;
    const productName = (Array.isArray(productRel) ? productRel[0]?.name : productRel?.name) || "";

    const platform = CREATOR_PLATFORM_LABEL[resolveCreatorPlatform(linkUrl, l?.platform)] || l?.platform || "SNS";

    items.push({
      influencerName,
      platform,
      campaignName,
      storeName,
      productName,
      url: linkUrl,
    });
  }

  if (!items.length) return;

  const isMulti = items.length > 1;
  const subject = isMulti
    ? `[BrandSlam] ${company.name} 신규 콘텐츠 발행 (${items.length}건)`
    : `[BrandSlam] ${company.name} 신규 콘텐츠 발행 — ${items[0].influencerName}`;

  const plainBody = isMulti
    ? `${company.name} 담당자님께\n\n진행 중인 캠페인의 새로운 인플루언서 콘텐츠 ${items.length}건이 발행되었습니다.\n\n` +
      items
        .map(
          (it, idx) =>
            `${idx + 1}. [${it.platform}] ${it.influencerName} - ${it.campaignName || ""} ${[it.storeName, it.productName].filter(Boolean).join(" · ")}\n   링크: ${it.url || "미제공"}`,
        )
        .join("\n\n") +
      `\n\n회원사 사이트 성과 탭에서 확인하실 수 있습니다: https://boarding-pass-meeting.vercel.app/com\n`
    : `${company.name} 담당자님께\n\n${items[0].campaignName ? `캠페인: ${items[0].campaignName}\n` : ""}${items[0].influencerName} 님이 ${items[0].platform} 콘텐츠를 발행했습니다.\n\n${items[0].url ? `게시물 링크: ${items[0].url}\n\n` : ""}회원사 사이트 성과 탭에서 확인하실 수 있습니다.\n`;

  const html = buildBatchPublishNotificationHtml({
    companyName: company.name,
    items,
  });

  await sendAndLog(supabase, {
    companyId,
    kind: "발행 알림",
    to: company.contact_email,
    subject,
    body: plainBody,
    html,
  });
}

/**
 * 콘텐츠 발행 URL 등록 직후 호출.
 * 1시간 delay 동안 동일 회원사로 추가 발행된 건이 있으면 1통의 메일로 묶어서 발송한다.
 */
export async function notifyOnPublish(
  supabase: Db,
  allocationId: string | null,
  options?: { delayMs?: number; immediate?: boolean },
) {
  if (!allocationId) return;
  const { data: alloc } = await supabase
    .from("allocations")
    .select("company_id")
    .eq("id", allocationId)
    .maybeSingle();
  if (!alloc?.company_id) return;

  const companyId = alloc.company_id;
  const delay = options?.immediate ? 0 : (options?.delayMs ?? PUBLISH_BATCH_DELAY_MS);

  if (delay <= 0) {
    const existing = pendingPublishBatches.get(companyId);
    if (existing) {
      existing.allocationIds.add(allocationId);
      await flushPublishBatch(supabase, companyId);
      return;
    }
    const set = new Set<string>([allocationId]);
    pendingPublishBatches.set(companyId, {
      companyId,
      allocationIds: set,
      timer: setTimeout(() => {}, 0),
      firstQueuedAt: Date.now(),
    });
    await flushPublishBatch(supabase, companyId);
    return;
  }

  const existing = pendingPublishBatches.get(companyId);
  if (existing) {
    existing.allocationIds.add(allocationId);
    return;
  }

  const set = new Set<string>([allocationId]);
  const timer = setTimeout(() => {
    void flushPublishBatch(supabase, companyId);
  }, delay);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  pendingPublishBatches.set(companyId, {
    companyId,
    allocationIds: set,
    timer,
    firstQueuedAt: Date.now(),
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
      "id, allocation_id, url, publish_url, platform, views, likes, comments, saves, high_engagement_alerted, allocations!inner(company_id, campaign_id, influencer_id, influencers(name), campaigns(name))",
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
        campaigns: { name: string } | { name: string }[] | null;
      };
      const infRel = rel.influencers;
      const influencerName = (Array.isArray(infRel) ? infRel[0]?.name : infRel?.name) || "인플루언서";
      const campRel = rel.campaigns;
      const campaignName = (Array.isArray(campRel) ? campRel[0]?.name : campRel?.name) || "";

      const linkUrl = (r.publish_url || r.url || "").trim();
      const platform = CREATOR_PLATFORM_LABEL[resolveCreatorPlatform(linkUrl, r.platform)] || r.platform || "SNS";

      const plainBody = `${company.name} 담당자님께\n\n${influencerName} 님의 콘텐츠 참여율이 이 캠페인 평균(${avg.toFixed(
        1,
      )}%)의 ${(rate / (avg || 1)).toFixed(1)}배 이상(${rate.toFixed(1)}%)입니다.\n\n회원사 사이트 성과 탭에서 확인해 보세요.\n`;

      const html = buildHighEngagementNotificationHtml({
        companyName: company.name,
        influencerName,
        campaignName,
        platform,
        url: linkUrl,
        rate,
        avgRate: avg,
        views: r.views || 0,
        likes: r.likes || 0,
        comments: r.comments || 0,
        saves: r.saves,
      });

      const { error } = await sendAndLog(supabase, {
        companyId,
        campaignId: rel.campaign_id,
        kind: "고인게이지 알림",
        to: company.contact_email,
        subject: `[BrandSlam] ${company.name} 콘텐츠 반응 급상승 — ${influencerName}`,
        body: plainBody,
        html,
      });
      if (!error) {
        await supabase.from("creator_links").update({ high_engagement_alerted: true }).eq("id", r.id);
        notified += 1;
      }
    }
  }
  return { checked: links.length, notified };
}

export type WeeklyReportSummary = {
  published: number;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  avgEngagement: string;
};

export type WeeklyReportPost = {
  name: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  url: string;
};

export function buildWeeklyReportHtml(input: {
  companyName: string;
  summary: WeeklyReportSummary;
  posts: WeeklyReportPost[];
}) {
  const { companyName, summary, posts } = input;
  const rowsHtml =
    posts.length > 0
      ? posts
          .slice(0, 20)
          .map(
            (p, idx) => `
          <tr style="border-bottom:${
            idx === posts.length - 1 ? "none" : "1px solid #f1f5f9"
          };background:${idx % 2 === 0 ? "#ffffff" : "#fafafa"};">
            <td style="padding:10px 12px;font-weight:600;color:#0f172a;">${p.name}</td>
            <td style="padding:10px 12px;color:#64748b;">
              <span style="display:inline-block;padding:2px 6px;font-size:11px;border-radius:4px;background:#e2e8f0;color:#334155;">${p.platform}</span>
            </td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#2563eb;">${p.views.toLocaleString(
              "ko-KR",
            )}</td>
            <td style="padding:10px 12px;text-align:right;color:#64748b;">${p.likes.toLocaleString(
              "ko-KR",
            )}</td>
            <td style="padding:10px 12px;text-align:center;">
              <a href="${p.url}" target="_blank" style="color:#2563eb;text-decoration:none;font-size:12px;font-weight:600;background:#eff6ff;padding:4px 8px;border-radius:4px;border:1px solid #bfdbfe;">보기 →</a>
            </td>
          </tr>`,
          )
          .join("")
      : `<tr><td colspan="5" style="padding:18px;text-align:center;color:#94a3b8;font-size:13px;">최근 7일간 새로 발행된 콘텐츠가 없습니다.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName} 주간 리포트</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    
    <div style="background-color:#1e293b;padding:28px 24px;color:#ffffff;">
      <div style="font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">BrandSlam Weekly Report</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">[${companyName}] 주간 성과 리포트</h1>
      <p style="margin:8px 0 0 0;font-size:13px;color:#cbd5e1;">최근 7일간 발행된 인플루언서 콘텐츠 성과 요약입니다.</p>
    </div>

    <div style="padding:24px;">
      <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px 0;">
        <strong>${companyName}</strong> 담당자님 안녕하세요.<br/>
        한 주간의 인플루언서 마케팅 주요 지표 및 콘텐츠 현황을 전해드립니다.
      </p>

      <div style="margin-bottom:28px;">
        <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px 0;">📊 주간 주요 지표</h2>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px;">
          <tr>
            <td width="33.3%" style="background:#f1f5f9;border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px;">신규 발행 콘텐츠</div>
              <div style="font-size:20px;font-weight:800;color:#0f172a;">${summary.published}<span style="font-size:13px;font-weight:500;">건</span></div>
            </td>
            <td width="33.3%" style="background:#f1f5f9;border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px;">총 조회수</div>
              <div style="font-size:20px;font-weight:800;color:#2563eb;">${summary.views.toLocaleString(
                "ko-KR",
              )}<span style="font-size:13px;font-weight:500;">회</span></div>
            </td>
            <td width="33.3%" style="background:#f1f5f9;border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px;">총 좋아요</div>
              <div style="font-size:20px;font-weight:800;color:#dc2626;">${summary.likes.toLocaleString(
                "ko-KR",
              )}<span style="font-size:13px;font-weight:500;">개</span></div>
            </td>
          </tr>
          <tr>
            <td width="33.3%" style="background:#f1f5f9;border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px;">총 댓글</div>
              <div style="font-size:18px;font-weight:800;color:#0f172a;">${summary.comments.toLocaleString(
                "ko-KR",
              )}<span style="font-size:12px;font-weight:500;">개</span></div>
            </td>
            <td width="33.3%" style="background:#f1f5f9;border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px;">저장(북마크)</div>
              <div style="font-size:18px;font-weight:800;color:#0f172a;">${summary.saves.toLocaleString(
                "ko-KR",
              )}<span style="font-size:12px;font-weight:500;">회</span></div>
            </td>
            <td width="33.3%" style="background:#f1f5f9;border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px;">평균 참여율(ER)</div>
              <div style="font-size:18px;font-weight:800;color:#16a34a;">${summary.avgEngagement}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom:28px;">
        <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px 0;">📋 주간 발행 콘텐츠 현황</h2>
        <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;text-align:left;">
            <thead>
              <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;">
                <th style="padding:10px 12px;font-weight:600;">크리에이터</th>
                <th style="padding:10px 12px;font-weight:600;">채널</th>
                <th style="padding:10px 12px;font-weight:600;text-align:right;">조회수</th>
                <th style="padding:10px 12px;font-weight:600;text-align:right;">좋아요</th>
                <th style="padding:10px 12px;font-weight:600;text-align:center;">링크</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div style="text-align:center;padding:16px 0;">
        <a href="https://boarding-pass-meeting.vercel.app/com" target="_blank" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          회원사 대시보드에서 전체 성과 확인하기
        </a>
      </div>
    </div>

    <div style="background-color:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.5;">
      본 메일은 BrandSlam 자동 리포트 시스템에 의해 발송되었습니다.<br/>
      알림 수신 설정 변경은 회원사 사이트 설정 페이지에서 가능합니다.<br/>
      <strong style="color:#64748b;">BrandSlam</strong> · <a href="mailto:manager@slam-global.com" style="color:#64748b;text-decoration:none;">manager@slam-global.com</a>
    </div>

  </div>
</body>
</html>`;
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
      .select(`
        id, views, likes, comments, saves, platform, url, publish_url, published_at,
        influencers ( name ),
        allocations!inner ( company_id )
      `)
      .eq("allocations.company_id", company.id)
      .gte("published_at", since)
      .order("views", { ascending: false, nullsFirst: false });

    const seen = new Set<string>();
    const uniquePosts: WeeklyReportPost[] = [];

    for (const r of links || []) {
      const u = (r.publish_url || r.url || "").trim();
      const key = u.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const infRel = r.influencers as { name: string } | { name: string }[] | null;
      const influencerName =
        (Array.isArray(infRel) ? infRel[0]?.name : infRel?.name) || "인플루언서";
      const plat =
        CREATOR_PLATFORM_LABEL[resolveCreatorPlatform(u, r.platform)] ||
        r.platform ||
        "기타";
      uniquePosts.push({
        name: influencerName,
        platform: plat,
        views: r.views || 0,
        likes: r.likes || 0,
        comments: r.comments || 0,
        url: u,
      });
    }

    const published = uniquePosts.length;
    const totalViews = uniquePosts.reduce((s, r) => s + r.views, 0);
    const totalLikes = uniquePosts.reduce((s, r) => s + r.likes, 0);
    const totalComments = uniquePosts.reduce((s, r) => s + r.comments, 0);
    const totalSaves = (links || []).reduce((s, r) => s + (r.saves || 0), 0);
    const avgEngagement =
      totalViews > 0
        ? `${(((totalLikes + totalComments) / totalViews) * 100).toFixed(2)}%`
        : "0.00%";

    const summary: WeeklyReportSummary = {
      published,
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      saves: totalSaves,
      avgEngagement,
    };

    const plainBody = `${company.name} 담당자님께\n\n지난 7일간 성과를 보내드립니다.\n\n발행 콘텐츠: ${published}건\n조회수 합계: ${totalViews.toLocaleString(
      "ko-KR",
    )}\n좋아요 합계: ${totalLikes.toLocaleString(
      "ko-KR",
    )}\n댓글 합계: ${totalComments.toLocaleString(
      "ko-KR",
    )}\n평균 참여율: ${avgEngagement}\n\n자세한 내용은 회원사 사이트 성과 탭에서 확인하실 수 있습니다.\n`;

    const html = buildWeeklyReportHtml({
      companyName: company.name,
      summary,
      posts: uniquePosts,
    });

    const { error } = await sendAndLog(supabase, {
      companyId: company.id,
      kind: "리포트",
      to: company.contact_email,
      subject: `[BrandSlam] ${company.name} 주간 리포트`,
      body: plainBody,
      html,
    });
    if (!error) sent += 1;
  }
  return { sent };
}
