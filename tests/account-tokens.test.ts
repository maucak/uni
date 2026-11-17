import test from "node:test";
import assert from "node:assert/strict";
import {
  generateToken,
  hashToken,
  tokenLifetimeMs,
  tokenStatus,
} from "../server/services/account-tokens.ts";
import { mailFileName } from "../server/services/mail.ts";

test("belirteç rastgele üretilir ve yalnızca sha256 özeti saklanır", () => {
  const a = generateToken();
  const b = generateToken();
  assert.notEqual(a.token, b.token);
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.equal(a.hash, hashToken(a.token));
  assert.notEqual(a.hash, a.token);
});

test("süreler: doğrulama 24 saat, sıfırlama 30 dakika", () => {
  assert.equal(tokenLifetimeMs.verify_email, 24 * 60 * 60 * 1000);
  assert.equal(tokenLifetimeMs.reset_password, 30 * 60 * 1000);
});

test("süresi dolan, kullanılan ve yanlış amaçlı belirteç reddedilir", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  const row = {
    purpose: "reset_password",
    expires_at: new Date(now.getTime() + tokenLifetimeMs.reset_password),
    used_at: null,
  };
  assert.equal(tokenStatus(row, "reset_password", now), "valid");
  assert.equal(tokenStatus(row, "verify_email", now), "missing");
  assert.equal(tokenStatus(undefined, "reset_password", now), "missing");
  assert.equal(
    tokenStatus(row, "reset_password", new Date(row.expires_at.getTime())),
    "expired",
  );
  assert.equal(
    tokenStatus(
      row,
      "reset_password",
      new Date(now.getTime() + 31 * 60 * 1000),
    ),
    "expired",
  );
  assert.equal(
    tokenStatus({ ...row, used_at: now }, "reset_password", now),
    "used",
  );
});

test("e-posta dosya adı zaman ve güvenli alıcı adı içerir", () => {
  const name = mailFileName(
    "Ali/../X@Example.test",
    new Date("2026-11-17T12:00:00.123Z"),
  );
  assert.equal(name, "2026-11-17T12-00-00-123Z-ali_.._x@example.test.txt");
  assert.ok(!name.includes("/"));
});
