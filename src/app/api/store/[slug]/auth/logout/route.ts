import { NextResponse } from "next/server";
import { clearCustomerCookie } from "@/lib/store/customer-auth";

export async function POST() {
  await clearCustomerCookie();
  return NextResponse.json({ success: true });
}
