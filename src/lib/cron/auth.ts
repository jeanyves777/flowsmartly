import { NextRequest } from "next/server";

export function isCronAuthorized(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return false;

  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-cron-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return (
    authHeader === `Bearer ${expectedSecret}` ||
    secretHeader === expectedSecret ||
    querySecret === expectedSecret
  );
}
