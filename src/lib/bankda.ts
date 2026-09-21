const BANKDA_BASE = "https://a.bankda.com/dtsvc/bank_tr.php";

function getAuthHeader() {
  const token = process.env.BANKDA_ACCESS_TOKEN;
  if (!token) throw new Error("BANKDA_ACCESS_TOKEN not set");
  return `Bearer ${token.trim()}`;
}

export interface BankdaTransaction {
  bkcode?: number | string;
  accountnum?: string;
  bkname?: string;
  bkdate?: string;
  bktime?: string;
  bkjukyo?: string;
  bkcontent?: string;
  bketc?: string;
  bkinput?: string | number;
  bkoutput?: string | number;
  bkjango?: string | number;
  [key: string]: unknown;
}

export interface BankdaTransactionsResult {
  transactions: BankdaTransaction[];
  raw?: unknown;
}

/** 
 * 뱅크다 입출금 거래내역 조회 (POST https://a.bankda.com/dtsvc/bank_tr.php)
 * datefrom/dateto: YYYYMMDD
 * istest: y일 경우 5분 요청제한 없이 최근 2건 반환
 */
export async function fetchTransactions(params: {
  datefrom: string;
  dateto: string;
  accountnum?: string;
  istest?: boolean;
}): Promise<BankdaTransactionsResult> {
  const formData = new FormData();
  formData.append("datefrom", params.datefrom);
  formData.append("dateto", params.dateto);
  formData.append("datatype", "json");
  formData.append("charset", "utf8");
  if (params.accountnum) formData.append("accountnum", params.accountnum);
  if (params.istest) formData.append("istest", "y");

  const res = await fetch(BANKDA_BASE, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
    },
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Bankda HTTP ${res.status}: ${await res.text()}`);
  }

  const raw = await res.json();

  // 뱅크다 실제 응답 키: raw.response.bank
  const list: BankdaTransaction[] = Array.isArray(raw)
    ? raw
    : (raw?.response?.bank ?? raw?.bank ?? raw?.data ?? raw?.list ?? raw?.transactions ?? []);

  return { transactions: list, raw };
}
