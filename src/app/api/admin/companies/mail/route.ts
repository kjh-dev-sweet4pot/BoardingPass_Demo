import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager, requireAnyAdmin } from "@/lib/access";
import {
  COMPANY_MAIL_LOG_SELECT,
  COMPANY_MAIL_KINDS,
  buildCompanyMailTemplate,
  isCompanyMailConfigured,
  isCompanyMailKind,
  isMailAddress,
  parseMailAddresses,
  resolveCompanyMailTo,
  sendCompanyMailViaResend,
} from "@/lib/company-mail";
import { CONTENT_FILES_BUCKET } from "@/lib/content-file-storage";
import { getAdminLoginId } from "@/lib/session";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const MAIL_ATTACH_MAX_BYTES = 8 * 1024 * 1024;

type GuidelineRow = {
  id: string;
  title: string | null;
  file_path: string | null;
};

function missingTable(message: string) {
  return (
    message.includes("company_mail_logs") ||
    message.toLowerCase().includes("schema cache")
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const companyId = new URL(request.url).searchParams.get("company_id");
  let query = supabase
    .from("company_mail_logs")
    .select(COMPANY_MAIL_LOG_SELECT)
    .order("created_at", { ascending: false })
    .limit(80);
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) {
    if (missingTable(error.message)) {
      return NextResponse.json({
        logs: [],
        configured: isCompanyMailConfigured(),
        kinds: COMPANY_MAIL_KINDS,
        setup:
          "scripts/sql/company-mail.sql 을 Supabase SQL editor에서 실행하세요.",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    logs: data || [],
    configured: isCompanyMailConfigured(),
    kinds: COMPANY_MAIL_KINDS,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const form = await request.formData();
  const companyId = String(form.get("company_id") || "").trim();
  const campaignId = String(form.get("campaign_id") || "").trim();
  const kindRaw = String(form.get("kind") || "").trim();
  const toRaw = String(form.get("to_emails") || "").trim();
  let subject = String(form.get("subject") || "").trim();
  let body = String(form.get("body") || "").trim();
  const attachGuideline = form.get("attach_guideline") !== "0";

  if (!companyId) {
    return NextResponse.json({ error: "회원사를 선택하세요." }, { status: 400 });
  }
  if (!isCompanyMailKind(kindRaw)) {
    return NextResponse.json({ error: "메일 종류를 선택하세요." }, { status: 400 });
  }

  let companyRow: {
    id: string;
    name: string;
    contact: string | null;
    contact_email?: string | null;
  } | null = null;
  const withEmail = await supabase
    .from("companies")
    .select("id, name, contact, contact_email")
    .eq("id", companyId)
    .maybeSingle();
  if (withEmail.data) {
    companyRow = withEmail.data;
  } else {
    const fallback = await supabase
      .from("companies")
      .select("id, name, contact")
      .eq("id", companyId)
      .maybeSingle();
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }
    companyRow = fallback.data;
  }
  if (!companyRow) {
    return NextResponse.json({ error: "회원사를 찾을 수 없습니다." }, { status: 404 });
  }

  let campaignName: string | null = null;
  if (campaignId) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, name, company_id")
      .eq("id", campaignId)
      .maybeSingle();
    if (!campaign || campaign.company_id !== companyId) {
      return NextResponse.json(
        { error: "캠페인이 해당 회원사 소속이 아닙니다." },
        { status: 400 },
      );
    }
    campaignName = campaign.name;
  }

  const to = parseMailAddresses(toRaw).filter(isMailAddress);
  if (to.length === 0) {
    const fallbackTo = resolveCompanyMailTo(companyRow);
    if (fallbackTo) to.push(fallbackTo);
  }
  if (to.length === 0) {
    return NextResponse.json(
      { error: "수신 메일 주소가 없습니다. 회원사 수신 메일을 등록하세요." },
      { status: 400 },
    );
  }

  const template = buildCompanyMailTemplate({
    kind: kindRaw,
    companyName: companyRow.name,
    campaignName,
  });
  if (!subject) subject = template.subject;
  if (!body) body = template.body;

  const attachments: { filename: string; content: string }[] = [];
  const attachmentNames: string[] = [];

  const uploads = form.getAll("files").filter((f): f is File => f instanceof File);
  for (const file of uploads) {
    if (!file.size) continue;
    if (file.size > MAIL_ATTACH_MAX_BYTES) {
      return NextResponse.json(
        { error: `${file.name} 첨부는 8MB 이하여야 합니다.` },
        { status: 400 },
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    attachments.push({
      filename: file.name.slice(0, 120) || "file",
      content: bytes.toString("base64"),
    });
    attachmentNames.push(file.name);
  }

  if (attachGuideline && kindRaw === "컨텐츠 가이드라인") {
    let gQuery = supabase
      .from("guidelines")
      .select("id, title, file_path, campaigns!inner(company_id)")
      .eq("campaigns.company_id", companyId)
      .not("file_path", "is", null)
      .limit(5);
    if (campaignId) gQuery = gQuery.eq("campaign_id", campaignId);
    const { data: guidelines } = await gQuery;
    for (const g of (guidelines || []) as GuidelineRow[]) {
      if (!g.file_path) continue;
      const { data: blob, error: dlErr } = await supabase.storage
        .from(CONTENT_FILES_BUCKET)
        .download(g.file_path);
      if (dlErr || !blob) continue;
      const bytes = Buffer.from(await blob.arrayBuffer());
      if (bytes.length > MAIL_ATTACH_MAX_BYTES) continue;
      const filename = `${(g.title || "guideline").replace(/\s+/g, "_")}.pdf`;
      attachments.push({ filename, content: bytes.toString("base64") });
      attachmentNames.push(filename);
    }
  }

  let sentAt: string | null = null;
  let sendError: string | null = null;
  try {
    await sendCompanyMailViaResend({ to, subject, body, attachments });
    sentAt = new Date().toISOString();
  } catch (err) {
    sendError = err instanceof Error ? err.message : "메일 발송 실패";
  }

  const createdBy = (await getAdminLoginId()) || "운영관리자";
  const { data: log, error: logError } = await supabase
    .from("company_mail_logs")
    .insert({
      company_id: companyId,
      campaign_id: campaignId || null,
      kind: kindRaw,
      to_emails: to,
      subject,
      body,
      attachment_names: attachmentNames,
      sent_at: sentAt,
      error: sendError,
      created_by: createdBy,
    })
    .select(COMPANY_MAIL_LOG_SELECT)
    .maybeSingle();

  if (sendError) {
    return NextResponse.json(
      { error: sendError, log: log || null, logError: logError?.message },
      { status: 502 },
    );
  }
  if (logError) {
    return NextResponse.json({
      ok: true,
      warning: missingTable(logError.message)
        ? "메일은 발송됐지만 이력 테이블이 없습니다. scripts/sql/company-mail.sql 을 실행하세요."
        : logError.message,
    });
  }
  return NextResponse.json({ ok: true, log });
}
