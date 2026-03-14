import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";
import postgres from "postgres";
import { Redis } from "ioredis";

// Helper function to construct the database URL from environment variables
const databaseUrlFromEnv = () => {
  const directUrl = Deno.env.get("DATABASE_URL");
  if (directUrl) {
    return directUrl;
  }

  const user = Deno.env.get("POSTGRES_USER");
  const password = Deno.env.get("POSTGRES_PASSWORD");
  const db = Deno.env.get("POSTGRES_DB");

  if (!user || !password || !db) {
    throw new Error(
      "Database configuration missing. Set DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB.",
    );
  }

  const host = Deno.env.get("POSTGRES_HOST") ?? "postgresql_database";
  const port = Deno.env.get("POSTGRES_PORT") ?? "5432";

  return `postgres://${user}:${password}@${host}:${port}/${db}`;
};

const sql = postgres(databaseUrlFromEnv());

// Initialize Redis client
let redis;
if (Deno.env.get("REDIS_HOST")) {
  redis = new Redis(
    Number.parseInt(Deno.env.get("REDIS_PORT")),
    Deno.env.get("REDIS_HOST"),
  );
} else {
  redis = new Redis(6379, "redis");
}

let consumeEnabled = false;
let gradingLoopRunning = false;

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const gradingLoop = async () => {
  if (gradingLoopRunning) return;
  gradingLoopRunning = true;
  try {
    while (consumeEnabled) {
      const queueSize = await redis.llen("submissions");
      if (!queueSize) {
        await sleep(250);
        continue;
      }

      const item = await redis.rpop("submissions");
      if (item === null) {
        continue;
      }

      const submissionId = Number(item);
      if (!Number.isInteger(submissionId) || submissionId <= 0) {
        continue;
      }

      await sql`
        UPDATE exercise_submissions
        SET grading_status = 'processing'
        WHERE id = ${submissionId}
      `;

      const delayMs = 1000 + Math.floor(Math.random() * 2000);
      await sleep(delayMs);

      const grade = Math.floor(Math.random() * 101);

      await sql`
        UPDATE exercise_submissions
        SET grading_status = 'graded',
            grade = ${grade}
        WHERE id = ${submissionId}
      `;
    }
  } finally {
    gradingLoopRunning = false;
  }
};

const app = new Hono();

app.use("/*", cors());
app.use("/*", logger());

app.get("/api/status", async (c) => {
  const queueSize = await redis.llen("submissions");
  return c.json({
    queue_size: queueSize,
    consume_enabled: consumeEnabled,
  });
});

app.post("/api/consume/enable", async (c) => {
  consumeEnabled = true;
  gradingLoop();
  return c.json({ consume_enabled: true });
});

app.post("/api/consume/disable", async (c) => {
  consumeEnabled = false;
  return c.json({ consume_enabled: false });
});

export default app;

