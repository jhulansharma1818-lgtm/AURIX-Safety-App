import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    const [demoUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.authSubject, "demo:user"))
      .limit(1);
    const data = HealthCheckResponse.parse({
      status: "ok",
      database: "connected",
      demoData: Boolean(demoUser),
      checkedAt: new Date().toISOString(),
    });
    return res.json(data);
  } catch {
    const data = HealthCheckResponse.parse({
      status: "degraded",
      database: "unavailable",
      demoData: false,
      checkedAt: new Date().toISOString(),
    });
    return res.json(data);
  }
});

export default router;
