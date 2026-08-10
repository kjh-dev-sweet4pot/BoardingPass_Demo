export const INF_LOCALES = ["ko", "en", "ja", "zh"] as const;
export type InfLocale = (typeof INF_LOCALES)[number];

export const INF_LOCALE_STORAGE_KEY = "inf-locale";

export const INF_LOCALE_LABEL: Record<InfLocale, string> = {
  ko: "한국어",
  en: "EN",
  ja: "日本語",
  zh: "中文",
};

export type InfMessages = {
  serverConfigError: string;
  sessionExpired: string;
  listPreparing: string;
  enterSnsId: string;
  snsPlatforms: string;
  confirm: string;
  confirming: string;
  logout: string;
  guest: string;
  welcomeName: (name: string) => string;
  loadingVisitInfo: string;
  loadingHard: string;
  movingToList: string;
  verifyFailed: string;
  verifyError: string;
  bootstrapFailed: string;
  handleRequired: string;
  handleNotFound: string;
  nameAmbiguous: string;
  helloName: (name: string) => string;
  allocationListTitle: (name: string) => string;
  todayPickupCount: (n: number) => string;
  checkProductsBelow: string;
  verifiedDone: string;
  snsProfile: string;
  noAllocations: string;
  visitStore: string;
  visitSchedule: string;
  quantity: string;
  quantityUnit: (n: number) => string;
  product: string;
  productFallback: string;
  storeFallback: string;
  today: string;
  cancelled: string;
  pickupDone: string;
  pickupAvailable: string;
  openPickupInfo: string;
  dateUndecided: string;
  recheck: string;
  close: string;
  previous: string;
  pickupReviewTitle: string;
  pickupConfirmTitle: string;
  pickupReviewHint: string;
  pickupConfirmHint: string;
  showToPharmacist: string;
  pickupConfirmBtn: string;
  finalPickupConfirm: string;
  pickupIrreversible: string;
  pickupDoneBanner: string;
  cancelledCannotPickup: string;
  pickupFailed: string;
  pickupError: string;
  /** 시트 본문 라벨 (사용자 언어) */
  sheet: InfSheetLabels;
  /** 약사님께 보이는 한국어 고정 라벨 (시트 본문) */
  koSheet: InfSheetLabels;
};

export type InfSheetLabels = {
  product: string;
  store: string;
  visitDate: string;
  dateUndecided: string;
  influencer: string;
  quantity: string;
  quantityUnit: (n: number) => string;
  visitCode: string;
  pickupStatus: string;
  pickupDone: string;
  pickupWaiting: string;
  pickupTime: string;
  cancelled: string;
};

const koSheet: InfSheetLabels = {
  product: "상품",
  store: "매장",
  visitDate: "방문 예정일",
  dateUndecided: "날짜 미정",
  influencer: "인플루언서",
  quantity: "수량",
  quantityUnit: (n) => `${n}개`,
  visitCode: "방문 코드",
  pickupStatus: "수령 여부",
  pickupDone: "수령 완료",
  pickupWaiting: "수령 대기",
  pickupTime: "수령 시간",
  cancelled: "취소",
};

/** 사용자 언어 + 한국어 병기 (한국어 UI는 한국어만) */
export function bilingualSheetText(
  locale: InfLocale,
  localized: string,
  korean: string,
): string {
  if (locale === "ko" || localized === korean) return korean;
  return `${localized} / ${korean}`;
}

/** 지점명에 자주 쓰는 지역·접미 번역 (미매칭 한글은 그대로 둠) */
const STORE_PLACE_I18N: Record<
  string,
  Partial<Record<Exclude<InfLocale, "ko">, string>>
