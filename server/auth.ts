import {
  randomBytes,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { pool } from "./db.ts";
import type { User } from "../shared/contracts.ts";
import { profileSchema } from "../shared/contracts.ts";
const scrypt = promisify(nodeScrypt);
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32)
  throw new Error(
    "En az 32 karakterlik JWT_SECRET gerekli. npm run dev yerel anahtar oluşturur.",
  );
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, hex] = hash.split(":");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export function userFromRow(row: any): User {
  return {
    id: row.id,
    email: row.email,
    profile: profileSchema.parse(row.profile),
  };
}
export async function createSession(res: Response, userId: string) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [id, userId],
  );
  const token = jwt.sign({ sid: id }, secret!, {
    subject: userId,
    expiresIn: "12h",
    issuer: "kampuspusula",
    audience: "kampuspusula-web",
  });
  res.cookie("kp_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
}
export async function session(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.cookies.kp_session) {
      let payload: jwt.JwtPayload | undefined;
      try {
        const decoded = jwt.verify(req.cookies.kp_session, secret!, {
          issuer: "kampuspusula",
          audience: "kampuspusula-web",
          algorithms: ["HS256"],
        });
        if (typeof decoded !== "string") payload = decoded;
      } catch {}
      if (payload?.sid && payload.sub) {
        const result = await pool.query(
          "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND u.id=$2 AND s.expires_at>now()",
          [payload.sid, payload.sub],
        );
        if (result.rowCount) {
          res.locals.user = userFromRow(result.rows[0]);
          res.locals.sessionId = payload.sid;
        }
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}
export function requireUser(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user)
    return res.status(401).json({
      code: "AUTH_REQUIRED",
      message: "Bu işlem için giriş yapmalısın.",
    });
  next();
}
