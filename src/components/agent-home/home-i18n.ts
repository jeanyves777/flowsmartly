/**
 * Home-screen chrome translations. Mirrors the account's preferred language
 * (BrandKit.preferredLanguage). The greeting is time-aware and templated with
 * the real user's name ({name}); starter suggestions are AI-generated per brand
 * at runtime — `fallbackChips` are only shown while those load or if the model
 * is unavailable. Fully translated: en/fr/es/pt/de/ar/zh/hi/ja; others fall back
 * to English copy (the agent's actual replies are generated in the user's
 * language at runtime regardless).
 */
export interface HomeStrings {
  greet: { morning: string; afternoon: string; evening: string };
  accent: string;
  sub: string;
  placeholder: string;
  hint: string;
  credits: string;
  /** Localized fallback starters (shown until AI suggestions arrive). */
  fallbackChips: string[];
  ws: Record<string, string>;
}

const en: HomeStrings = {
  greet: { morning: "Good morning, {name} —", afternoon: "Good afternoon, {name} —", evening: "Good evening, {name} —" },
  accent: "what should we build?",
  sub: "Tell me what you want to do. I can design, post, advertise, build a store or site, register a domain — and show the work right here.",
  placeholder: "Ask FlowSmartly to do something…",
  hint: "FlowSmartly confirms before anything that costs credits or publishes.",
  credits: "credits",
  fallbackChips: ["Design a branded post", "Plan my week's content", "Make a short video ad", "Start an online store"],
  ws: { home: "Agent", create: "Create", publish: "Publish", grow: "Grow", sell: "Sell", web: "Web", outreach: "Outreach", business: "Business" },
};

