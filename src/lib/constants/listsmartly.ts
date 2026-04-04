// =============================================================================
// ListSmartly Constants
// =============================================================================

// -----------------------------------------------------------------------------
// Listing Statuses
// -----------------------------------------------------------------------------

export const LISTING_STATUSES = {
  live: {
    label: "Live",
    color: "bg-green-500/10 text-green-500",
    icon: "CheckCircle",
  },
  needs_update: {
    label: "Needs Update",
    color: "bg-yellow-500/10 text-yellow-500",
    icon: "AlertTriangle",
  },
  missing: {
    label: "Missing",
    color: "bg-red-500/10 text-red-500",
    icon: "XCircle",
  },
  ai_queued: {
    label: "AI Queued",
    color: "bg-blue-500/10 text-blue-500",
    icon: "Sparkles",
  },
  submitted: {
    label: "Submitted",
    color: "bg-blue-500/10 text-blue-500",
    icon: "Clock",
  },
  claimed: {
    label: "Claimed",
    color: "bg-purple-500/10 text-purple-500",
    icon: "Shield",
  },
  error: {
    label: "Error",
    color: "bg-red-500/10 text-red-500",
    icon: "AlertCircle",
  },
} as const;

export type ListingStatus = keyof typeof LISTING_STATUSES;

// -----------------------------------------------------------------------------
// Tier Configuration
// -----------------------------------------------------------------------------

export const TIER_CONFIG = {
  1: { weight: 10, label: "Critical", color: "text-red-500" },
  2: { weight: 5, label: "Major", color: "text-orange-500" },
  3: { weight: 3, label: "Industry", color: "text-yellow-500" },
  4: { weight: 2, label: "Reviews", color: "text-green-500" },
  5: { weight: 2, label: "Maps", color: "text-blue-500" },
  6: { weight: 1, label: "Social", color: "text-purple-500" },
  7: { weight: 1, label: "Local", color: "text-muted-foreground" },
} as const;

export type Tier = keyof typeof TIER_CONFIG;

// -----------------------------------------------------------------------------
// Directory Entry Type
// -----------------------------------------------------------------------------

export interface DirectoryEntry {
  slug: string;
  name: string;
  url: string;
  tier: number;
  category: string;
  industries: string[];
  submitUrl?: string;
  claimUrl?: string;
  apiAvailable?: boolean;
}

// -----------------------------------------------------------------------------
// Directory Catalog — Tier 1: Critical (16)
// -----------------------------------------------------------------------------

