import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getReturnTo(req: Request) {
  const value = req.query.returnTo;
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  return value;
}

function getLocalUser() {
  return {
    openId: ENV.ownerOpenId || "local-owner",
    name: process.env.OWNER_NAME || "Local Owner",
    email: process.env.OWNER_EMAIL || null,
    loginMethod: "local",
  };
}

function isLoopbackRequest(req: Request) {
  const host = req.hostname;

  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1"
  );
}

function ensureLocalAuthAllowed(req: Request, res: Response) {
  if (isLoopbackRequest(req)) {
    return true;
  }

  res.status(403).json({ error: "Local auth is only available on loopback hosts." });
  return false;
}

async function createLocalSession(req: Request, res: Response) {
  const user = getLocalUser();

  await db.upsertUser({
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    lastSignedIn: new Date(),
  });

  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    expiresInMs: ONE_YEAR_MS,
  });

  res.cookie(COOKIE_NAME, sessionToken, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/login", async (req: Request, res: Response) => {
    if (!ensureLocalAuthAllowed(req, res)) return;

    try {
      await createLocalSession(req, res);
      res.redirect(302, getReturnTo(req));
    } catch (error) {
      console.error("[Auth] Local login failed", error);
      res.status(500).json({ error: "Local login failed" });
    }
  });

  app.get("/api/auth/google", async (req: Request, res: Response) => {
    if (!ensureLocalAuthAllowed(req, res)) return;

    try {
      await createLocalSession(req, res);
      res.redirect(302, getReturnTo(req));
    } catch (error) {
      console.error("[Auth] Local Google login failed", error);
      res.status(500).json({ error: "Local login failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    if (!ensureLocalAuthAllowed(req, res)) return;

    try {
      await createLocalSession(req, res);
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Auth] Local callback fallback failed", error);
      res.status(500).json({ error: "Local login failed" });
    }
  });
}
