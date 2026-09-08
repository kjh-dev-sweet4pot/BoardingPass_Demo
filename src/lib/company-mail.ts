export const COMPANY_MAIL_KINDS = [
  "계약서",
  "견적서",
  "청구서",
  "컨텐츠 가이드라인",
  "리포트",
] as const;

export type CompanyMailKind = (typeof COMPANY_MAIL_KINDS)[number];

export const COMPANY_MAIL_LOG_SELECT =
  "id, company_id, campaign_id, kind, to_emails, subject, body, attachment_names, sent_at, error, created_by, created_at";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCompanyMailKind(v: string): v is CompanyMailKind {
  return (COMPANY_MAIL_KINDS as readonly string[]).includes(v);
}

export function parseMailAddresses(raw: string) {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isMailAddress(v: string) {
  return EMAIL_RE.test(v);
}

export function resolveCompanyMailTo(company: {
  contact_email?: string | null;
  contact?: string | null;
}) {
  const fromCol = String(company.contact_email || "").trim();
  if (isMailAddress(fromCol)) return fromCol;
  const contact = String(company.contact || "").trim();
  if (isMailAddress(contact)) return contact;
  return "";
}

function todayKst() {
  return new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

export const SENDER_COMPANY = "BrandSlam";

export function senderIntro(managerName?: string | null) {
  const name = (managerName || "").trim();
  return name
    ? `안녕하세요. ${SENDER_COMPANY} ${name}입니다.`
    : `안녕하세요. ${SENDER_COMPANY}입니다.`;
}

export function buildCompanyMailTemplate(input: {
  kind: CompanyMailKind;
  companyName: string;
  campaignName?: string | null;
  managerName?: string | null;
}) {
  const client = input.companyName.trim() || "회원사";
  const campaign = input.campaignName?.trim() || "";
  const campaignLine = campaign ? `캠페인: ${campaign}\n` : "";
  const date = todayKst();
  const hello = senderIntro(input.managerName);

  const bodies: Record<CompanyMailKind, { subject: string; body: string }> = {
    계약서: {
      subject: `[${SENDER_COMPANY}] ${client} 계약서 송부`,
      body: `${client} 담당자님께\n\n${hello}\n${campaignLine}계약서를 첨부하여 보내드립니다. 내용 확인 후 회신 부탁드립니다.\n\n발송일: ${date}\n`,
    },
    견적서: {
      subject: `[${SENDER_COMPANY}] ${client} 견적서 송부`,
      body: `${client} 담당자님께\n\n${hello}\n${campaignLine}견적서를 첨부하여 보내드립니다. 금액·범위 확인 후 회신 부탁드립니다.\n\n발송일: ${date}\n`,
    },
    청구서: {
      subject: `[${SENDER_COMPANY}] ${client} 청구서 송부`,
      body: `${client} 담당자님께\n\n${hello}\n${campaignLine}청구서를 첨부하여 보내드립니다. 입금 일정은 계약 조건을 따릅니다.\n\n발송일: ${date}\n`,
    },
    "컨텐츠 가이드라인": {
      subject: `[${SENDER_COMPANY}] ${client} 컨텐츠 가이드라인`,
      body: `${client} 담당자님께\n\n${hello}\n${campaignLine}콘텐츠 제작 시 참고할 가이드라인을 보내드립니다. 검수 결정은 운영자가 수행합니다.\n\n발송일: ${date}\n`,
    },
    리포트: {
      subject: `[${SENDER_COMPANY}] ${client} 캠페인 리포트`,
      body: `${client} 담당자님께\n\n${hello}\n${campaignLine}캠페인 성과 리포트를 보내드립니다. 지표는 조회 시점 기준 누적값입니다.\n\n발송일: ${date}\n`,
    },
  };
  return bodies[input.kind];
}

export function escapeMailHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mailTextToHtml(text: string) {
  return `<p style="white-space:pre-wrap;font-family:sans-serif;font-size:14px;line-height:1.6;color:#222">${escapeMailHtml(text)}</p>`;
}

export function mailSignatureHtml(input: {
  managerName?: string | null;
  imageDataUrl?: string | null;
}) {
  const name = (input.managerName || "").trim();
  const img = input.imageDataUrl
    ? `<img src="${input.imageDataUrl}" alt="" style="max-height:72px;max-width:220px;display:block;margin:0 0 10px"/>`
    : "";
  const who = name
    ? `${escapeMailHtml(name)}<br/>${SENDER_COMPANY}`
    : SENDER_COMPANY;
  return `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e0d8;font-family:sans-serif;font-size:13px;line-height:1.5;color:#333">
${img}<p style="margin:0">${who}</p>
</div>`;
}

export function buildCompanyMailHtml(
  body: string,
  signature?: { managerName?: string | null; imageDataUrl?: string | null },
) {
  return `${mailTextToHtml(body)}${mailSignatureHtml(signature || {})}`;
}

const DEFAULT_MAIL_FROM = "BrandSlam <manager@slam-global.com>";

export function getCompanyMailFrom() {
  const raw = process.env.COMPANY_MAIL_FROM?.trim() || "";
  if (!raw || /boardingpass\.local|resend\.dev|updates\.slam-global\.com/i.test(raw)) {
    return DEFAULT_MAIL_FROM;
  }
  return raw.replace(/^Boarding Pass\b/i, "BrandSlam").replace(/^Brandslam\b/, "BrandSlam");
}

function explainResendError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("not verified") || m.includes("domain is not verified")) {
    return (
      "From 주소의 도메인이 이 API 키 계정에서 Verified가 아닙니다. " +
      "Resend는 서브도메인과 루트를 별개로 봅니다. " +
      "`updates.slam-global.com` 인증만으로는 `manager@slam-global.com` 발신이 안 됩니다. " +
      `(Resend: ${message})`
    );
  }
  if (m.includes("only send testing") || m.includes("your own email")) {
    return (
      "Resend 테스트 발신은 가입 메일로만 보낼 수 있습니다. " +
      `From을 인증된 도메인 주소로 바꿔야 합니다. (Resend: ${message})`
    );
  }
  return message;
}

