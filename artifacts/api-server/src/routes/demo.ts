import { Router, type IRouter } from "express";
import { SeedDemoDataResponse } from "@workspace/api-zod";
import { seedDemoDataset } from "../lib/demo-seed";

const router: IRouter = Router();

router.post("/demo/seed", async (_req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "Not found." });
  }
  const result = await seedDemoDataset();
  return res.json(SeedDemoDataResponse.parse(result));
});

export default router;