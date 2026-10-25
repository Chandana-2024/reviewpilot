import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

describe("review API", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns health status", async () => {
    app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns structured findings for valid source", async () => {
    app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/review",
      payload: { filename: "src/example.js", code: "eval(userInput);" }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().findings.some((f: { ruleId: string }) => f.ruleId === "SEC-DYNAMIC-EVAL")).toBe(true);
  });

  it("rejects unsupported extensions", async () => {
    app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/review",
      payload: { filename: "notes.txt", code: "hello" }
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects invalid input", async () => {
    app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/review",
      payload: { filename: "../secret.js", code: "eval(x)" }
    });
    expect(response.statusCode).toBe(400);
  });
});
