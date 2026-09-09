import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

function localChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(p)) || null;
}

/** 계약서·인보이스 HTML을 A4 PDF 바이트로 변환. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const chrome = localChrome();
  const browser = chrome
    ? await puppeteer.launch({
        executablePath: chrome,
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none"],
      })
    : await launchChromium();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function launchChromium() {
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}