export const HOME_STRINGS: Record<string, HomeStrings> = {
  en,
  fr: {
    greet: { morning: "Bonjour {name} —", afternoon: "Bon après-midi {name} —", evening: "Bonsoir {name} —" },
    accent: "que créons-nous ?",
    sub: "Dites-moi ce que vous voulez faire. Je peux concevoir, publier, faire de la publicité, créer une boutique ou un site, enregistrer un domaine — et montrer le travail ici même.",
    placeholder: "Demandez à FlowSmartly de faire quelque chose…",
    hint: "FlowSmartly confirme avant toute action payante ou publiée.",
    credits: "crédits",
    fallbackChips: ["Créer un visuel de marque", "Planifier ma semaine", "Faire une pub vidéo", "Ouvrir une boutique"],
    ws: { home: "Agent", create: "Créer", publish: "Publier", grow: "Développer", sell: "Vendre", web: "Web", outreach: "Contact", business: "Gestion" },
  },
  es: {
    greet: { morning: "Buenos días, {name} —", afternoon: "Buenas tardes, {name} —", evening: "Buenas noches, {name} —" },
    accent: "¿qué creamos?",
    sub: "Dime qué quieres hacer. Puedo diseñar, publicar, anunciar, crear una tienda o web, registrar un dominio — y mostrar el trabajo aquí mismo.",
    placeholder: "Pide a FlowSmartly que haga algo…",
    hint: "FlowSmartly confirma antes de cualquier acción con coste o publicación.",
    credits: "créditos",
    fallbackChips: ["Diseñar un post de marca", "Planificar mi semana", "Crear un anuncio en vídeo", "Abrir una tienda"],
    ws: { home: "Agente", create: "Crear", publish: "Publicar", grow: "Crecer", sell: "Vender", web: "Web", outreach: "Contactos", business: "Negocio" },
  },
  pt: {
    greet: { morning: "Bom dia, {name} —", afternoon: "Boa tarde, {name} —", evening: "Boa noite, {name} —" },
    accent: "o que vamos criar?",
    sub: "Diga o que você quer fazer. Posso criar, publicar, anunciar, montar uma loja ou site, registrar um domínio — e mostrar o trabalho aqui mesmo.",
    placeholder: "Peça ao FlowSmartly para fazer algo…",
    hint: "O FlowSmartly confirma antes de qualquer ação paga ou publicação.",
    credits: "créditos",
    fallbackChips: ["Criar um post de marca", "Planejar minha semana", "Fazer um anúncio em vídeo", "Abrir uma loja"],
    ws: { home: "Agente", create: "Criar", publish: "Publicar", grow: "Crescer", sell: "Vender", web: "Web", outreach: "Contatos", business: "Negócio" },
  },
  de: {
    greet: { morning: "Guten Morgen, {name} —", afternoon: "Guten Tag, {name} —", evening: "Guten Abend, {name} —" },
    accent: "was bauen wir?",
    sub: "Sag mir, was du tun möchtest. Ich kann gestalten, posten, werben, einen Shop oder eine Website erstellen, eine Domain registrieren — und die Arbeit gleich hier zeigen.",
    placeholder: "Bitte FlowSmartly, etwas zu tun…",
    hint: "FlowSmartly bestätigt vor allem, was Credits kostet oder veröffentlicht.",
    credits: "Credits",
    fallbackChips: ["Marken-Post gestalten", "Meine Woche planen", "Video-Anzeige erstellen", "Shop eröffnen"],
    ws: { home: "Agent", create: "Erstellen", publish: "Posten", grow: "Wachsen", sell: "Verkaufen", web: "Web", outreach: "Kontakte", business: "Verwaltung" },
  },
  ar: {
    greet: { morning: "صباح الخير يا {name} —", afternoon: "مساء الخير يا {name} —", evening: "مساء الخير يا {name} —" },
    accent: "ماذا ننشئ؟",
    sub: "أخبرني بما تريد فعله. يمكنني التصميم والنشر والإعلان وبناء متجر أو موقع وتسجيل نطاق — وعرض العمل هنا مباشرة.",
    placeholder: "اطلب من FlowSmartly تنفيذ مهمة…",
    hint: "يؤكّد FlowSmartly قبل أي إجراء مدفوع أو نشر.",
    credits: "رصيد",
    fallbackChips: ["تصميم منشور بهوية علامتك", "تخطيط أسبوعي", "إنشاء إعلان فيديو", "افتتاح متجر"],
    ws: { home: "الوكيل", create: "إنشاء", publish: "نشر", grow: "تنمية", sell: "بيع", web: "الويب", outreach: "التواصل", business: "الأعمال" },
  },
  zh: {
    greet: { morning: "早上好，{name} —", afternoon: "下午好，{name} —", evening: "晚上好，{name} —" },
    accent: "我们来做点什么？",
    sub: "告诉我你想做什么。我可以设计、发布、投放广告、搭建商店或网站、注册域名 —— 并在这里直接展示成果。",
    placeholder: "让 FlowSmartly 做点什么…",
    hint: "任何消耗积分或发布的操作，FlowSmartly 都会先确认。",
    credits: "积分",
    fallbackChips: ["设计品牌帖子", "规划本周内容", "制作短视频广告", "开一家网店"],
    ws: { home: "助手", create: "创作", publish: "发布", grow: "增长", sell: "销售", web: "网站", outreach: "触达", business: "管理" },
  },
  hi: {
    greet: { morning: "सुप्रभात, {name} —", afternoon: "नमस्कार, {name} —", evening: "शुभ संध्या, {name} —" },
    accent: "हम क्या बनाएँ?",
    sub: "बताइए आप क्या करना चाहते हैं। मैं डिज़ाइन, पोस्ट, विज्ञापन, स्टोर या साइट बनाना, डोमेन रजिस्टर करना कर सकता हूँ — और काम यहीं दिखा सकता हूँ।",
    placeholder: "FlowSmartly से कुछ करने को कहें…",
    hint: "क्रेडिट खर्च या प्रकाशन से पहले FlowSmartly पुष्टि करता है।",
    credits: "क्रेडिट",
    fallbackChips: ["ब्रांडेड पोस्ट डिज़ाइन करें", "सप्ताह की योजना बनाएं", "वीडियो विज्ञापन बनाएं", "ऑनलाइन स्टोर शुरू करें"],
    ws: { home: "एजेंट", create: "बनाएँ", publish: "प्रकाशित", grow: "बढ़ाएँ", sell: "बेचें", web: "वेब", outreach: "संपर्क", business: "व्यवसाय" },
  },
  ja: {
    greet: { morning: "おはようございます、{name} —", afternoon: "こんにちは、{name} —", evening: "こんばんは、{name} —" },
    accent: "何をつくりましょう？",
    sub: "やりたいことを教えてください。デザイン、投稿、広告、ストアやサイトの構築、ドメイン取得まで——その結果をここに表示します。",
    placeholder: "FlowSmartly に頼んでみる…",
    hint: "クレジットを消費する操作や公開の前に、FlowSmartly が確認します。",
    credits: "クレジット",
    fallbackChips: ["ブランド投稿をデザイン", "今週の計画を立てる", "動画広告を作成", "オンラインストアを開設"],
    ws: { home: "エージェント", create: "作成", publish: "投稿", grow: "成長", sell: "販売", web: "ウェブ", outreach: "アウトリーチ", business: "管理" },
  },
};

export const RTL_LANGS = new Set(["ar", "he"]);

export function getHomeStrings(lang: string): HomeStrings {
  return HOME_STRINGS[lang] || HOME_STRINGS[lang?.split("-")[0]] || en;
}

/** Pick the time-of-day greeting from the user's LOCAL hour, with the name templated in. */
export function buildGreeting(s: HomeStrings, name: string, hour: number): string {
  const slot = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return s.greet[slot].replace("{name}", name);
}
