import type { Response } from "express";

type RuntimeSchema<T> = {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: unknown[] } };
  parse(value: unknown): T;
};

export function readBody<T>(
  schema: RuntimeSchema<T>,
  body: unknown,
  res: Response,
): T | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Request data is invalid.",
      issues: parsed.error.issues,
    });
    return undefined;
  }
  return parsed.data;
}

export function sendParsed<T>(
  res: Response,
  schema: RuntimeSchema<T>,
  body: unknown,
  status = 200,
) {
  return res.status(status).json(schema.parse(body));
}

export function parseId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}