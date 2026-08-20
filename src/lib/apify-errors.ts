const APIFY_BASE = "https://api.apify.com/v2";

/** Apify run-sync 실패 시 run ID·로그 URL을 에러에 포함 */
export async function apifyErrorMessage(status: number, bodyText: string) {
  let detail = bodyText.slice(0, 400);
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string; type?: string };
    };
    if (parsed.error?.message) detail = parsed.error.message;
  } catch {
    // raw text 유지
  }

  const runIdMatch = detail.match(/run ID: ([^,\s)]+)/i);
  const runId = runIdMatch?.[1];
  let logHint = "";
  if (runId && process.env.APIFY_TOKEN?.trim()) {
    try {
      const logRes = await fetch(
        `${APIFY_BASE}/acts/any/runs/${runId}/log?token=${process.env.APIFY_TOKEN}&stream=0&tail=20`,
      );
      if (logRes.ok) {
        const tail = (await logRes.text()).trim().split("\n").slice(-5).join("\n");
        if (tail) logHint = `\n[Apify log tail]\n${tail}`;
      }
    } catch {
      // 로그 조회 실패는 무시
    }
    logHint += `\n→ https://console.apify.com/actors/runs/${runId}`;
  }

  return `Apify error ${status}: ${detail}${logHint}`;
}
