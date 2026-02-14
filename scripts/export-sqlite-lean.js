#!/usr/bin/env node
/**
 * Lean export: Skip tables with large base64 data (Design, MediaFile).
 * These contain dev-only inline SVGs — production uses S3 URLs.
 * Usage: node scripts/export-sqlite-lean.js > data-export-lean.sql
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "prisma", "dev.db");
const db = new Database(DB_PATH, { readonly: true });

// Skip tables with huge base64 data
const SKIP_TABLES = new Set(["Design", "MediaFile", "MediaFolder"]);

const TABLES = [
  "User", "Session", "PasswordReset", "EmailVerification",
  "Plan", "CreditPackage", "AdminUser", "AdminSession",
  "SystemSetting", "BrandKit", "ContentTemplate", "CreditPricing",
  "Team", "TeamMember", "MarketingConfig", "ContactList",
  "Contact", "ContactListMember", "Coupon", "Referral",
  "Post", "Comment", "CommentLike", "Like", "Bookmark", "Share", "Follow",
  "AdCampaign", "PostView", "Earning", "Payout",
  "Campaign", "CampaignSend", "Automation", "AutomationLog",
  "Notification", "AIUsage", "CreditTransaction", "Invoice",
  "Design", "LandingPage", "FormSubmission",
  "MediaFolder", "MediaFile", "GeneratedContent",
  "CartoonProject", "CartoonVideo", "AIConversation", "AIMessage",
  "Visitor", "PageView", "VisitorSession", "TrackingEvent",
  "RealtimeVisitor", "AnalyticsDaily", "AnalyticsPageDaily",
  "ContentVariant", "WhiteLabelConfig", "AuditLog",
  "PostAutomation", "MarketingStrategy", "StrategyTask",
  "StrategyScore", "StrategyMilestone",
];

const BOOLEAN_COLUMNS = new Set([
  "emailVerified", "isPromoted", "isDefault", "isComplete", "isSystem",
  "isActive", "isFeatured", "isPublic", "isSuperAdmin", "isPopular",
  "isWinner", "read", "emailOptedIn", "smsOptedIn",
  "emailEnabled", "smsEnabled", "smsVerified", "bounced", "cookieConsent",
  "marketingConsent", "isFavorite", "isUsed", "enabled", "aiGenerated",
  "aiSuggested", "autoCompleted", "sharedToFeed", "includeMedia",
]);

function escapeValue(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  return "'" + String(val).replace(/'/g, "''") + "'";
}

console.log("-- FlowSmartly SQLite -> PostgreSQL LEAN data export");
console.log("-- Generated: " + new Date().toISOString());
console.log("-- Skipped tables: " + [...SKIP_TABLES].join(", "));
console.log("BEGIN;");
console.log("");

for (const table of TABLES) {
  if (SKIP_TABLES.has(table)) {
    console.log(`-- Skipped: ${table} (large base64 dev data)`);
    console.log("");
    continue;
  }

  try {
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length === 0) continue;

    console.log(`-- Table: ${table} (${rows.length} rows)`);

    const columns = Object.keys(rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");

    for (const row of rows) {
      const values = columns
        .map((col) => {
          const val = row[col];
          if (BOOLEAN_COLUMNS.has(col) && (val === 0 || val === 1)) {
            return val === 1 ? "TRUE" : "FALSE";
          }
          return escapeValue(val);
        })
        .join(", ");
      console.log(`INSERT INTO "${table}" (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;`);
    }
    console.log("");
  } catch (e) {
    console.log(`-- Skipped ${table}: ${e.message}`);
    console.log("");
  }
}

console.log("COMMIT;");
db.close();
process.stderr.write("Lean export complete.\n");
