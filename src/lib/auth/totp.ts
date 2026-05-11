import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");

  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";

  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value >= 0) bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function createTotpUri(params: { secret: string; accountName: string; issuer?: string }) {
  const issuer = params.issuer || "FlowSmartly";
  const label = `${issuer}:${params.accountName}`;
  const url = new URL(`otpauth://totp/${encodeURIComponent(label)}`);
  url.searchParams.set("secret", params.secret);
  url.searchParams.set("issuer", issuer);
  url.searchParams.set("algorithm", "SHA1");
  url.searchParams.set("digits", String(TOTP_DIGITS));
  url.searchParams.set("period", String(TOTP_STEP_SECONDS));
  return url.toString();
}

export function verifyTotpCode(secret: string, code: string, window = 1): boolean {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
  for (let offset = -window; offset <= window; offset += 1) {
    if (timingSafeEqual(hotp(secret, counter + offset), normalized)) return true;
  }
  return false;
}

export function createRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
    .digest("hex");
}

export function consumeRecoveryCode(hashedCodesJson: string | null | undefined, code: string) {
  let hashedCodes: string[] = [];
  try {
    hashedCodes = JSON.parse(hashedCodesJson || "[]");
  } catch {
    hashedCodes = [];
  }

  const hashedInput = hashRecoveryCode(code);
  const index = hashedCodes.findIndex((hashedCode) => timingSafeEqual(hashedCode, hashedInput));
  if (index < 0) return { valid: false, remainingHashes: hashedCodes };

  const remainingHashes = hashedCodes.filter((_, currentIndex) => currentIndex !== index);
  return { valid: true, remainingHashes };
}
