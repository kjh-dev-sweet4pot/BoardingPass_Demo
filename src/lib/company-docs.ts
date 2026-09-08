/** 브랜드슬램 계약서·인보이스 양식. 원가·마진 없음. */

export const COMPANY_DOC_KINDS = ["계약서", "인보이스"] as const;
export type CompanyDocKind = (typeof COMPANY_DOC_KINDS)[number];

export const COMPANY_DOC_STATUSES = ["초안", "발행"] as const;
export type CompanyDocStatus = (typeof COMPANY_DOC_STATUSES)[number];

export const BRANDSLAM = {
  legalName: "주식회사 브랜드슬램",
  brandEn: "BRANDSLAM inc.",
  bizNo: "284-88-03016",
  ceo: "장현우",
  ceoEn: "JANG HYUNWOO",
  address: "서울시 강남구 테헤란로 7길 11, 한덕빌딩 9층 902호",
  addressEn: "902, 9F, Handeok Bldg, 11, Teheran-ro 7-gil, Gangnam-gu, Seoul, KOR",
  tel: "+821042924294",
  email: "jhw@slam-global.com",
  bank: "IBK기업은행",
  bankEn: "Industrial Bank of Korea (IBK기업은행)",
  account: "057-124050-04-011",
  holder: "(주)브랜드슬램",
  swift: "IBKOKRSE",
  bankAddress: "EULJI-RO 82, IBK FINANCE TOWER FLOOR 16, JUNG-GU, SEOUL",
} as const;

export type DocLine = {
  description: string;
  qty: number;
  unitPrice: number;
  remark: string;
};

export type InvoicePayload = {
  invoiceNo: string;
  issuedOn: string;
  toName: string;
  toAddress: string;
  toTel: string;
  toEmail: string;
  lines: DocLine[];
};

export type ContractPayload = {
  issuedOn: string;
  partyAName: string;
  partyABrand: string;
  partyABizNo: string;
  partyACeo: string;
  partyAAddress: string;
  projectTitle: string;
  projectProducts: string;
  amountExVat: number;
  lines: DocLine[];
  /** 불러온 인보이스. 별첨에 원본 양식 그대로 붙임 */
  attachedInvoice?: InvoicePayload | null;
};

export type CompanyDocRow = {
  id: string;
  company_id: string;
  kind: CompanyDocKind;
  title: string;
  status: CompanyDocStatus;
  issued_on: string | null;
  payload: InvoicePayload | ContractPayload;
  created_at: string;
  updated_at: string;
};

export function emptyLine(): DocLine {
  return { description: "", qty: 1, unitPrice: 0, remark: "" };
}

export function lineAmount(line: DocLine) {
  const qty = Number(line.qty) || 0;
  const unit = Number(line.unitPrice) || 0;
  return Math.round(qty * unit);
}

export function invoiceTotals(lines: DocLine[]) {
  const subtotal = lines.reduce((s, l) => s + lineAmount(l), 0);
  const vat = Math.round(subtotal * 0.1);
  return { subtotal, vat, grand: subtotal + vat };
}

