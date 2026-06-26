/**
 * Home-screen chrome translations. Mirrors the account's preferred language
 * (BrandKit.preferredLanguage). Fully translated: en/fr/es/pt/de/ar/zh/hi/ja;
 * other supported languages fall back to English copy (the agent's actual
 * replies are still generated in the user's language at runtime).
 */
export interface HomeStrings {
  greet: string;
  accent: string;
  sub: string;
  placeholder: string;
  hint: string;
  credits: string;
  chips: string[];
  ws: Record<string, string>;
}

const en: HomeStrings = {
  greet: "Good evening, Jean —",
  accent: "what should we build?",
  sub: "Tell me what you want to do. I can design, post, advertise, build a store or site, register a domain — and show the work right here.",
  placeholder: "Ask FlowSmartly to do something…",
  hint: "FlowSmartly confirms before anything that costs credits or publishes.",
  credits: "credits",
  chips: ["World Cup promo design", "Launch a weekend sale", "Make a video ad", "Start a store"],
  ws: { home: "Home", create: "Create", publish: "Publish", grow: "Grow", sell: "Sell", web: "Web", outreach: "Outreach", business: "Business" },
};

export const HOME_STRINGS: Record<string, HomeStrings> = {
  en,
  fr: {
    greet: "Bonsoir Jean —",
    accent: "que créons-nous ?",
    sub: "Dites-moi ce que vous voulez faire. Je peux concevoir, publier, faire de la publicité, créer une boutique ou un site, enregistrer un domaine — et montrer le travail ici même.",
    placeholder: "Demandez à FlowSmartly de faire quelque chose…",
    hint: "FlowSmartly confirme avant toute action payante ou publiée.",
    credits: "crédits",
    chips: ["Visuel promo Coupe du Monde", "Lancer une vente week-end", "Créer une pub vidéo", "Ouvrir une boutique"],
    ws: { home: "Accueil", create: "Créer", publish: "Publier", grow: "Développer", sell: "Vendre", web: "Web", outreach: "Contact", business: "Gestion" },
  },
  es: {
    greet: "Buenas noches, Jean —",
    accent: "¿qué creamos?",
    sub: "Dime qué quieres hacer. Puedo diseñar, publicar, anunciar, crear una tienda o web, registrar un dominio — y mostrar el trabajo aquí mismo.",
    placeholder: "Pide a FlowSmartly que haga algo…",
    hint: "FlowSmartly confirma antes de cualquier acción con coste o publicación.",
    credits: "créditos",
    chips: ["Diseño promo Mundial", "Lanzar oferta de fin de semana", "Crear anuncio en vídeo", "Abrir una tienda"],
    ws: { home: "Inicio", create: "Crear", publish: "Publicar", grow: "Crecer", sell: "Vender", web: "Web", outreach: "Contactos", business: "Negocio" },
  },
  pt: {
    greet: "Boa noite, Jean —",
    accent: "o que vamos criar?",
    sub: "Diga o que você quer fazer. Posso criar, publicar, anunciar, montar uma loja ou site, registrar um domínio — e mostrar o trabalho aqui mesmo.",
    placeholder: "Peça ao FlowSmartly para fazer algo…",
    hint: "O FlowSmartly confirma antes de qualquer ação paga ou publicação.",
    credits: "créditos",
    chips: ["Arte promo Copa do Mundo", "Lançar promoção de fim de semana", "Criar anúncio em vídeo", "Abrir uma loja"],
    ws: { home: "Início", create: "Criar", publish: "Publicar", grow: "Crescer", sell: "Vender", web: "Web", outreach: "Contatos", business: "Negócio" },
  },
  de: {
    greet: "Guten Abend, Jean —",
    accent: "was bauen wir?",
    sub: "Sag mir, was du tun möchtest. Ich kann gestalten, posten, werben, einen Shop oder eine Website erstellen, eine Domain registrieren — und die Arbeit gleich hier zeigen.",
    placeholder: "Bitte FlowSmartly, etwas zu tun…",
    hint: "FlowSmartly bestätigt vor allem, was Credits kostet oder veröffentlicht.",
    credits: "Credits",
    chips: ["WM-Promo-Design", "Wochenend-Sale starten", "Video-Anzeige erstellen", "Shop eröffnen"],
    ws: { home: "Start", create: "Erstellen", publish: "Posten", grow: "Wachsen", sell: "Verkaufen", web: "Web", outreach: "Kontakte", business: "Verwaltung" },
  },
  ar: {
    greet: "مساء الخير يا جان —",
    accent: "ماذا ننشئ؟",
    sub: "أخبرني بما تريد فعله. يمكنني التصميم والنشر والإعلان وبناء متجر أو موقع وتسجيل نطاق — وعرض العمل هنا مباشرة.",
    placeholder: "اطلب من FlowSmartly تنفيذ مهمة…",
    hint: "يؤكّد FlowSmartly قبل أي إجراء مدفوع أو نشر.",
    credits: "رصيد",
    chips: ["تصميم عرض كأس العالم", "إطلاق تخفيضات نهاية الأسبوع", "إنشاء إعلان فيديو", "افتتاح متجر"],
    ws: { home: "الرئيسية", create: "إنشاء", publish: "نشر", grow: "تنمية", sell: "بيع", web: "الويب", outreach: "التواصل", business: "الأعمال" },
  },
  zh: {
    greet: "晚上好，Jean —",
    accent: "我们来做点什么？",
    sub: "告诉我你想做什么。我可以设计、发布、投放广告、搭建商店或网站、注册域名 —— 并在这里直接展示成果。",
    placeholder: "让 FlowSmartly 做点什么…",
    hint: "任何消耗积分或发布的操作，FlowSmartly 都会先确认。",
    credits: "积分",
    chips: ["世界杯促销设计", "开启周末特卖", "制作视频广告", "开一家商店"],
    ws: { home: "主页", create: "创作", publish: "发布", grow: "增长", sell: "销售", web: "网站", outreach: "触达", business: "管理" },
  },
  hi: {
    greet: "शुभ संध्या, Jean —",
    accent: "हम क्या बनाएँ?",
    sub: "बताइए आप क्या करना चाहते हैं। मैं डिज़ाइन, पोस्ट, विज्ञापन, स्टोर या साइट बनाना, डोमेन रजिस्टर करना कर सकता हूँ — और काम यहीं दिखा सकता हूँ।",
    placeholder: "FlowSmartly से कुछ करने को कहें…",
    hint: "क्रेडिट खर्च या प्रकाशन से पहले FlowSmartly पुष्टि करता है।",
    credits: "क्रेडिट",
    chips: ["वर्ल्ड कप प्रोमो डिज़ाइन", "वीकेंड सेल शुरू करें", "वीडियो विज्ञापन बनाएं", "स्टोर शुरू करें"],
    ws: { home: "होम", create: "बनाएँ", publish: "प्रकाशित", grow: "बढ़ाएँ", sell: "बेचें", web: "वेब", outreach: "संपर्क", business: "व्यवसाय" },
  },
  ja: {
    greet: "こんばんは、Jean —",
    accent: "何をつくりましょう？",
    sub: "やりたいことを教えてください。デザイン、投稿、広告、ストアやサイトの構築、ドメイン取得まで——その結果をここに表示します。",
    placeholder: "FlowSmartly に頼んでみる…",
    hint: "クレジットを消費する操作や公開の前に、FlowSmartly が確認します。",
    credits: "クレジット",
    chips: ["ワールドカップ販促デザイン", "週末セールを開始", "動画広告を作成", "ストアを開設"],
    ws: { home: "ホーム", create: "作成", publish: "投稿", grow: "成長", sell: "販売", web: "ウェブ", outreach: "アウトリーチ", business: "管理" },
  },
};

export const RTL_LANGS = new Set(["ar", "he"]);

export function getHomeStrings(lang: string): HomeStrings {
  return HOME_STRINGS[lang] || HOME_STRINGS[lang?.split("-")[0]] || en;
}
