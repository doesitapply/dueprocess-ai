import "dotenv/config";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { registerMobileRoutes } from "./mobileRouter";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const itWithOwner = process.env.OWNER_OPEN_ID ? it : it.skip;

type TestServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

async function startMobileServer(): Promise<TestServer> {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  registerMobileRoutes(app);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind mobile test server");

  return {
    baseUrl: `http://127.0.0.1:${address.port}/api/mobile/v1`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describeWithDb("mobile REST API auth and access", () => {
  const previousMobileKey = process.env.MOBILE_AUTH_ACCESS_KEY;
  const previousMobileAdminKey = process.env.MOBILE_ADMIN_ACCESS_KEY;
  let server: TestServer;
  const mobileKey = `mobile-test-${Date.now()}`;
  const adminKey = `mobile-admin-test-${Date.now()}`;
  const normalOpenId = `mobile:mobile-rest-${Date.now()}@example.test`;

  beforeAll(async () => {
    process.env.MOBILE_AUTH_ACCESS_KEY = mobileKey;
    process.env.MOBILE_ADMIN_ACCESS_KEY = adminKey;
    server = await startMobileServer();
  });

  afterAll(async () => {
    await server?.close();
    process.env.MOBILE_AUTH_ACCESS_KEY = previousMobileKey;
    process.env.MOBILE_ADMIN_ACCESS_KEY = previousMobileAdminKey;

    const db = await getDb();
    if (db) {
      await db.delete(users).where(inArray(users.openId, [normalOpenId]));
    }
  });

  async function login(accessKey: string, email?: string) {
    const response = await fetch(`${server.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey, email, name: "Mobile REST Test" }),
    });

    return {
      response,
      body: await readJson(response),
    };
  }

  it("requires the configured access key before issuing mobile bearer tokens", async () => {
    const response = await fetch(`${server.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "mobile-rest@example.test" }),
    });

    expect(response.status).toBe(401);
  });

  it("keeps normal mobile users out of admin-only agent catalog data", async () => {
    const { response, body } = await login(mobileKey, normalOpenId.replace(/^mobile:/, ""));
    expect(response.ok).toBe(true);
    expect(body.user.role).toBe("user");

    const catalogResponse = await fetch(`${server.baseUrl}/agents/catalog`, {
      headers: { Authorization: `Bearer ${body.accessToken}` },
    });
    const catalog = await readJson(catalogResponse);

    expect(catalogResponse.ok).toBe(true);
    expect(catalog.agents).toHaveLength(0);
    expect(catalog.superAgents).toHaveLength(0);
  });

  itWithOwner("maps the mobile admin key to the owner admin account", async () => {
    const { response, body } = await login(adminKey);
    expect(response.ok).toBe(true);
    expect(body.user.role).toBe("admin");

    const catalogResponse = await fetch(`${server.baseUrl}/agents/catalog`, {
      headers: { Authorization: `Bearer ${body.accessToken}` },
    });
    const catalog = await readJson(catalogResponse);

    expect(catalogResponse.ok).toBe(true);
    expect(catalog.agents.length).toBeGreaterThan(0);
    expect(catalog.superAgents.length).toBeGreaterThan(0);
  });

  it("rejects protected mobile routes without a bearer token", async () => {
    const response = await fetch(`${server.baseUrl}/documents`);
    expect(response.status).toBe(401);
  });
});