const TIER_1_DIRECTORIES: DirectoryEntry[] = [
  { slug: "google-business", name: "Google Business Profile", url: "https://business.google.com", tier: 1, category: "critical", industries: [], claimUrl: "https://business.google.com", apiAvailable: true },
  { slug: "yelp", name: "Yelp", url: "https://www.yelp.com", tier: 1, category: "critical", industries: [], claimUrl: "https://biz.yelp.com", apiAvailable: true },
  { slug: "apple-maps", name: "Apple Business Connect", url: "https://mapsconnect.apple.com", tier: 1, category: "critical", industries: [], claimUrl: "https://businessconnect.apple.com" },
  { slug: "bing-places", name: "Bing Places", url: "https://www.bingplaces.com", tier: 1, category: "critical", industries: [], claimUrl: "https://www.bingplaces.com", apiAvailable: true },
  { slug: "bbb", name: "Better Business Bureau", url: "https://www.bbb.org", tier: 1, category: "critical", industries: [], claimUrl: "https://www.bbb.org/get-listed" },
  { slug: "linkedin", name: "LinkedIn", url: "https://www.linkedin.com", tier: 1, category: "critical", industries: [], submitUrl: "https://www.linkedin.com/company/setup/new/" },
  { slug: "nextdoor", name: "Nextdoor", url: "https://nextdoor.com", tier: 1, category: "critical", industries: [], claimUrl: "https://business.nextdoor.com" },
  { slug: "foursquare", name: "Foursquare", url: "https://foursquare.com", tier: 1, category: "critical", industries: [], claimUrl: "https://business.foursquare.com", apiAvailable: true },
  { slug: "yahoo-local", name: "Yahoo Local", url: "https://local.yahoo.com", tier: 1, category: "critical", industries: [] },
  { slug: "alignable", name: "Alignable", url: "https://www.alignable.com", tier: 1, category: "critical", industries: [], submitUrl: "https://www.alignable.com/biz/signup" },
  { slug: "thumbtack", name: "Thumbtack", url: "https://www.thumbtack.com", tier: 1, category: "critical", industries: [], submitUrl: "https://www.thumbtack.com/pro" },
  { slug: "bark", name: "Bark", url: "https://www.bark.com", tier: 1, category: "critical", industries: [], submitUrl: "https://www.bark.com/en/us/pro-signup/" },
  { slug: "angi", name: "Angi", url: "https://www.angi.com", tier: 1, category: "critical", industries: [], submitUrl: "https://www.angi.com/pro" },
  { slug: "expertise", name: "Expertise", url: "https://www.expertise.com", tier: 1, category: "critical", industries: [] },
  { slug: "dandb", name: "Dun & Bradstreet", url: "https://www.dnb.com", tier: 1, category: "critical", industries: [], claimUrl: "https://www.dnb.com/duns/get-a-duns.html", apiAvailable: true },
  { slug: "zoominfo", name: "ZoomInfo", url: "https://www.zoominfo.com", tier: 1, category: "critical", industries: [], claimUrl: "https://www.zoominfo.com", apiAvailable: true },
];

// -----------------------------------------------------------------------------
// Directory Catalog — Tier 2: Major General (42)
// -----------------------------------------------------------------------------

