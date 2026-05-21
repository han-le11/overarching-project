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

const app = new Hono();
const QUEUE_NAME = "submissions";

// apply CORS and logging middleware to all routes
app.use("/*", cors());
app.use("/*", logger());

let languagesCache = null;
const exercisesCache = new Map();

// Retrieve all programming languages
app.get("/api/languages", async (c) => {
  if (languagesCache) {
    return c.json(languagesCache);
  }

  const rows = await sql`
    SELECT id, name
    FROM languages
    ORDER BY id
  `;
  languagesCache = rows;
  return c.json(languagesCache);
});

// Retrieve all exercises for a specific programming language
app.get("/api/languages/:id/exercises", async (c) => {
  const idParam = c.req.param("id");  // get the language id
  const languageId = Number(idParam);

  if (!Number.isInteger(languageId) || languageId <= 0) {
    return c.json({ error: "Invalid language id" }, 400);
  }

  if (exercisesCache.has(languageId)) {
    return c.json(exercisesCache.get(languageId));
  }

  const rows = await sql`
    SELECT id, title, description
    FROM exercises
    WHERE language_id = ${languageId}
    ORDER BY id
  `;
  exercisesCache.set(languageId, rows);
  return c.json(rows);
});

// Retrieve a single exercise by id
app.get("/api/exercises/:id", async (c) => {
  const idParam = c.req.param("id");
  const exerciseId = Number(idParam);

  if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
    return c.json({ error: "Invalid exercise id" }, 400);
  }

  const rows = await sql`
    SELECT id, title, description
    FROM exercises
    WHERE id = ${exerciseId}
  `;

  if (!rows.length) {
    return c.body(null, 404);
  }

  const exercise = rows[0];
  return c.json({
    id: exercise.id,
    title: exercise.title,
    description: exercise.description,
  });
});

// Create a new submission for an exercise
app.post("/api/exercises/:id/submissions", async (c) => {
  const idParam = c.req.param("id");
  const exerciseId = Number(idParam);

  // Validate the exerciseId parameter
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
    return c.json({ error: "Invalid exercise id" }, 400);
  }

  const body = await c.req.json().catch(() => null);  // Parse the request body as JSON, return null if parsing fails
  const sourceCode = body?.source_code;  // Extract source_code from the request body

  // Validate the source_code field
  if (typeof sourceCode !== "string" || sourceCode.trim() === "") {
    return c.json({ error: "source_code is required" }, 400);
  }

  const rows = await sql`
    INSERT INTO exercise_submissions (exercise_id, source_code)
    VALUES (${exerciseId}, ${sourceCode})
    RETURNING id
  `;

  const inserted = rows[0];
  await redis.lpush(QUEUE_NAME, inserted.id);
  return c.json({ id: inserted.id }, 201);
});

// Retrieve status information for a single submission
app.get("/api/submissions/:id/status", async (c) => {
  const idParam = c.req.param("id");
  const submissionId = Number(idParam);

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return c.json({ error: "Invalid submission id" }, 400);
  }

  // Do not cache this response: always hit the DB
  const rows = await sql`
    SELECT grading_status, grade
    FROM exercise_submissions
    WHERE id = ${submissionId}
  `;

  if (!rows.length) {
    return c.body(null, 404);
  }

  const submission = rows[0];
  return c.json({
    grading_status: submission.grading_status,
    grade: submission.grade,
  });
});

export default app;
