#!/usr/bin/env node
/**
 * Export SQLite data to PostgreSQL-compatible SQL INSERT statements.
 * Handles: boolean 0/1 -> TRUE/FALSE, epoch timestamps -> ISO timestamps.
 * Usage: node scripts/export-sqlite-to-sql.js > data-export.sql
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "prisma", "dev.db");
const db = new Database(DB_PATH, { readonly: true });

// Table export order (respecting foreign key dependencies)
const TABLES = [
  "User", "Session", "PasswordReset", "EmailVerification",
  "Plan", "CreditPackage", "AdminUser", "AdminSession",
  "SystemSetting", "BrandKit", "ContentTemplate", "CreditPricing",
  "Team", "TeamMember", "MarketingConfig", "ContactList",
  "Contact", "ContactListMember", "Coupon", "Referral",
  "Post", "Comment", "CommentLike", "Like", "Bookmark", "Share", "Follow",
  "AdPage", "AdCampaign", "PostView", "Earning", "Payout",
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

// Known boolean columns (SQLite stores as 0/1)
const BOOLEAN_COLUMNS = new Set([
  "emailVerified", "isPromoted", "isDefault", "isComplete", "isSystem",
  "isActive", "isFeatured", "isPublic", "isSuperAdmin", "isPopular",
  "isWinner", "read", "emailOptedIn", "smsOptedIn",
  "emailEnabled", "smsEnabled", "smsVerified", "bounced", "cookieConsent",
  "marketingConsent", "isFavorite", "isUsed", "enabled", "aiGenerated",
  "aiSuggested", "autoCompleted", "sharedToFeed", "includeMedia",
]);

// Known DateTime columns (SQLite stores as epoch ms integers)
const DATETIME_COLUMNS = new Set([
  "createdAt", "updatedAt", "deletedAt", "lastLoginAt", "planExpiresAt",
  "emailVerifiedAt", "expiresAt", "usedAt", "scheduledAt", "publishedAt",
  "sentAt", "deliveredAt", "openedAt", "clickedAt", "bouncedAt",
  "requestedAt", "processedAt", "startDate", "endDate", "completedAt", "dueDate",
  "unsubscribedAt", "emailOptedInAt", "smsOptedInAt", "addedAt", "joinedAt",
  "redeemedAt", "complianceSubmittedAt", "complianceReviewedAt",
  "usageResetDate", "lastTriggered", "firstSeenAt", "lastSeenAt",
  "startedAt", "endedAt", "lastActiveAt", "achievedAt", "readAt",
  "lastActivitySync", "date", "reviewedAt",
]);

function escapeValue(val, col) {
  if (val === null || val === undefined) return "NULL";

  // Boolean conversion
  if (BOOLEAN_COLUMNS.has(col) && (val === 0 || val === 1)) {
    return val === 1 ? "TRUE" : "FALSE";
  }

  // DateTime conversion: epoch integer -> ISO string
  if (DATETIME_COLUMNS.has(col) && typeof val === "number") {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return "'" + d.toISOString() + "'";
      }
    } catch { /* fall through */ }
  }

  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";

  // String value — escape single quotes
  return "'" + String(val).replace(/'/g, "''") + "'";
}

// Use individual transactions per table instead of one big one
// This way if one table has issues, others still import
console.log("-- FlowSmartly SQLite -> PostgreSQL data export");
console.log("-- Generated: " + new Date().toISOString());
console.log("");

for (const table of TABLES) {
  try {
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length === 0) continue;

    console.log(`-- Table: ${table} (${rows.length} rows)`);

    const columns = Object.keys(rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");

    for (const row of rows) {
      const values = columns
        .map((col) => escapeValue(row[col], col))
        .join(", ");
      console.log(`INSERT INTO "${table}" (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;`);
    }
    console.log("");
  } catch (e) {
    console.log(`-- Skipped ${table}: ${e.message}`);
    console.log("");
  }
}

db.close();