> = {
  강남: { en: "Gangnam", ja: "江南", zh: "江南" },
  성수: { en: "Seongsu", ja: "聖水", zh: "圣水" },
  신사: { en: "Sinsa", ja: "新沙", zh: "新沙" },
  명동: { en: "Myeongdong", ja: "明洞", zh: "明洞" },
  종각: { en: "Jonggak", ja: "鐘閣", zh: "钟阁" },
  분당서현: { en: "Bundang Seohyeon", ja: "盆唐書峴", zh: "盆唐书岘" },
  북촌: { en: "Bukchon", ja: "北村", zh: "北村" },
  남포: { en: "Nampo", ja: "南浦", zh: "南浦" },
  홍대: { en: "Hongdae", ja: "弘大", zh: "弘大" },
  잠실: { en: "Jamsil", ja: "蚕室", zh: "蚕室" },
  여의도: { en: "Yeouido", ja: "汝矣島", zh: "汝矣岛" },
  판교: { en: "Pangyo", ja: "板橋", zh: "板桥" },
  송파: { en: "Songpa", ja: "松坡", zh: "松坡" },
  마포: { en: "Mapo", ja: "麻浦", zh: "麻浦" },
  용산: { en: "Yongsan", ja: "龍山", zh: "龙山" },
  종로: { en: "Jongno", ja: "鐘路", zh: "钟路" },
  이태원: { en: "Itaewon", ja: "梨泰院", zh: "梨泰院" },
  압구정: { en: "Apgujeong", ja: "狎鴎亭", zh: "狎鸥亭" },
  청담: { en: "Cheongdam", ja: "清潭", zh: "清潭" },
  한남: { en: "Hannam", ja: "漢南", zh: "汉南" },
  건대: { en: "Konkuk", ja: "建大", zh: "建大" },
  신촌: { en: "Sinchon", ja: "新村", zh: "新村" },
  영등포: { en: "Yeongdeungpo", ja: "永登浦", zh: "永登浦" },
  부산: { en: "Busan", ja: "釜山", zh: "釜山" },
  대구: { en: "Daegu", ja: "大邱", zh: "大邱" },
  대전: { en: "Daejeon", ja: "大田", zh: "大田" },
  광주: { en: "Gwangju", ja: "光州", zh: "光州" },
  인천: { en: "Incheon", ja: "仁川", zh: "仁川" },
  제주: { en: "Jeju", ja: "済州", zh: "济州" },
};

/**
 * 한국어 지점명을 로케일 표기로 변환.
 * 예: "OWM 강남점" → en "OWM Gangnam" / ja "OWM 江南店"
 */
export function localizeStoreName(
  koreanName: string,
  locale: InfLocale,
): string {
  const name = koreanName.trim();
  if (!name || locale === "ko") return name;

  let out = name;
  const places = Object.keys(STORE_PLACE_I18N).sort(
    (a, b) => b.length - a.length,
  );
  for (const place of places) {
    const localized = STORE_PLACE_I18N[place]?.[locale];
    if (localized && out.includes(place)) {
      out = out.split(place).join(localized);
    }
  }

  if (locale === "en") {
    out = out.replace(/점/g, "").replace(/\s+/g, " ").trim();
  } else {
    out = out.replace(/점/g, "店");
  }

  return out || name;
}

