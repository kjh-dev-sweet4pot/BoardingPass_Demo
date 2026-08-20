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
  visitScheduled: string;
  allocationsTab: string;
  contentLinks: string;
  contentSubmitTab: string;
  contentPublishTab: string;
  submitFileHint: string;
  submitFilePick: string;
  submitFileTypes: string;
  submitFileBtn: string;
  submitFileUploading: string;
  submitUrlLabel: string;
  submitUrlPlaceholder: string;
  submitNeedFileOrUrl: string;
  submitNeedSection: string;
  submitDoneSection: string;
  submitAllDone: string;
  contentReviewing: string;
  contentApproved: string;
  contentPublished: string;
  publishUrlHint: string;
  publishUrlSubmit: string;
  publishUrlSaving: string;
  publishNeedSection: string;
  publishDoneSection: string;
  publishAllDone: string;
  registerLink: string;
  registerLinkCta: string;
  linkRegistered: string;
  noPickedUpProducts: string;
  enterLink: string;
  invalidLink: string;
  linkTooLong: string;
  duplicateLink: string;
  approvedCannotDelete: string;
  pickupThenRegister: string;
  linkSubmit: string;
  linkDelete: string;
  linkReviewing: string;
  linkApproved: string;
  linkRejected: string;
  receivedOn: string;
  linksHint: string;
  linksNeedSection: string;
  linksDoneSection: string;
  linksProductsReceived: string;
  linksAllDone: string;
  linkPlaceholder: string;
  linkPreview: string;
  linkPreviewLoading: string;
  linkPreviewTitle: string;
  linkPreviewUnsupported: string;
  linkPreviewProfileFallback: string;
  linksRemainCount: (n: number) => string;
  linkRegisteredShort: string;
  linkNotRegistered: string;
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
    visitScheduled: "방문 예정",
    allocationsTab: "배정 목록",
    contentLinks: "콘텐츠 링크",
    contentSubmitTab: "콘텐츠 제출",
    contentPublishTab: "발행 URL",
    submitFileHint:
      "수령한 상품 콘텐츠를 파일로 올리거나, SNS 게시물 URL을 입력하세요. 둘 다 넣어도 됩니다.",
    submitFilePick: "탭하여 파일 선택",
    submitFileTypes: "이미지 · 동영상 · PDF (80MB 이하)",
    submitFileBtn: "제출하기",
    submitFileUploading: "업로드 중…",
    submitUrlLabel: "SNS URL (선택 · 파일 없이 URL만도 가능)",
    submitUrlPlaceholder: "https://www.instagram.com/... 또는 TikTok URL",
    submitNeedFileOrUrl: "파일 또는 SNS URL을 입력하세요.",
    submitNeedSection: "제출 필요",
    submitDoneSection: "제출 완료 · 검수 중",
    submitAllDone: "제출할 콘텐츠가 없어요.",
    contentReviewing: "검수중",
    contentApproved: "승인됨 · 발행 URL 등록 대기",
    contentPublished: "발행완료",
    publishUrlHint: "승인된 콘텐츠의 SNS 게시물 URL을 등록하세요.",
    publishUrlSubmit: "발행 URL 등록",
    publishUrlSaving: "등록 중…",
    publishNeedSection: "발행 URL 등록 필요",
    publishDoneSection: "발행 완료",
    publishAllDone: "등록할 발행 URL이 없어요.",
    registerLink: "링크 등록",
    registerLinkCta: "링크 등록하기",
    linkRegistered: "링크 등록이 완료되었습니다 !",
    noPickedUpProducts: "수령 완료된 상품이 없습니다.",
    enterLink: "링크를 입력해 주세요.",
    invalidLink: "올바른 링크 형식이 아닙니다.",
    linkTooLong: "링크가 너무 깁니다.",
    duplicateLink: "이미 등록된 링크입니다.",
    approvedCannotDelete: "승인된 링크는 삭제할 수 없습니다.",
    pickupThenRegister: "수령 완료 후 등록할 수 있습니다.",
    linkSubmit: "등록",
    linkDelete: "삭제",
    linkReviewing: "검수중",
    linkApproved: "승인",
    linkRejected: "반려",
    receivedOn: "수령일",
    linksHint:
      "수령한 상품을 소개한 SNS 게시물 링크를 올려 주세요. 같은 날 같은 매장이어도 상품마다 링크를 따로 등록해 주세요.",
    linksNeedSection: "등록이 필요해요",
    linksDoneSection: "등록 완료",
    linksProductsReceived: "받은 상품",
    linksAllDone: "등록할 링크가 없어요.",
    linkPlaceholder: "게시물 링크 https://",
    linkPreview: "미리 확인",
    linkPreviewLoading: "확인 중…",
    linkPreviewTitle: "제출 전 미리보기",
    linkPreviewUnsupported: "현재는 TikTok 링크만 이름/썸네일 미리보기를 지원해요.",
    linkPreviewProfileFallback: "프로필 이름 확인 불가",
    linksRemainCount: (n) => (n === 0 ? "모두 등록했어요" : `${n}건 남음`),
    linkRegisteredShort: "등록됨",
    linkNotRegistered: "미등록",
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
    visitScheduled: "Scheduled",
    allocationsTab: "Allocations",
    contentLinks: "Content links",
    contentSubmitTab: "Submit content",
    contentPublishTab: "Publish URL",
    submitFileHint: "Upload a file and/or paste the SNS post URL for each picked-up product.",
    submitFilePick: "Tap to choose a file",
    submitFileTypes: "Image · Video · PDF (max 80MB)",
    submitFileBtn: "Submit",
    submitFileUploading: "Uploading…",
    submitUrlLabel: "SNS URL (optional — URL only is OK)",
    submitUrlPlaceholder: "https://www.instagram.com/... or TikTok URL",
    submitNeedFileOrUrl: "Add a file or an SNS URL.",
    submitNeedSection: "Needs submission",
    submitDoneSection: "Submitted · In review",
    submitAllDone: "Nothing to submit.",
    contentReviewing: "In review",
    contentApproved: "Approved · Awaiting publish URL",
    contentPublished: "Published",
    publishUrlHint: "Register the live SNS post URL for approved content.",
    publishUrlSubmit: "Register publish URL",
    publishUrlSaving: "Saving…",
    publishNeedSection: "Publish URL needed",
    publishDoneSection: "Published",
    publishAllDone: "No publish URLs to register.",
    registerLink: "Add link",
    registerLinkCta: "Submit a link",
    linkRegistered: "Link submitted!",
    noPickedUpProducts: "No picked-up products yet.",
    enterLink: "Please enter a link.",
    invalidLink: "Please enter a valid URL.",
    linkTooLong: "The link is too long.",
    duplicateLink: "This link is already registered.",
    approvedCannotDelete: "Approved links cannot be deleted.",
    pickupThenRegister: "You can submit a link after pickup.",
    linkSubmit: "Submit",
    linkDelete: "Delete",
    linkReviewing: "In review",
    linkApproved: "Approved",
    linkRejected: "Rejected",
    receivedOn: "Picked up",
    linksHint:
      "Submit the SNS post for each product you picked up. Even on the same day at the same store, register a separate link per product.",
    linksNeedSection: "Needs a link",
    linksDoneSection: "Submitted",
    linksProductsReceived: "Products picked up",
    linksAllDone: "No links left to submit.",
    linkPlaceholder: "Post URL https://",
    linkPreview: "Preview",
    linkPreviewLoading: "Loading…",
    linkPreviewTitle: "Preview before submit",
    linkPreviewUnsupported:
      "Name and thumbnail preview is currently available for TikTok links only.",
    linkPreviewProfileFallback: "Profile name unavailable",
    linksRemainCount: (n) =>
      n === 0 ? "All submitted" : `${n} left to submit`,
    linkRegisteredShort: "Submitted",
    linkNotRegistered: "Not yet",
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
    visitScheduled: "来店予定",
    allocationsTab: "割当一覧",
    contentLinks: "コンテンツリンク",
    contentSubmitTab: "コンテンツ提出",
    contentPublishTab: "公開URL",
    submitFileHint: "受取商品のコンテンツをファイルでアップロードするか、SNS投稿URLを入力してください。両方でも構いません。",
    submitFilePick: "タップしてファイルを選択",
    submitFileTypes: "画像 · 動画 · PDF（80MB以下）",
    submitFileBtn: "提出する",
    submitFileUploading: "アップロード中…",
    submitUrlLabel: "SNS URL（任意 · URLのみでも可）",
    submitUrlPlaceholder: "https://www.instagram.com/... または TikTok URL",
    submitNeedFileOrUrl: "ファイルまたはSNS URLを入力してください。",
    submitNeedSection: "提出が必要",
    submitDoneSection: "提出済み · 審査中",
    submitAllDone: "提出するコンテンツがありません。",
    contentReviewing: "審査中",
    contentApproved: "承認済み · 公開URL待ち",
    contentPublished: "公開完了",
    publishUrlHint: "承認されたコンテンツのSNS投稿URLを登録してください。",
    publishUrlSubmit: "公開URL登録",
    publishUrlSaving: "登録中…",
    publishNeedSection: "公開URL登録が必要",
    publishDoneSection: "公開完了",
    publishAllDone: "登録する公開URLがありません。",
    registerLink: "リンク登録",
    registerLinkCta: "リンクを登録する",
    linkRegistered: "リンク登録が完了しました！",
    noPickedUpProducts: "受取済みの商品がありません。",
    enterLink: "リンクを入力してください。",
    invalidLink: "正しいリンク形式ではありません。",
    linkTooLong: "リンクが長すぎます。",
    duplicateLink: "すでに登録されたリンクです。",
    approvedCannotDelete: "承認済みのリンクは削除できません。",
    pickupThenRegister: "受取完了後に登録できます。",
    linkSubmit: "登録",
    linkDelete: "削除",
    linkReviewing: "審査中",
    linkApproved: "承認",
    linkRejected: "差戻し",
    receivedOn: "受取日",
    linksHint:
      "受け取った商品を紹介したSNS投稿のリンクを登録してください。同じ日・同じ店舗でも、商品ごとに別のリンクを登録してください。",
    linksNeedSection: "登録が必要です",
    linksDoneSection: "登録済み",
    linksProductsReceived: "受け取った商品",
    linksAllDone: "登録するリンクはありません。",
    linkPlaceholder: "投稿リンク https://",
    linkPreview: "プレビュー",
    linkPreviewLoading: "確認中…",
    linkPreviewTitle: "送信前プレビュー",
    linkPreviewUnsupported:
      "現在、名前とサムネイルのプレビューはTikTokリンクのみ対応しています。",
    linkPreviewProfileFallback: "プロフィール名を確認できません",
    linksRemainCount: (n) =>
      n === 0 ? "すべて登録済み" : `残り${n}件`,
    linkRegisteredShort: "登録済み",
    linkNotRegistered: "未登録",
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
    visitScheduled: "到访预定",
    allocationsTab: "分配列表",
    contentLinks: "内容链接",
    contentSubmitTab: "内容提交",
    contentPublishTab: "发布链接",
    submitFileHint: "已领取商品的内容可上传文件，或填写 SNS 帖子链接，也可两者都提交。",
    submitFilePick: "点击选择文件",
    submitFileTypes: "图片 · 视频 · PDF（80MB以内）",
    submitFileBtn: "提交",
    submitFileUploading: "上传中…",
    submitUrlLabel: "SNS 链接（可选 · 仅链接也可以）",
    submitUrlPlaceholder: "https://www.instagram.com/... 或 TikTok 链接",
    submitNeedFileOrUrl: "请上传文件或填写 SNS 链接。",
    submitNeedSection: "待提交",
    submitDoneSection: "已提交 · 审核中",
    submitAllDone: "没有待提交的内容。",
    contentReviewing: "审核中",
    contentApproved: "已通过 · 待登记发布链接",
    contentPublished: "已发布",
    publishUrlHint: "请登记已通过内容的 SNS 帖子链接。",
    publishUrlSubmit: "登记发布链接",
    publishUrlSaving: "登记中…",
    publishNeedSection: "待登记发布链接",
    publishDoneSection: "已发布",
    publishAllDone: "没有待登记的发布链接。",
    registerLink: "登记链接",
    registerLinkCta: "去登记链接",
    linkRegistered: "链接登记已完成！",
    noPickedUpProducts: "暂无已领取商品。",
    enterLink: "请输入链接。",
    invalidLink: "链接格式不正确。",
    linkTooLong: "链接过长。",
    duplicateLink: "该链接已登记。",
    approvedCannotDelete: "已通过的链接无法删除。",
    pickupThenRegister: "领取完成后才能登记。",
    linkSubmit: "登记",
    linkDelete: "删除",
    linkReviewing: "审核中",
    linkApproved: "已通过",
    linkRejected: "已驳回",
    receivedOn: "领取日",
    linksHint:
      "请为每件已领取商品提交社交帖链接。即使同一天、同一门店，也请按商品分别登记。",
    linksNeedSection: "待登记",
    linksDoneSection: "已登记",
    linksProductsReceived: "已领取商品",
    linksAllDone: "没有待登记的链接。",
    linkPlaceholder: "帖子链接 https://",
    linkPreview: "预览",
    linkPreviewLoading: "确认中…",
    linkPreviewTitle: "提交前预览",
    linkPreviewUnsupported: "目前仅支持 TikTok 链接的昵称和缩略图预览。",
    linkPreviewProfileFallback: "无法获取账号名称",
    linksRemainCount: (n) => (n === 0 ? "已全部登记" : `剩余 ${n} 项`),
    linkRegisteredShort: "已登记",
    linkNotRegistered: "未登记",
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
    "링크를 입력해 주세요.": t.enterLink,
    "올바른 링크 형식이 아닙니다.": t.invalidLink,
    "링크가 너무 깁니다.": t.linkTooLong,
    "이미 등록된 링크입니다.": t.duplicateLink,
    "승인된 링크는 삭제할 수 없습니다.": t.approvedCannotDelete,
    "수령 완료 후 등록할 수 있습니다.": t.pickupThenRegister,
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