export function ymdKst(d = new Date()) {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export function formatDocKrw(n: number) {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

/** 123-45-67890 */
export function formatBizNo(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export function defaultInvoiceNo(loginId?: string | null) {
  const ymd = ymdKst().replace(/-/g, "").slice(2, 8);
  const slug = (loginId || "co").replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "co";
  return `slam${ymd}${slug}`;
}

export function defaultInvoicePayload(company: {
  name: string;
  contact?: string | null;
  contact_email?: string | null;
  login_id?: string | null;
}): InvoicePayload {
  return {
    invoiceNo: defaultInvoiceNo(company.login_id),
    issuedOn: ymdKst(),
    toName: company.name,
    toAddress: "",
    toTel: company.contact || "",
    toEmail: company.contact_email || "",
    lines: [emptyLine()],
  };
}

export function defaultContractPayload(company: {
  name: string;
}): ContractPayload {
  return {
    issuedOn: ymdKst(),
    partyAName: company.name,
    partyABrand: company.name,
    partyABizNo: "",
    partyACeo: "",
    partyAAddress: "",
    projectTitle: `${company.name} 마케팅 협업 프로젝트`,
    projectProducts: "",
    amountExVat: 0,
    lines: [emptyLine()],
    attachedInvoice: null,
  };
}

export function applyInvoiceToContract(
  contract: ContractPayload,
  invoice: InvoicePayload,
): ContractPayload {
  const lines = invoice.lines.map((l) => ({ ...l }));
  return {
    ...contract,
    lines,
    amountExVat: invoiceTotals(lines).subtotal,
    attachedInvoice: { ...invoice, lines },
  };
}

export function contractAnnexInvoice(payload: ContractPayload): InvoicePayload {
  if (payload.attachedInvoice) {
    return { ...payload.attachedInvoice, lines: payload.lines };
  }
  return {
    invoiceNo: "견적",
    issuedOn: payload.issuedOn,
    toName: payload.partyAName,
    toAddress: payload.partyAAddress,
    toTel: "",
    toEmail: "",
    lines: payload.lines,
  };
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printShell(_title: string, body: string, printBar = true) {
  const bar = printBar
    ? `<div class="no-print bar">
  <button type="button" onclick="window.print()">인쇄 / PDF 저장</button>
  <span>인쇄 창에서 「머리글 및 바닥글」을 끄면 날짜·제목이 안 나옵니다.</span>
</div>`
    : "";
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title></title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  html, body { margin: 0; }
  body {
    font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    color: #1a1a1a;
    font-size: 11.5pt;
    line-height: 1.55;
  }
  h1 { font-size: 18pt; letter-spacing: 0.08em; margin: 0 0 12px; }
  h2 { font-size: 12.5pt; margin: 20px 0 8px; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; vertical-align: top; }
  th { background: #f4f1ea; font-weight: 600; text-align: left; }
  .right { text-align: right; }
  .muted { color: #666; }
  .meta { white-space: pre-wrap; margin: 0 0 14px; }
  .sign { margin-top: 36px; break-inside: avoid; }
  p { margin: 0 0 8px; }
  ul { margin: 0 0 10px; padding-left: 18px; }
  .bar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
    margin: 0 auto 12px; width: 210mm; font-size: 12px; color: #555;
  }
  .sheet {
    box-sizing: border-box;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 16mm;
    background: #fff;
  }
  @media screen {
    html, body { background: #d8d2c8; }
    body { padding: 16px 0 40px; }
    .sheet { box-shadow: 0 2px 18px rgba(0,0,0,.14); }
  }
  @media print {
    html, body { background: #fff !important; padding: 0; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    .no-print { display: none !important; }
  }
</style>
<script>
document.title = "";
window.addEventListener("beforeprint", function () { document.title = ""; });
</script>
</head>
<body>
${bar}
<div class="sheet">
${body}
</div>
</body>
</html>`;
}

export function invoiceTableHtml(lines: DocLine[]) {
  const t = invoiceTotals(lines);
  const rows = lines
    .map((l, i) => {
      const amt = lineAmount(l);
      return `<tr>
        <td class="right">${i + 1}</td>
        <td>${esc(l.description)}</td>
        <td class="right">${l.qty || ""}</td>
        <td class="right">${l.unitPrice ? formatDocKrw(l.unitPrice) : ""}</td>
        <td class="right">${amt ? formatDocKrw(amt) : ""}</td>
        <td>${esc(l.remark)}</td>
      </tr>`;
    })
    .join("");
  return `<table>
    <thead>
      <tr>
        <th>No.</th><th>Description</th><th>Qty</th>
        <th>Unit Price (KRW)</th><th>Amount (KRW)</th><th>REMARK</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="4" class="right">TOTAL</td><td class="right">${formatDocKrw(t.subtotal)}</td><td></td></tr>
      <tr><td colspan="4" class="right">VAT 10%</td><td class="right">${formatDocKrw(t.vat)}</td><td></td></tr>
      <tr><td colspan="4" class="right"><b>GRAND TOTAL</b></td><td class="right"><b>${formatDocKrw(t.grand)}</b></td><td></td></tr>
    </tfoot>
  </table>`;
}

export function invoiceBodyHtml(payload: InvoicePayload) {
  return `
  <p class="muted">${esc(BRANDSLAM.brandEn)}<br/>
  ADD : ${esc(BRANDSLAM.addressEn)}<br/>
  TELP : ${esc(BRANDSLAM.tel)}<br/>
  EMAIL : ${esc(BRANDSLAM.email)}</p>
  <h1>INVOICE</h1>
  <p class="meta">INVOICE NO : ${esc(payload.invoiceNo)}
DATE : ${esc(payload.issuedOn)}
TO : ${esc(payload.toName)}
ADD : ${esc(payload.toAddress)}
TELP : ${esc(payload.toTel)}
EMAIL : ${esc(payload.toEmail)}</p>
  ${invoiceTableHtml(payload.lines)}
  <p class="meta" style="margin-top:16px">Swift code : ${esc(BRANDSLAM.swift)}
Account Number : ${esc(BRANDSLAM.account)}
Name of Bank : ${esc(BRANDSLAM.bankEn)}
Address of Bank : ${esc(BRANDSLAM.bankAddress)}
BENEFICIARY : BRANDSLAM</p>
  <p class="sign">Approved by,<br/><b>${esc(BRANDSLAM.brandEn)}</b><br/>${esc(BRANDSLAM.ceoEn)}<br/>ceo</p>`;
}

export function invoiceHtml(payload: InvoicePayload, printBar = true) {
  return printShell(`INVOICE ${payload.invoiceNo}`, invoiceBodyHtml(payload), printBar);
}

export function contractHtml(payload: ContractPayload, printBar = true) {
  const quote = invoiceTotals(payload.lines);
  const amountEx = payload.amountExVat || quote.subtotal;
  const vatInc = Math.round(amountEx * 1.1);
  const issued = payload.issuedOn.replace(/-/g, ".");
  const aBiz = payload.partyABizNo.trim() || "(미기재)";
  const body = `
  <h1 style="text-align:center">마케팅 대행 계약서</h1>
  <p>본 계약은 ${esc(payload.partyAName)}(사업자등록번호 ${esc(aBiz)}, 이하 "A")가 운영하는 브랜드 '${esc(payload.partyABrand)}'의 ${esc(payload.projectProducts || "마케팅 협업 프로젝트")} 수행과 관련하여, A와 ${esc(BRANDSLAM.legalName)}(사업자등록번호 ${esc(BRANDSLAM.bizNo)}, 이하 "B") 간의 기본적인 권리·의무 및 책임사항을 정함을 목적으로 한다.</p>
  <h2>제1조(목적)</h2>
  <p>본 계약은 A가 B에 의뢰하는 '${esc(payload.partyABrand)}' ${esc(payload.projectTitle)}(이하 "본 프로젝트") 수행과 관련된 A와 B의 기본적인 권리·의무 및 책임사항을 명확히 하여 상호 분쟁을 예방하는 것을 목적으로 한다.</p>
  <h2>제2조(계약의 성격)</h2>
  <p>1. 본 계약은 지속적으로 자동 갱신되는 정기 계약이 아닌, 본 프로젝트를 대상으로 하는 프로젝트 단위의 마케팅 대행 계약이다. 본 프로젝트 종료 이후 추가 협업이 필요한 경우, A와 B는 프로젝트별로 별도 계약을 체결하여 진행한다.</p>
  <p>2. B는 A가 제안한 마케팅 컨텐츠, 인플루언서 셀렉팅 리스트, 캠페인 일정 등을 포함한 실행 계획을 A에게 사전 공유하며, A와 B가 실행 계획에 대해 상호 합의한 이후 업무를 개시한다.</p>
  <p>3. A와 B는 신속한 의사결정을 위해 노력한다.</p>
  <h2>제3조(업무 범위)</h2>
  <p>B는 본 프로젝트와 관련하여 다음 각 호의 업무를 수행한다. 본 콘텐츠(이미지, 영상 등)는 A가 2차 마케팅/광고 활용이 가능하도록 B는 협의를 완료하여야 한다.</p>
  <ul>
    <li>인플루언서 셀렉팅 및 매칭</li>
    <li>콘텐츠 전략 기획 및 시딩 운영</li>
    <li>실행 계획 수립 및 A와의 공유·협의</li>
    <li>캠페인 운영 및 모니터링</li>
    <li>실행 결과 공유 및 개선안 제안</li>
  </ul>
  <p>세부 실행 계획 및 운영 항목은 별첨에 따르며, 별첨의 내용은 제5조에 따라 변경될 수 있다.</p>
  <h2>제4조(계약 금액 및 지급 조건)</h2>
  <p>1. 본 프로젝트의 계약금액은 ${formatDocKrw(amountEx)}(VAT별도, 총 ${formatDocKrw(vatInc)})으로 한다.</p>
  <p>2. 본 프로젝트 이후 추가로 진행하는 프로젝트의 계약금액은 프로젝트별로 A와 B가 별도 협의하여 정한다.</p>
  <p>3. 본 프로젝트의 결제조건은 계약 체결과 동시에 계약금액 전액(${formatDocKrw(vatInc)})을 선입금함을 원칙으로 한다.</p>
  <p>4. 결제 방식: 계좌이체<br/>입금 계좌: ${esc(BRANDSLAM.bank)} ${esc(BRANDSLAM.account)} (예금주: ${esc(BRANDSLAM.holder)})</p>
  <h2>제5조(업무 계획의 유연성)</h2>
  <p>1. 별첨에 기재되는 업무 내용, 실행 계획, 단가 및 인원 구성 등은 계약체결 시점의 계획이며, 실제 집행 과정에서 변동될 수 있다.</p>
  <p>2. A는 B가 인플루언서와 협의하는 과정에서 발생하는 단가의 변동 및 이에 따른 인원 수의 변동을 인지하되, A와 B가 계약서에 합의된 마케팅 예산 범위 내에서 실행한다.</p>
  <p>3. B는 마케팅 수행 전 계획 및 수행 후 성과 등을 A와 공유할 수 있도록 노력하며, 마케팅 실행이 완료된 이후 결과 보고서를 A에게 공유한다.</p>
  <h2>제6조(성과 비보장 및 책임의 제한)</h2>
  <p>1. 본 계약은 성과 보장형 계약이 아니다. 매출, 조회수, 참여율 등 구체적 수치는 보장되지 않는다.</p>
  <p>2. B는 플랫폼 정책 변경, 크리에이터 표현 방식, 시장 환경 변화 등으로 인한 결과 변동에 대해 책임을 지지 않는다.</p>
  <p>3. 최종 매출 및 마케팅 성과에 대한 책임은 A에게 귀속된다.</p>
  <h2>제7조(직접 소통 제한)</h2>
  <p>A와 B는 계약 기간 중 상대방의 사전 서면 동의 없이 해당 인플루언서와 직접 계약·연락을 진행할 수 없다.</p>
  <h2>제8조(기밀 유지)</h2>
  <p>양 당사자는 계약 기간 중 및 종료 후에도 계약 관련 정보를 외부에 공개할 수 없다.</p>
  <h2>제9조(계약 해지)</h2>
  <p>1. 어느 일방이 본 계약을 중대하게 위반하고 상당한 기간 내에 이를 시정하지 않는 경우, 상대방은 서면 통지로 즉시 계약을 해지할 수 있다.</p>
  <p>2. 계약 해지 시 해지일까지 수행된 업무에 대한 마케팅비는 제4조의 기준에 따라 정산하여 지급한다.</p>
  <p>3. 단, B의 중대한 과실이나 이행 지체로 계약이 해지될 경우, B는 A로부터 받은 결제금액에 대해 실행되지 않은 부분만큼 반환해야 한다.</p>
  <h2>제10조(분쟁 및 관할)</h2>
  <p>본 계약은 대한민국 법을 준거법으로 하며, 서울중앙지방법원을 전속 관할로 한다.</p>
  <p>본 계약의 내용을 증명하기 위하여 계약서 2부를 작성하여 A와 B가 기명날인하고 각 1부씩 보관한다.</p>
  <p>계약일: ${esc(issued)}</p>
  <p>A: ${esc(payload.partyAName)} (브랜드: ${esc(payload.partyABrand)})<br/>
  사업자등록번호: ${esc(aBiz)} / 대표: ${esc(payload.partyACeo || "(미기재)")} (인)<br/>
  주소: ${esc(payload.partyAAddress)}</p>
  <p>B: ${esc(BRANDSLAM.legalName)} / 사업자등록번호 ${esc(BRANDSLAM.bizNo)} / 대표이사 ${esc(BRANDSLAM.ceo)} (인)<br/>
  주소: ${esc(BRANDSLAM.address)}</p>
  <h2>별첨 1. 서비스 내용</h2>
  <p>1. 서비스 개요<br/>서비스 명칭: ${esc(payload.projectTitle)}<br/>
  서비스 목표: 인플루언서 마케팅을 중심으로 한 노출 확대 및 매출 향상<br/>
  계약 기간: 계약 체결일로부터 본 프로젝트 종료 시까지</p>
  <p>2. 정산 기준<br/>본 별첨의 운영 항목 및 견적 구성 변경과 무관하게, 실제 청구·정산 기준 금액은 제4조에 따른 계약금액 ${formatDocKrw(amountEx)}(VAT별도)으로 고정된다.</p>
  <h2>별첨 2. 견적 인보이스</h2>
  ${invoiceBodyHtml(contractAnnexInvoice(payload))}
  <p>※ 상기 인보이스는 업무 범위의 명확성을 위해 참고로 제시하는 견적이며, 실제 청구·정산 기준 금액은 제4조에 따른 계약금액 ${formatDocKrw(amountEx)}(VAT별도)으로 고정된다.</p>`;
  return printShell(`마케팅 대행 계약서 ${payload.partyABrand}`, body, printBar);
}

export function docHtml(
  kind: CompanyDocKind,
  payload: InvoicePayload | ContractPayload,
  printBar = true,
) {
  if (kind === "인보이스") return invoiceHtml(payload as InvoicePayload, printBar);
  return contractHtml(payload as ContractPayload, printBar);
}

export function mailDocFilename(
  kind: CompanyDocKind,
  title: string,
  payload?: InvoicePayload | ContractPayload,
) {
  const invoiceNo =
    kind === "인보이스" && payload && "invoiceNo" in payload
      ? String(payload.invoiceNo || "").trim()
      : "";
  const raw = (invoiceNo || title || kind).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "_");
  const base = raw.slice(0, 80) || kind;
  return `${base}.html`;
}

if (process.env.RUN_COMPANY_DOCS_SELF_CHECK === "1") {
  const t = invoiceTotals([
    { description: "약사 콘텐츠", qty: 4, unitPrice: 1_500_000, remark: "" },
    { description: "메가", qty: 1, unitPrice: 3_000_000, remark: "" },
    { description: "미들", qty: 1, unitPrice: 1_000_000, remark: "" },
  ]);
  if (t.subtotal !== 10_000_000 || t.vat !== 1_000_000 || t.grand !== 11_000_000) {
    throw new Error(`invoiceTotals ${JSON.stringify(t)}`);
  }
  const html = invoiceHtml(defaultInvoicePayload({ name: "클리어디어", login_id: "cleardear" }));
  if (!html.includes("INVOICE") || !html.includes(BRANDSLAM.account)) {
    throw new Error("invoiceHtml");
  }
  if (formatBizNo("1234567890") !== "123-45-67890") throw new Error("formatBizNo");
  if (formatDocKrw(1500000) !== "₩1,500,000" || formatDocKrw(1500000).includes("\\")) {
    throw new Error("formatDocKrw");
  }
  const chtml = contractHtml({
    ...defaultContractPayload({ name: "클리어디어" }),
    partyABizNo: "123-45-67890",
    lines: [{ description: "약사 콘텐츠", qty: 4, unitPrice: 1_500_000, remark: "" }],
    amountExVat: 6_000_000,
  });
  if (!chtml.includes("123-45-67890") || !chtml.includes("견적 인보이스") || !chtml.includes("GRAND TOTAL")) {
    throw new Error("contractHtml annex");
  }
  const inv = defaultInvoicePayload({ name: "클리어디어", login_id: "cleardear" });
  inv.invoiceNo = "slam260908cd";
  inv.lines = [{ description: "약사 콘텐츠", qty: 2, unitPrice: 1_000_000, remark: "" }];
  const attached = applyInvoiceToContract(defaultContractPayload({ name: "클리어디어" }), inv);
  if (attached.amountExVat !== 2_000_000 || attached.attachedInvoice?.invoiceNo !== "slam260908cd") {
    throw new Error("applyInvoiceToContract");
  }
  const loaded = contractHtml({ ...attached, partyABizNo: "123-45-67890" });
  if (!loaded.includes("slam260908cd") || !loaded.includes(BRANDSLAM.account)) {
    throw new Error("contractHtml loaded invoice");
  }
  if (mailDocFilename("인보이스", "x", inv) !== "slam260908cd.html") {
    throw new Error("mailDocFilename");
  }
  console.log("company-docs self-check ok");
}