export function isCompanyMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export type ResendDomainRow = { name: string; status: string; region: string };

export async function probeResendMailAccount() {
  const from = getCompanyMailFrom();
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { from, configured: false, domains: [] as ResendDomainRow[], error: "RESEND_API_KEY 없음" };
  }
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { name?: string; status?: string; region?: string }[];
    message?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      from,
      configured: true,
      domains: [] as ResendDomainRow[],
      error: json.error?.message || json.message || `Resend domains ${res.status}`,
    };
  }
  const domains = (json.data || []).map((d) => ({
    name: String(d.name || ""),
    status: String(d.status || ""),
    region: String(d.region || ""),
  }));
  return { from, configured: true, domains, error: null as string | null };
}

export type MailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export async function sendCompanyMailViaResend(input: {
  to: string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: MailAttachment[];
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "RESEND_API_KEY가 없습니다. 서버 환경변수에 Resend API 키와 COMPANY_MAIL_FROM을 설정하세요.",
    );
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getCompanyMailFrom(),
      to: input.to,
      subject: input.subject,
      text: input.body,
      html: input.html || mailTextToHtml(input.body),
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    const probe = await probeResendMailAccount();
    const seen = probe.error
      ? probe.error
      : probe.domains.map((d) => `${d.name}:${d.status}`).join(", ") || "도메인 없음";
    throw new Error(
      `${explainResendError(
        json.error?.message || json.message || `메일 발송 실패 (${res.status})`,
      )} (from: ${probe.from} · 이 키의 도메인: ${seen})`,
    );
  }
  return { id: json.id || null };
}

function assertCompanyMailTemplates() {
  const t = buildCompanyMailTemplate({
    kind: "견적서",
    companyName: "KnownBeauty",
    campaignName: "긴자점",
    managerName: "김매니저",
  });
  if (
    !t.subject.includes("BrandSlam") ||
    !t.subject.includes("KnownBeauty") ||
    !t.body.includes("긴자점") ||
    !t.body.includes("BrandSlam 김매니저")
  ) {
    throw new Error("company-mail template failed");
  }
  const plain = buildCompanyMailTemplate({
    kind: "계약서",
    companyName: "A",
  });
  if (!plain.body.includes("안녕하세요. BrandSlam입니다.")) {
    throw new Error("company-mail intro failed");
  }
  if (parseMailAddresses("a@b.co, c@d.co").length !== 2) {
    throw new Error("company-mail parse failed");
  }
}

if (process.env.RUN_COMPANY_MAIL_SELF_CHECK === "1") {
  assertCompanyMailTemplates();
  console.log("company-mail self-check ok");
}