export const INF_MESSAGES: Record<InfLocale, InfMessages> = {
  ko: {
    serverConfigError: "서버 설정 오류입니다. 잠시 후 다시 시도해 주세요.",
    sessionExpired: "세션이 만료되었습니다. 다시 로그인해 주세요.",
    listPreparing: "목록 준비 중…",
    enterSnsId: "SNS 아이디 또는 이름을 입력해주세요",
    snsPlatforms: "샤오홍슈 · 도우인 · 인스타그램 · 틱톡",
    confirm: "확인",
    confirming: "확인 중…",
    logout: "로그아웃",
    guest: "게스트",
    welcomeName: (name) => `${name}님 환영합니다`,
    loadingVisitInfo: "방문 정보를 불러오는 중…",
    loadingHard: "열심히 불러오고 있어요!",
    movingToList: "상품 목록으로 이동 중…",
    verifyFailed: "본인확인에 실패했습니다.",
    verifyError: "본인확인 중 오류가 발생했습니다.",
    bootstrapFailed: "배정 정보를 불러오지 못했습니다.",
    handleRequired: "SNS 아이디 또는 이름을 입력하세요.",
    handleNotFound: "등록된 SNS 아이디 또는 이름과 일치하지 않습니다.",
    nameAmbiguous:
      "같은 이름이 여러 명 등록되어 있습니다. SNS 아이디로 로그인해 주세요.",
    helloName: (name) => `안녕하세요, ${name}님!`,
    allocationListTitle: (name) => `${name}님의 배정 목록`,
    todayPickupCount: (n) => `오늘 수령 가능한 상품이 ${n}건 있습니다`,
    checkProductsBelow: "아래에서 상품을 확인해 주세요",
    verifiedDone: "본인 확인이 완료되었습니다.",
    snsProfile: "SNS 프로필",
    noAllocations: "배정된 상품이 없습니다.",
    visitStore: "방문 지점",
    visitSchedule: "방문 일정",
    quantity: "수량",
    quantityUnit: (n) => `${n}개`,
    product: "상품",
    productFallback: "상품",
    storeFallback: "매장",
    today: "오늘",
    cancelled: "취소됨",
    pickupDone: "수령 완료",
    pickupAvailable: "수령 가능",
    openPickupInfo: "수령 정보 확인하기 →",
    dateUndecided: "날짜 미정",
    recheck: "다시 확인",
    close: "닫기",
    previous: "이전",
    pickupReviewTitle: "수령 정보 확인",
    pickupConfirmTitle: "수령 최종 확인",
    pickupReviewHint: "관계자에게 제시 후 상품을 수령하세요.",
    pickupConfirmHint: "아래 내용이 맞다면 최종 확인을 눌러 주세요.",
    showToPharmacist: "약사님께 보여주세요",
    pickupConfirmBtn: "수령 확인",
    finalPickupConfirm: "최종 수령 확인",
    pickupIrreversible: "수령 확정 후에는 취소할 수 없습니다.",
    pickupDoneBanner: "✓ 수령 확인 완료",
    cancelledCannotPickup: "취소된 배정은 수령 확인할 수 없습니다.",
    pickupFailed: "수령 확인 실패",
    pickupError: "수령 확인 중 오류가 발생했습니다.",
    sheet: koSheet,
    koSheet,
  },
  en: {
    serverConfigError: "Server configuration error. Please try again later.",
    sessionExpired: "Your session has expired. Please sign in again.",
    listPreparing: "Preparing list…",
    enterSnsId: "Enter your SNS ID or name",
    snsPlatforms: "Xiaohongshu · Douyin · Instagram · TikTok",
    confirm: "Confirm",
    confirming: "Checking…",
    logout: "Log out",
    guest: "Guest",
    welcomeName: (name) => `Welcome, ${name}`,
    loadingVisitInfo: "Loading your visit info…",
    loadingHard: "Almost ready…",
    movingToList: "Opening your product list…",
    verifyFailed: "Verification failed.",
    verifyError: "An error occurred during verification.",
    bootstrapFailed: "Could not load your allocations.",
    handleRequired: "Please enter your SNS ID or name.",
    handleNotFound: "No matching SNS ID or name found.",
    nameAmbiguous:
      "Multiple people share this name. Please sign in with your SNS ID.",
    helloName: (name) => `Hello, ${name}!`,
    allocationListTitle: (name) => `${name}'s allocations`,
    todayPickupCount: (n) =>
      n === 1
        ? "1 product is available for pickup today"
        : `${n} products are available for pickup today`,
    checkProductsBelow: "Please check your products below",
    verifiedDone: "Identity verified.",
    snsProfile: "SNS profile",
    noAllocations: "No products assigned.",
    visitStore: "Store",
    visitSchedule: "Visit date",
    quantity: "Qty",
    quantityUnit: (n) => `${n}`,
    product: "Product",
    productFallback: "Product",
    storeFallback: "Store",
    today: "Today",
    cancelled: "Cancelled",
    pickupDone: "Picked up",
    pickupAvailable: "Ready",
    openPickupInfo: "View pickup info →",
    dateUndecided: "Date TBD",
    recheck: "Sign in again",
    close: "Close",
    previous: "Back",
    pickupReviewTitle: "Pickup info",
    pickupConfirmTitle: "Confirm pickup",
    pickupReviewHint: "Show this to staff, then pick up your product.",
    pickupConfirmHint: "If everything looks correct, confirm pickup.",
    showToPharmacist: "Please show this to the pharmacist",
    pickupConfirmBtn: "Confirm pickup",
    finalPickupConfirm: "Final confirm",
    pickupIrreversible: "Pickup cannot be undone once confirmed.",
    pickupDoneBanner: "✓ Pickup confirmed",
    cancelledCannotPickup: "Cancelled allocations cannot be picked up.",
    pickupFailed: "Pickup confirmation failed",
    pickupError: "An error occurred while confirming pickup.",
    sheet: {
      product: "Product",
      store: "Store",
      visitDate: "Visit date",
      dateUndecided: "Date TBD",
      influencer: "Influencer",
      quantity: "Qty",
      quantityUnit: (n) => `${n}`,
      visitCode: "Visit code",
      pickupStatus: "Pickup status",
      pickupDone: "Picked up",
      pickupWaiting: "Waiting for pickup",
      pickupTime: "Pickup time",
      cancelled: "Cancelled",
    },
    koSheet,
  },
  ja: {
    serverConfigError:
      "サーバー設定エラーです。しばらくしてから再度お試しください。",
    sessionExpired: "セッションの有効期限が切れました。再度ログインしてください。",
    listPreparing: "リストを準備中…",
    enterSnsId: "SNS IDまたはお名前を入力してください",
    snsPlatforms: "小紅書 · Instagram · TikTok",
    confirm: "確認",
    confirming: "確認中…",
    logout: "ログアウト",
    guest: "ゲスト",
    welcomeName: (name) => `${name}様、ようこそ`,
    loadingVisitInfo: "来店情報を読み込み中…",
    loadingHard: "読み込み中です…",
    movingToList: "商品リストへ移動中…",
    verifyFailed: "本人確認に失敗しました。",
    verifyError: "本人確認中にエラーが発生しました。",
    bootstrapFailed: "割り当て情報を読み込めませんでした。",
    handleRequired: "SNS IDまたはお名前を入力してください。",
    handleNotFound: "登録されたSNS IDまたは名前と一致しません。",
    nameAmbiguous:
      "同じ名前が複数登録されています。SNS IDでログインしてください。",
    helloName: (name) => `こんにちは、${name}様！`,
    allocationListTitle: (name) => `${name}様の割り当て一覧`,
    todayPickupCount: (n) => `本日受け取り可能な商品が${n}件あります`,
    checkProductsBelow: "下の商品をご確認ください",
    verifiedDone: "本人確認が完了しました。",
    snsProfile: "SNSプロフィール",
    noAllocations: "割り当てられた商品はありません。",
    visitStore: "来店店舗",
    visitSchedule: "来店日",
    quantity: "数量",
    quantityUnit: (n) => `${n}個`,
    product: "商品",
    productFallback: "商品",
    storeFallback: "店舗",
    today: "本日",
    cancelled: "キャンセル",
    pickupDone: "受取済",
    pickupAvailable: "受取可",
    openPickupInfo: "受取情報を確認する →",
    dateUndecided: "日付未定",
    recheck: "再確認",
    close: "閉じる",
    previous: "戻る",
    pickupReviewTitle: "受取情報の確認",
    pickupConfirmTitle: "受取の最終確認",
    pickupReviewHint: "スタッフに提示してから商品を受け取ってください。",
    pickupConfirmHint: "内容に問題なければ最終確認を押してください。",
    showToPharmacist: "薬剤師の方に見せてください",
    pickupConfirmBtn: "受取確認",
    finalPickupConfirm: "最終受取確認",
    pickupIrreversible: "受取確定後は取り消せません。",
    pickupDoneBanner: "✓ 受取確認完了",
    cancelledCannotPickup: "キャンセルされた割り当ては受け取れません。",
    pickupFailed: "受取確認に失敗しました",
    pickupError: "受取確認中にエラーが発生しました。",
    sheet: {
      product: "商品",
      store: "店舗",
      visitDate: "来店予定日",
      dateUndecided: "日付未定",
      influencer: "インフルエンサー",
      quantity: "数量",
      quantityUnit: (n) => `${n}個`,
      visitCode: "来店コード",
      pickupStatus: "受取状況",
      pickupDone: "受取済",
      pickupWaiting: "受取待ち",
      pickupTime: "受取時間",
      cancelled: "キャンセル",
    },
    koSheet,
  },
  zh: {
    serverConfigError: "服务器配置错误，请稍后再试。",
    sessionExpired: "登录已过期，请重新登录。",
    listPreparing: "正在准备列表…",
    enterSnsId: "请输入 SNS 账号或姓名",
    snsPlatforms: "小红书 · 抖音 · Instagram · TikTok",
    confirm: "确认",
    confirming: "确认中…",
    logout: "退出登录",
    guest: "访客",
    welcomeName: (name) => `欢迎您，${name}`,
    loadingVisitInfo: "正在加载到访信息…",
    loadingHard: "正在加载中…",
    movingToList: "正在进入商品列表…",
    verifyFailed: "身份验证失败。",
    verifyError: "身份验证时发生错误。",
    bootstrapFailed: "无法加载分配信息。",
    handleRequired: "请输入 SNS 账号或姓名。",
    handleNotFound: "与已登记的 SNS 账号或姓名不符。",
    nameAmbiguous: "存在同名的多人，请使用 SNS 账号登录。",
    helloName: (name) => `您好，${name}！`,
    allocationListTitle: (name) => `${name} 的分配列表`,
    todayPickupCount: (n) => `今天有 ${n} 件商品可领取`,
    checkProductsBelow: "请在下方查看您的商品",
    verifiedDone: "身份验证已完成。",
    snsProfile: "SNS 主页",
    noAllocations: "暂无分配商品。",
    visitStore: "到访门店",
    visitSchedule: "到访日期",
    quantity: "数量",
    quantityUnit: (n) => `${n}个`,
    product: "商品",
    productFallback: "商品",
    storeFallback: "门店",
    today: "今天",
    cancelled: "已取消",
    pickupDone: "已领取",
    pickupAvailable: "可领取",
    openPickupInfo: "查看领取信息 →",
    dateUndecided: "日期待定",
    recheck: "重新确认",
    close: "关闭",
    previous: "返回",
    pickupReviewTitle: "领取信息确认",
    pickupConfirmTitle: "最终领取确认",
    pickupReviewHint: "请向工作人员出示后领取商品。",
    pickupConfirmHint: "如信息无误，请点击最终确认。",
    showToPharmacist: "请出示给药剂师查看",
    pickupConfirmBtn: "确认领取",
    finalPickupConfirm: "最终确认领取",
    pickupIrreversible: "确认领取后无法取消。",
    pickupDoneBanner: "✓ 领取确认完成",
    cancelledCannotPickup: "已取消的分配无法领取。",
    pickupFailed: "领取确认失败",
    pickupError: "领取确认时发生错误。",
    sheet: {
      product: "商品",
      store: "门店",
      visitDate: "到访日期",
      dateUndecided: "日期待定",
      influencer: "达人",
      quantity: "数量",
      quantityUnit: (n) => `${n}个`,
      visitCode: "到访码",
      pickupStatus: "领取状态",
      pickupDone: "已领取",
      pickupWaiting: "待领取",
      pickupTime: "领取时间",
      cancelled: "已取消",
    },
    koSheet,
  },
};

