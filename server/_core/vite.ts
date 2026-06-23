import express, { type Express, type RequestHandler } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";

type DevViteServer = {
  middlewares: RequestHandler;
  transformIndexHtml(url: string, html: string): Promise<string>;
  ssrFixStacktrace(error: Error): void;
};

type ViteConfigFactory = (input: {
  command: "serve";
  mode: string;
  isSsrBuild: boolean;
  isPreview: boolean;
}) => unknown | Promise<unknown>;

async function loadDevVite() {
  const viteModule = await import("vite" + "") as {
    createServer(config: Record<string, unknown>): Promise<DevViteServer>;
  };
  const viteConfigModule = await import("../../vite.config" + "") as {
    default: unknown | ViteConfigFactory;
  };

  return {
    createViteServer: viteModule.createServer,
    viteConfig: viteConfigModule.default,
  };
}

export async function setupVite(app: Express, server: Server) {
  const { createViteServer, viteConfig } = await loadDevVite();
  const baseViteConfig =
    typeof viteConfig === "function"
      ? await viteConfig({
          command: "serve",
          mode: process.env.NODE_ENV || "development",
          isSsrBuild: false,
          isPreview: false,
        })
      : viteConfig;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...(typeof baseViteConfig === "object" && baseViteConfig ? baseViteConfig : {}),
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
