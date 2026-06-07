import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  email?: string | null;
  loginMethod?: string | null;
};

class LocalSessionService {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) {
      throw new Error("JWT_SECRET is required for local auth sessions.");
    }

    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: {
      appId?: string;
      email?: string | null;
      expiresInMs?: number;
      loginMethod?: string | null;
      name?: string;
    } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: options.appId || ENV.appId || "local",
        name: options.name || "",
        email: options.email ?? null,
        loginMethod: options.loginMethod ?? "local",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      email: payload.email ?? null,
      loginMethod: payload.loginMethod ?? "local",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, email, loginMethod } = payload as Record<
        string,
        unknown
      >;

      if (!isNonEmptyString(openId) || !isNonEmptyString(appId)) {
        return null;
      }

      return {
        openId,
        appId,
        name: typeof name === "string" ? name : "",
        email: typeof email === "string" ? email : null,
        loginMethod: typeof loginMethod === "string" ? loginMethod : "local",
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const signedInAt = new Date();
    let user = await db.getUserByOpenId(session.openId);

    if (!user) {
      await db.upsertUser({
        openId: session.openId,
        name: session.name || null,
        email: session.email ?? null,
        loginMethod: session.loginMethod ?? "local",
        lastSignedIn: signedInAt,
      });
    } else {
      await db.upsertUser({
        openId: user.openId,
        name: session.name || user.name,
        email: session.email ?? user.email,
        loginMethod: session.loginMethod ?? user.loginMethod,
        lastSignedIn: signedInAt,
      });
    }

    user = await db.getUserByOpenId(session.openId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const sdk = new LocalSessionService();
