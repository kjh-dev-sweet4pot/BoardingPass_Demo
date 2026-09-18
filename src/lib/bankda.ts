const BANKDA_BASE = "https://a.bankda.com/dtsvc/hub_merchant.php";

function headers() {
  const token = process.env.BANKDA_ACCESS_TOKEN;
  if (!token) throw new Error("BANKDA_ACCESS_TOKEN not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface BankdaTransaction {
  /** 거래일시 */
  tran_date: string;
  /** 적요 */
  remark: string;
  /** 입금액 */
  in_amt: number;
  /** 출금액 */
  out_amt: number;
  /** 잔액 */
  balance: number;
  [key: string]: unknown;
}

export interface BankdaTransactionsResult {
  transactions: BankdaTransaction[];
  /** 원본 응답 (파싱 참고용) */
  raw?: unknown;
}

/** 거래내역 조회
 * from_date / to_date: "YYYYMMDD" 형식
 * ponytail: 실제 파라미터명은 Bankda 문서 수령 후 맞춰야 함 */
export async function fetchTransactions(
  from_date: string,
  to_date: string,
): Promise<BankdaTransactionsResult> {
  const url = new URL(BANKDA_BASE);
  url.searchParams.set("from_date", from_date);
  url.searchParams.set("to_date", to_date);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: headers(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Bankda ${res.status}: ${await res.text()}`);
  }

  const raw = await res.json();

  // ponytail: 응답 스키마 미확인 — 키 이름 수령 후 파싱 조정
  const list: BankdaTransaction[] = Array.isArray(raw)
    ? raw
    : (raw?.transactions ?? raw?.data ?? raw?.list ?? []);

  return { transactions: list, raw };
}
