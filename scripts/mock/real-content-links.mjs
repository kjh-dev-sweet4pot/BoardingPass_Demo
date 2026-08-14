/** Public skincare posts/videos that actually open. Demo-only; not KnownBeauty owned. */
export const REAL_CONTENT_LINKS = [
  // YouTube
  "https://www.youtube.com/watch?v=xGN58NmbhYg",
  "https://www.youtube.com/watch?v=vSmspQ4x5Aw",
  "https://www.youtube.com/watch?v=7c_Q0loxarU",
  "https://www.youtube.com/watch?v=726Kje-DTVg",
  "https://www.youtube.com/watch?v=M-R3AiQhPjU",
  "https://www.youtube.com/watch?v=U6DmVw-Lto8",
  "https://www.youtube.com/watch?v=jVf8NbUmzT8",
  "https://www.youtube.com/watch?v=RmrGrKzVVp8",
  "https://www.youtube.com/watch?v=TUDbbG8qWek",
  "https://www.youtube.com/watch?v=4a60NJdV-7o",
  "https://www.youtube.com/watch?v=rCANra-nq_0",
  "https://www.youtube.com/watch?v=b2r9i5XpsMo",
  "https://www.youtube.com/watch?v=DyHr5jC11rc",
  "https://www.youtube.com/watch?v=r76p4i55-Us",
  "https://www.youtube.com/watch?v=cNlcapwWdaw",
  "https://www.youtube.com/watch?v=KP1GTBMycvs",
  "https://www.youtube.com/watch?v=9qrk5mAyAF4",
  "https://www.youtube.com/watch?v=ffeRl7pFEBo",
  "https://www.youtube.com/shorts/xPpLL9YYn5I",
  "https://www.youtube.com/shorts/0Z0SWPv4EP0",
  "https://www.youtube.com/shorts/M-7SuoMVCfI",
  "https://www.youtube.com/shorts/2UCfSHPVYmw",
  "https://www.youtube.com/shorts/AcTIHwlz8aQ",
  "https://www.youtube.com/shorts/jLldzXf-JLM",
  "https://www.youtube.com/shorts/K-Qc_-MXHw0",
  "https://www.youtube.com/shorts/eVRV5HDgzaA",
  // TikTok
  "https://www.tiktok.com/@drjuliansass/video/7586847688658914574",
  "https://www.tiktok.com/@4complexion/video/7483487183081327894",
  "https://www.tiktok.com/@kkrystalmarie/video/7255938963997723950",
  "https://www.tiktok.com/@kristingl/video/7557772110303612174",
  "https://www.tiktok.com/@kel__king/video/7293543656592657696",
  "https://www.tiktok.com/@kristingl/video/7631197152055807246",
  "https://www.tiktok.com/@glossier/video/7474027608355769642",
  // Instagram
  "https://www.instagram.com/reel/C6DHlAYS10E/",
  "https://www.instagram.com/reel/DFsnQ8sig0N/",
  "https://www.instagram.com/reel/DE9UW4TzcOF/",
  "https://www.instagram.com/reel/DB3DMZyPMU3/",
  "https://www.instagram.com/reel/C7CAtc3OHR6/",
  "https://www.instagram.com/reel/C58wCKhLe0S/",
  "https://www.instagram.com/reel/C3njiSkxq-S/",
  "https://www.instagram.com/reel/C6N-8WiBHA1/",
  "https://www.instagram.com/reel/C8tZ61xyMva/",
  "https://www.instagram.com/p/CVsCWzjvm_9/",
  "https://www.instagram.com/reel/C7CbilTx8qb/",
];

export function platformOf(url) {
  const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
  return "etc";
}

export function pickRealLink(index) {
  const url = REAL_CONTENT_LINKS[index % REAL_CONTENT_LINKS.length];
  return { url, platform: platformOf(url) };
}
