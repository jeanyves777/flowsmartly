/**
 * mint-reel-session.ts — DEV ONLY. Mints a signed access_token cookie for an
 * existing user so we can drive the Reel API end-to-end over HTTP locally
 * (getSession's access path trusts a validly-signed token + existing user).
 * Prints { userId, email, token } as JSON. Not shipped / not a product path.
 */
import { join } from "path";
import { readFileSync } from "fs";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const envRaw = readFileSync(join(process.cwd(), ".env"), "utf-8");
function envVal(key: string): string | undefined {
  const m = envRaw.match(new RegExp("^" + key + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
}
const SECRET = envVal("JWT_ACCESS_SECRET") || "dev-access-secret-change-in-production";
process.env.DATABASE_URL = "file:" + join(process.cwd(), "prisma/dev.db").replace(/\\/g, "/");

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ select: { id: true, email: true } });
  if (!user) {
    console.error("NO_USER — run `npm run db:seed` first");
    process.exit(1);
  }
  const token = await new SignJWT({ userId: user.id, sessionId: "reel-test-session", type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(new TextEncoder().encode(SECRET));
  console.log(JSON.stringify({ userId: user.id, email: user.email, token }));
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
