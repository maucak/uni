import { createHash, randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";

export type TokenPurpose = "verify_email" | "reset_password";
export const tokenLifetimeMs: Record<TokenPurpose, number> = {
  verify_email: 24 * 60 * 60_000,
  reset_password: 30 * 60_000,
};
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function generateToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export type TokenRow = {
  purpose: string;
  expires_at: Date;
  used_at: Date | null;
};
export function tokenStatus(
  row: TokenRow | undefined,
  purpose: TokenPurpose,
  now = new Date(),
): "valid" | "missing" | "used" | "expired" {
  if (!row || row.purpose !== purpose) return "missing";
  if (row.used_at) return "used";
  if (row.expires_at.getTime() <= now.getTime()) return "expired";
  return "valid";
}
/** Yeni belirteç üretir; aynı amaçlı kullanılmamış eski belirteçleri geçersiz kılar. */
export async function issueToken(
  client: pg.PoolClient,
  userId: string,
  purpose: TokenPurpose,
) {
  const { token, hash } = generateToken();
  await client.query(
    "DELETE FROM account_tokens WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL",
    [userId, purpose],
  );
  await client.query(
    "INSERT INTO account_tokens(id,user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)",
    [
      randomUUID(),
      userId,
      purpose,
      hash,
      new Date(Date.now() + tokenLifetimeMs[purpose]),
    ],
  );
  return token;
}
/** Belirteci tek seferlik tüketir; geçerliyse kullanıcı kimliğini döndürür. */
export async function consumeToken(
  client: pg.PoolClient,
  token: string,
  purpose: TokenPurpose,
): Promise<string | null> {
  const r = await client.query(
    "SELECT id,user_id,purpose,expires_at,used_at FROM account_tokens WHERE token_hash=$1 FOR UPDATE",
    [hashToken(token)],
  );
  if (tokenStatus(r.rows[0], purpose) !== "valid") return null;
  await client.query("UPDATE account_tokens SET used_at=now() WHERE id=$1", [
    r.rows[0].id,
  ]);
  return r.rows[0].user_id;
}