/** API가 한국어로 내려준 오류를 현재 로케일 문구로 매핑 */
export function translateInfApiError(
  message: string | undefined | null,
  t: InfMessages,
): string {
  const msg = (message || "").trim();
  if (!msg) return t.verifyError;

  const map: Record<string, string> = {
    "인스타그램 핸들을 입력하세요.": t.handleRequired,
    "SNS 아이디 또는 이름을 입력하세요.": t.handleRequired,
    "등록된 SNS 아이디와 일치하지 않습니다.": t.handleNotFound,
    "등록된 SNS 아이디 또는 이름과 일치하지 않습니다.": t.handleNotFound,
    "같은 이름이 여러 명 등록되어 있습니다. SNS 아이디로 로그인해 주세요.":
      t.nameAmbiguous,
    "본인확인에 실패했습니다.": t.verifyFailed,
    "본인확인 중 오류가 발생했습니다.": t.verifyError,
    "배정 정보를 불러오지 못했습니다.": t.bootstrapFailed,
    "세션이 만료되었습니다. 다시 로그인해 주세요.": t.sessionExpired,
    "수령 확인 실패": t.pickupFailed,
    "수령 확인 중 오류가 발생했습니다.": t.pickupError,
  };

  return map[msg] || msg;
}

const WEEKDAY: Record<InfLocale, string[]> = {
  ko: ["일", "월", "화", "수", "목", "금", "토"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  zh: ["日", "一", "二", "三", "四", "五", "六"],
};

export function formatVisitDateLocalized(
  ymd: string | null,
  locale: InfLocale,
  undecided: string,
): string {
  if (!ymd) return undecided;
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  if (locale === "ko") return `${m}월 ${d}일`;
  if (locale === "ja") return `${m}月${d}日`;
  if (locale === "zh") return `${m}月${d}日`;
  return `${m}/${d}`;
}

export function formatVisitWeekdayLocalized(
  ymd: string | null,
  locale: InfLocale,
): string {
  if (!ymd) return "";
  const date = new Date(ymd + "T00:00:00+09:00");
  return WEEKDAY[locale][date.getDay()] || "";
}

/** 약사용 한국어 날짜 (시트 본문 고정) */
export function formatVisitDateKo(ymd: string | null) {
  if (!ymd) return "날짜 미정";
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  return `${m}월 ${d}일`;
}

export function formatVisitDayOfWeekKo(ymd: string | null) {
  if (!ymd) return "";
  const date = new Date(ymd + "T00:00:00+09:00");
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

export function isInfLocale(value: unknown): value is InfLocale {
  return (
    typeof value === "string" &&
    (INF_LOCALES as readonly string[]).includes(value)
  );
}