const TIER_2_DIRECTORIES: DirectoryEntry[] = [
  { slug: "yellowpages", name: "YellowPages", url: "https://www.yellowpages.com", tier: 2, category: "major_general", industries: [], claimUrl: "https://www.yellowpages.com" },
  { slug: "whitepages", name: "Whitepages", url: "https://www.whitepages.com", tier: 2, category: "major_general", industries: [] },
  { slug: "superpages", name: "Superpages", url: "https://www.superpages.com", tier: 2, category: "major_general", industries: [] },
  { slug: "manta", name: "Manta", url: "https://www.manta.com", tier: 2, category: "major_general", industries: [], claimUrl: "https://www.manta.com/claim" },
  { slug: "merchantcircle", name: "MerchantCircle", url: "https://www.merchantcircle.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.merchantcircle.com/signup" },
  { slug: "hotfrog", name: "Hotfrog", url: "https://www.hotfrog.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.hotfrog.com/add-business" },
  { slug: "ezlocal", name: "EZlocal", url: "https://www.ezlocal.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.ezlocal.com/signup" },
  { slug: "local-com", name: "Local.com", url: "https://www.local.com", tier: 2, category: "major_general", industries: [] },
  { slug: "citysearch", name: "Citysearch", url: "https://www.citysearch.com", tier: 2, category: "major_general", industries: [] },
  { slug: "chamberofcommerce", name: "ChamberofCommerce.com", url: "https://www.chamberofcommerce.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.chamberofcommerce.com/add-business" },
  { slug: "brownbook", name: "Brownbook", url: "https://www.brownbook.net", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.brownbook.net/add-business/" },
  { slug: "showmelocal", name: "ShowMeLocal", url: "https://www.showmelocal.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.showmelocal.com/add-business" },
  { slug: "magicyellow", name: "MagicYellow", url: "https://www.magicyellow.com", tier: 2, category: "major_general", industries: [] },
  { slug: "yellowbot", name: "YellowBot", url: "https://www.yellowbot.com", tier: 2, category: "major_general", industries: [] },
  { slug: "2findlocal", name: "2FindLocal", url: "https://www.2findlocal.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.2findlocal.com/add-business" },
  { slug: "cylex-usa", name: "Cylex USA", url: "https://www.cylex.us.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.cylex.us.com/add-company" },
  { slug: "opendi", name: "Opendi", url: "https://www.opendi.us", tier: 2, category: "major_general", industries: [] },
  { slug: "fyple", name: "Fyple", url: "https://www.fyple.com", tier: 2, category: "major_general", industries: [] },
  { slug: "n49", name: "N49", url: "https://www.n49.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.n49.com/add-business" },
  { slug: "tupalo", name: "Tupalo", url: "https://www.tupalo.co", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.tupalo.co/signup" },
  { slug: "yalwa", name: "Yalwa", url: "https://www.yalwa.com", tier: 2, category: "major_general", industries: [] },
  { slug: "infobel", name: "Infobel", url: "https://www.infobel.com", tier: 2, category: "major_general", industries: [] },
  { slug: "ibegin", name: "iBegin", url: "https://www.ibegin.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.ibegin.com/submit" },
  { slug: "storeboard", name: "Storeboard", url: "https://www.storeboard.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.storeboard.com/signup" },
  { slug: "bizwiki", name: "BizWiki", url: "https://www.bizwiki.com", tier: 2, category: "major_general", industries: [] },
  { slug: "salespider", name: "SaleSpider", url: "https://www.salespider.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.salespider.com/signup" },
  { slug: "finduslocal", name: "FindUsLocal", url: "https://www.finduslocal.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.finduslocal.com/add-business" },
  { slug: "elocal", name: "eLocal", url: "https://www.elocal.com", tier: 2, category: "major_general", industries: [] },
  { slug: "cityfos", name: "CityFos", url: "https://www.cityfos.com", tier: 2, category: "major_general", industries: [] },
  { slug: "hubbiz", name: "Hubbiz", url: "https://www.hubbiz.com", tier: 2, category: "major_general", industries: [] },
  { slug: "getfave", name: "GetFave", url: "https://www.getfave.com", tier: 2, category: "major_general", industries: [] },
  { slug: "lacartes", name: "LaCartes", url: "https://www.lacartes.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.lacartes.com/add-business" },
  { slug: "gomylocal", name: "GoMyLocal", url: "https://www.gomylocal.com", tier: 2, category: "major_general", industries: [] },
  { slug: "pointcom", name: "Pointcom", url: "https://www.pointcom.com", tier: 2, category: "major_general", industries: [] },
  { slug: "iformative", name: "iFormative", url: "https://www.iformative.com", tier: 2, category: "major_general", industries: [] },
  { slug: "startlocal", name: "StartLocal", url: "https://www.startlocal.com", tier: 2, category: "major_general", industries: [] },
  { slug: "expressbusinessdirectory", name: "Express Business Directory", url: "https://www.expressbusinessdirectory.com", tier: 2, category: "major_general", industries: [], submitUrl: "https://www.expressbusinessdirectory.com/add-business" },
  { slug: "uslocalbizfinder", name: "US Local Biz Finder", url: "https://www.uslocalbizfinder.com", tier: 2, category: "major_general", industries: [] },
  { slug: "judysbook", name: "Judy's Book", url: "https://www.judysbook.com", tier: 2, category: "major_general", industries: [] },
  { slug: "localgyp", name: "LocalGyp", url: "https://www.localgyp.com", tier: 2, category: "major_general", industries: [] },
  { slug: "spokeo", name: "Spokeo", url: "https://www.spokeo.com", tier: 2, category: "major_general", industries: [] },
  { slug: "topix", name: "Topix", url: "https://www.topix.com", tier: 2, category: "major_general", industries: [] },
];

// -----------------------------------------------------------------------------
// Directory Catalog — Tier 3: Industry Specific (11)
// -----------------------------------------------------------------------------

const TIER_3_DIRECTORIES: DirectoryEntry[] = [
  { slug: "taxbuzz", name: "TaxBuzz", url: "https://www.taxbuzz.com", tier: 3, category: "industry_specific", industries: ["tax", "accounting"], submitUrl: "https://www.taxbuzz.com/pro/signup" },
  { slug: "cpadirectory", name: "CPA Directory", url: "https://www.cpadirectory.com", tier: 3, category: "industry_specific", industries: ["tax", "accounting", "cpa"], submitUrl: "https://www.cpadirectory.com/add-listing" },
  { slug: "taxfyle", name: "Taxfyle", url: "https://www.taxfyle.com", tier: 3, category: "industry_specific", industries: ["tax"], submitUrl: "https://www.taxfyle.com/pro" },
  { slug: "taxprofessionals", name: "Tax Professionals", url: "https://www.taxprofessionals.com", tier: 3, category: "industry_specific", industries: ["tax"] },
  { slug: "accountant-com", name: "Accountant.com", url: "https://www.accountant.com", tier: 3, category: "industry_specific", industries: ["accounting", "bookkeeping"] },
  { slug: "find-a-cpa", name: "Find a CPA", url: "https://www.findacpa.com", tier: 3, category: "industry_specific", industries: ["cpa", "accounting"] },
  { slug: "bookkeeper-com", name: "Bookkeeper.com", url: "https://www.bookkeeper.com", tier: 3, category: "industry_specific", industries: ["bookkeeping"] },
  { slug: "proconnect-intuit", name: "ProConnect by Intuit", url: "https://proconnect.intuit.com", tier: 3, category: "industry_specific", industries: ["tax"] },
  { slug: "hrblock-directory", name: "H&R Block Directory", url: "https://www.hrblock.com", tier: 3, category: "industry_specific", industries: ["tax"] },
  { slug: "nacpb", name: "NACPB", url: "https://www.nacpb.org", tier: 3, category: "industry_specific", industries: ["accounting", "bookkeeping"], submitUrl: "https://www.nacpb.org/member-directory" },
  { slug: "nsacct", name: "NSA (National Society of Accountants)", url: "https://www.nsacct.org", tier: 3, category: "industry_specific", industries: ["accounting", "tax"], submitUrl: "https://www.nsacct.org/find-a-tax-professional" },
];

// -----------------------------------------------------------------------------
// Directory Catalog — Tier 4: Review Platforms (10)
// -----------------------------------------------------------------------------

const TIER_4_DIRECTORIES: DirectoryEntry[] = [
  { slug: "trustpilot", name: "Trustpilot", url: "https://www.trustpilot.com", tier: 4, category: "review", industries: [], claimUrl: "https://business.trustpilot.com", apiAvailable: true },
  { slug: "reviews-io", name: "Reviews.io", url: "https://www.reviews.io", tier: 4, category: "review", industries: [], submitUrl: "https://www.reviews.io/front/sign-up", apiAvailable: true },
  { slug: "sitejabber", name: "Sitejabber", url: "https://www.sitejabber.com", tier: 4, category: "review", industries: [], claimUrl: "https://www.sitejabber.com/biz" },
  { slug: "consumeraffairs", name: "ConsumerAffairs", url: "https://www.consumeraffairs.com", tier: 4, category: "review", industries: [], submitUrl: "https://www.consumeraffairs.com/for-brands" },
  { slug: "birdeye", name: "Birdeye", url: "https://birdeye.com", tier: 4, category: "review", industries: [], submitUrl: "https://birdeye.com/signup", apiAvailable: true },
  { slug: "g2", name: "G2", url: "https://www.g2.com", tier: 4, category: "review", industries: [], claimUrl: "https://sell.g2.com", apiAvailable: true },
  { slug: "clutch", name: "Clutch", url: "https://clutch.co", tier: 4, category: "review", industries: [], submitUrl: "https://clutch.co/register" },
  { slug: "goodfirms", name: "GoodFirms", url: "https://www.goodfirms.co", tier: 4, category: "review", industries: [], submitUrl: "https://www.goodfirms.co/register" },
  { slug: "upcity", name: "UpCity", url: "https://upcity.com", tier: 4, category: "review", industries: [], submitUrl: "https://upcity.com/signup" },
  { slug: "podium", name: "Podium", url: "https://www.podium.com", tier: 4, category: "review", industries: [], apiAvailable: true },
];

// -----------------------------------------------------------------------------
// Directory Catalog — Tier 5: Maps (5)
// -----------------------------------------------------------------------------

const TIER_5_DIRECTORIES: DirectoryEntry[] = [
  { slug: "waze", name: "Waze", url: "https://www.waze.com", tier: 5, category: "maps", industries: [], claimUrl: "https://ads.waze.com" },
  { slug: "here-maps", name: "HERE Maps", url: "https://www.here.com", tier: 5, category: "maps", industries: [], submitUrl: "https://mapcreator.here.com", apiAvailable: true },
  { slug: "mapquest", name: "MapQuest", url: "https://www.mapquest.com", tier: 5, category: "maps", industries: [], submitUrl: "https://www.mapquest.com/my-business" },
  { slug: "tomtom", name: "TomTom", url: "https://www.tomtom.com", tier: 5, category: "maps", industries: [], submitUrl: "https://www.tomtom.com/mapshare", apiAvailable: true },
  { slug: "openstreetmap", name: "OpenStreetMap", url: "https://www.openstreetmap.org", tier: 5, category: "maps", industries: [], submitUrl: "https://www.openstreetmap.org/user/new" },
];

// -----------------------------------------------------------------------------
// Directory Catalog — Tier 6: Social (16)
// -----------------------------------------------------------------------------

const TIER_6_DIRECTORIES: DirectoryEntry[] = [
  { slug: "instagram", name: "Instagram", url: "https://www.instagram.com", tier: 6, category: "social", industries: [], apiAvailable: true },
  { slug: "twitter-x", name: "X (Twitter)", url: "https://x.com", tier: 6, category: "social", industries: [], apiAvailable: true },
  { slug: "pinterest", name: "Pinterest", url: "https://www.pinterest.com", tier: 6, category: "social", industries: [], apiAvailable: true },
  { slug: "tiktok", name: "TikTok", url: "https://www.tiktok.com", tier: 6, category: "social", industries: [], apiAvailable: true },
  { slug: "youtube", name: "YouTube", url: "https://www.youtube.com", tier: 6, category: "social", industries: [], apiAvailable: true },
  { slug: "tumblr", name: "Tumblr", url: "https://www.tumblr.com", tier: 6, category: "social", industries: [], apiAvailable: true },
  { slug: "medium", name: "Medium", url: "https://medium.com", tier: 6, category: "social", industries: [] },
  { slug: "about-me", name: "About.me", url: "https://about.me", tier: 6, category: "social", industries: [], submitUrl: "https://about.me/signup" },
  { slug: "quora", name: "Quora", url: "https://www.quora.com", tier: 6, category: "social", industries: [] },
  { slug: "reddit", name: "Reddit", url: "https://www.reddit.com", tier: 6, category: "social", industries: [], apiAvailable: true },
  { slug: "crunchbase", name: "Crunchbase", url: "https://www.crunchbase.com", tier: 6, category: "social", industries: [], submitUrl: "https://www.crunchbase.com/register", apiAvailable: true },
  { slug: "glassdoor", name: "Glassdoor", url: "https://www.glassdoor.com", tier: 6, category: "social", industries: [], claimUrl: "https://www.glassdoor.com/employers" },
  { slug: "indeed", name: "Indeed", url: "https://www.indeed.com", tier: 6, category: "social", industries: [], claimUrl: "https://employers.indeed.com" },
  { slug: "wordpress-com", name: "WordPress.com", url: "https://wordpress.com", tier: 6, category: "social", industries: [] },
  { slug: "blogger", name: "Blogger", url: "https://www.blogger.com", tier: 6, category: "social", industries: [] },
  { slug: "weebly", name: "Weebly", url: "https://www.weebly.com", tier: 6, category: "social", industries: [] },
];

// -----------------------------------------------------------------------------
// Directory Catalog — Tier 7: Local (7)
// -----------------------------------------------------------------------------

const TIER_7_DIRECTORIES: DirectoryEntry[] = [
  { slug: "local-city", name: "Local City Directory", url: "", tier: 7, category: "local", industries: [] },
  { slug: "local-chamber", name: "Local Chamber of Commerce", url: "", tier: 7, category: "local", industries: [] },
  { slug: "massconnect", name: "MassConnect", url: "https://www.massconnect.com", tier: 7, category: "local", industries: [] },
  { slug: "newenglandbusiness", name: "New England Business", url: "https://www.newenglandbusiness.com", tier: 7, category: "local", industries: [] },
  { slug: "smallbizconnect", name: "SmallBizConnect", url: "https://www.smallbizconnect.com", tier: 7, category: "local", industries: [] },
  { slug: "score-org", name: "SCORE", url: "https://www.score.org", tier: 7, category: "local", industries: [], submitUrl: "https://www.score.org/find-mentor" },
  { slug: "sba-gov", name: "SBA.gov", url: "https://www.sba.gov", tier: 7, category: "local", industries: [] },
];

// -----------------------------------------------------------------------------
// Directory Catalog — Already Submitted (54)
// -----------------------------------------------------------------------------

const SUBMITTED_DIRECTORIES: DirectoryEntry[] = [
  { slug: "bizbangboom", name: "BizBangBoom", url: "https://www.bizbangboom.com", tier: 2, category: "submitted", industries: [] },
  { slug: "letsknowit", name: "LetsKnowIt", url: "https://www.letsknowit.com", tier: 2, category: "submitted", industries: [] },
  { slug: "addonbiz", name: "AddOnBiz", url: "https://www.addonbiz.com", tier: 2, category: "submitted", industries: [] },
  { slug: "freead1", name: "FreeAd1", url: "https://www.freead1.net", tier: 2, category: "submitted", industries: [] },
  { slug: "discover247-directoryup", name: "Discover247 DirectoryUp", url: "https://www.discover247.directoryup.com", tier: 2, category: "submitted", industries: [] },
  { slug: "evaunt", name: "Evaunt", url: "https://www.evaunt.com", tier: 2, category: "submitted", industries: [] },
  { slug: "dreevoo", name: "Dreevoo", url: "https://www.dreevoo.com", tier: 2, category: "submitted", industries: [] },
  { slug: "app-emaze", name: "Emaze", url: "https://app.emaze.com", tier: 2, category: "submitted", industries: [] },
  { slug: "qr1-me", name: "QR1.me", url: "https://qr1.me", tier: 2, category: "submitted", industries: [] },
  { slug: "disqus", name: "Disqus", url: "https://disqus.com", tier: 2, category: "submitted", industries: [] },
  { slug: "nextbizthing", name: "NextBizThing", url: "https://www.nextbizthing.com", tier: 2, category: "submitted", industries: [] },
  { slug: "dewalist", name: "Dewalist", url: "https://www.dewalist.com", tier: 2, category: "submitted", industries: [] },
  { slug: "lisnic", name: "Lisnic", url: "https://www.lisnic.com", tier: 2, category: "submitted", industries: [] },
  { slug: "anibookmark", name: "AniBookmark", url: "https://www.anibookmark.com", tier: 2, category: "submitted", industries: [] },
  { slug: "classifiedsforfree", name: "ClassifiedsForFree", url: "https://www.classifiedsforfree.com", tier: 2, category: "submitted", industries: [] },
  { slug: "routeyou", name: "RouteYou", url: "https://www.routeyou.com", tier: 2, category: "submitted", industries: [] },
  { slug: "picktime", name: "Picktime", url: "https://www.picktime.com", tier: 2, category: "submitted", industries: [] },
  { slug: "nicejob", name: "NiceJob", url: "https://www.nicejob.com", tier: 2, category: "submitted", industries: [] },
  { slug: "pastelink", name: "Pastelink", url: "https://pastelink.net", tier: 2, category: "submitted", industries: [] },
  { slug: "mind42", name: "Mind42", url: "https://mind42.com", tier: 2, category: "submitted", industries: [] },
  { slug: "dibiz", name: "DiBiz", url: "https://www.dibiz.com", tier: 2, category: "submitted", industries: [] },
  { slug: "searchmonster", name: "SearchMonster", url: "https://www.searchmonster.org", tier: 2, category: "submitted", industries: [] },
  { slug: "sayellow", name: "SAYellow", url: "https://www.sayellow.com", tier: 2, category: "submitted", industries: [] },
  { slug: "todaysdirectory", name: "Today's Directory", url: "https://www.todaysdirectory.com", tier: 2, category: "submitted", industries: [] },
  { slug: "dealerbaba", name: "DealerBaba", url: "https://www.dealerbaba.com", tier: 2, category: "submitted", industries: [] },
  { slug: "review-stylevore", name: "Stylevore Review", url: "https://review.stylevore.com", tier: 2, category: "submitted", industries: [] },
  { slug: "globaladstorm", name: "GlobalAdStorm", url: "https://www.globaladstorm.com", tier: 2, category: "submitted", industries: [] },
  { slug: "penzu", name: "Penzu", url: "https://penzu.com", tier: 2, category: "submitted", industries: [] },
  { slug: "bold-pro", name: "Bold.pro", url: "https://bold.pro", tier: 2, category: "submitted", industries: [] },
  { slug: "talkmarkets", name: "TalkMarkets", url: "https://www.talkmarkets.com", tier: 2, category: "submitted", industries: [] },
  { slug: "mioola", name: "Mioola", url: "https://www.mioola.com", tier: 2, category: "submitted", industries: [] },
  { slug: "mymeetbook", name: "MyMeetBook", url: "https://www.mymeetbook.com", tier: 2, category: "submitted", industries: [] },
  { slug: "buzzbii", name: "Buzzbii", url: "https://www.buzzbii.com", tier: 2, category: "submitted", industries: [] },
  { slug: "bling", name: "Bling", url: "https://www.bling.com", tier: 2, category: "submitted", industries: [] },
  { slug: "yourbizlocal", name: "YourBizLocal", url: "https://www.yourbizlocal.com", tier: 2, category: "submitted", industries: [] },
  { slug: "mapfling", name: "MapFling", url: "https://www.mapfling.com", tier: 2, category: "submitted", industries: [] },
  { slug: "easymapmaker", name: "EasyMapMaker", url: "https://www.easymapmaker.com", tier: 2, category: "submitted", industries: [] },
  { slug: "kugli", name: "Kugli", url: "https://www.kugli.com", tier: 2, category: "submitted", industries: [] },
  { slug: "hihello", name: "HiHello", url: "https://www.hihello.com", tier: 2, category: "submitted", industries: [] },
  { slug: "localjobs", name: "LocalJobs", url: "https://www.localjobs.com", tier: 2, category: "submitted", industries: [] },
  { slug: "qrcodechimp", name: "QRCodeChimp", url: "https://www.qrcodechimp.com", tier: 2, category: "submitted", industries: [] },
  { slug: "anotepad", name: "ANotepad", url: "https://anotepad.com", tier: 2, category: "submitted", industries: [] },
  { slug: "setmore", name: "Setmore", url: "https://www.setmore.com", tier: 2, category: "submitted", industries: [] },
  { slug: "reservio", name: "Reservio", url: "https://www.reservio.com", tier: 2, category: "submitted", industries: [] },
  { slug: "mindmeister", name: "MindMeister", url: "https://www.mindmeister.com", tier: 2, category: "submitted", industries: [] },
  { slug: "gravatar", name: "Gravatar", url: "https://gravatar.com", tier: 2, category: "submitted", industries: [] },
  { slug: "venngage", name: "Venngage", url: "https://venngage.com", tier: 2, category: "submitted", industries: [] },
  { slug: "wikidot", name: "Wikidot", url: "https://www.wikidot.com", tier: 2, category: "submitted", industries: [] },
  { slug: "justpaste-it", name: "JustPaste.it", url: "https://justpaste.it", tier: 2, category: "submitted", industries: [] },
  { slug: "yeldu", name: "Yeldu", url: "https://www.yeldu.com", tier: 2, category: "submitted", industries: [] },
  { slug: "yellowpagesonlinedirectory", name: "Yellow Pages Online Directory", url: "https://www.yellowpagesonlinedirectory.com", tier: 2, category: "submitted", industries: [] },
  { slug: "myserviceprofile", name: "MyServiceProfile", url: "https://www.myserviceprofile.com", tier: 2, category: "submitted", industries: [] },
  { slug: "localbusinessdirectory", name: "Local Business Directory", url: "https://www.localbusinessdirectory.com", tier: 2, category: "submitted", industries: [] },
  { slug: "facebook", name: "Facebook", url: "https://www.facebook.com", tier: 2, category: "submitted", industries: [], apiAvailable: true },
];

// -----------------------------------------------------------------------------
// Combined Directory Catalog (161 total)
// -----------------------------------------------------------------------------

export const DIRECTORY_CATALOG: DirectoryEntry[] = [
  ...TIER_1_DIRECTORIES,
  ...TIER_2_DIRECTORIES,
  ...TIER_3_DIRECTORIES,
  ...TIER_4_DIRECTORIES,
  ...TIER_5_DIRECTORIES,
  ...TIER_6_DIRECTORIES,
  ...TIER_7_DIRECTORIES,
  ...SUBMITTED_DIRECTORIES,
];

// -----------------------------------------------------------------------------
// Pricing
// -----------------------------------------------------------------------------

export const LS_BASIC_PRICE_CENTS = 700; // $7/mo
export const LS_PRO_PRICE_CENTS = 1500; // $15/mo
export const LS_BASIC_TRIAL_DAYS = 30;
export const LS_PRO_TRIAL_DAYS = 14;

// -----------------------------------------------------------------------------
// Review Platforms
// -----------------------------------------------------------------------------

export const REVIEW_PLATFORMS = [
  "google",
  "yelp",
  "facebook",
  "trustpilot",
  "bbb",
  "birdeye",
  "g2",
] as const;

export type ReviewPlatform = (typeof REVIEW_PLATFORMS)[number];

// -----------------------------------------------------------------------------
// Sentiment Labels
// -----------------------------------------------------------------------------

export const SENTIMENT_LABELS = {
  positive: { label: "Positive", color: "text-green-500 bg-green-500/10" },
  neutral: { label: "Neutral", color: "text-yellow-500 bg-yellow-500/10" },
  negative: { label: "Negative", color: "text-red-500 bg-red-500/10" },
} as const;

export type SentimentType = keyof typeof SENTIMENT_LABELS;

// -----------------------------------------------------------------------------
// Helper Utilities
// -----------------------------------------------------------------------------

/** Get a directory entry by slug */
export function getDirectory(slug: string): DirectoryEntry | undefined {
  return DIRECTORY_CATALOG.find((d) => d.slug === slug);
}

/** Get all directories for a specific tier */
export function getDirectoriesByTier(tier: number): DirectoryEntry[] {
  return DIRECTORY_CATALOG.filter((d) => d.tier === tier);
}

/** Get all directories for a specific category */
export function getDirectoriesByCategory(category: string): DirectoryEntry[] {
  return DIRECTORY_CATALOG.filter((d) => d.category === category);
}

/** Get directories relevant to a given industry (tier 3 + all-industry dirs) */
export function getDirectoriesForIndustry(industry: string): DirectoryEntry[] {
  return DIRECTORY_CATALOG.filter(
    (d) => d.industries.length === 0 || d.industries.includes(industry)
  );
}

/** Calculate max possible listing score based on applicable directories */
export function calculateMaxScore(industries: string[] = []): number {
  return DIRECTORY_CATALOG.filter(
    (d) =>
      d.industries.length === 0 ||
      d.industries.some((i) => industries.includes(i))
  ).reduce((sum, d) => sum + (TIER_CONFIG[d.tier as Tier]?.weight ?? 0), 0);
}
