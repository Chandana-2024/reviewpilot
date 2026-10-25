import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ReviewRequestSchema, reviewCode } from "@review-bot/review-engine";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === "production" ? "info" : "warn" },
    bodyLimit: 256 * 1024,
    disableRequestLogging: true
  });

  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: false
  });

  await app.register(rateLimit, {
    max: 30,
    timeWindow: "1 minute"
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/review", async (request, reply) => {
    const parsed = ReviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid review request",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    if (!/\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(parsed.data.filename)) {
      return reply.code(400).send({
        error: "Unsupported file extension. Use a JavaScript or TypeScript file."
      });
    }

    try {
      const result = reviewCode(parsed.data);
      return reply.code(200).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Review failed";
      return reply.code(400).send({ error: message });
    }
  });

 app.setErrorHandler((error, request, reply) => {
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
      ? error.statusCode
      : 500;

  const message =
    error instanceof Error
      ? error.message
      : "Request failed";

  request.log.warn({ err: message }, "Request failed");

  if (statusCode === 413) {
    return reply.code(413).send({
      error: "Request too large. Maximum request body is 256 KiB."
    });
  }

  const isClientError = statusCode >= 400 && statusCode < 500;

  return reply.code(isClientError ? statusCode : 500).send({
    error: isClientError ? message : "Internal server error"
  });
  });

  return app;
}
