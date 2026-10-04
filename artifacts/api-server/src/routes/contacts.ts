import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateEmergencyContactBody,
  CreateEmergencyContactResponse,
  GetEmergencyContactsResponse,
} from "@workspace/api-zod";
import { db, emergencyContactsTable } from "@workspace/db";
import { requireProfile, requireRole } from "../middlewares/aurix-auth";
import { readBody, sendParsed } from "../lib/route-utils";

const router: IRouter = Router();

function presentContact(contact: typeof emergencyContactsTable.$inferSelect) {
  return {
    id: contact.id,
    userId: contact.userId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    relationship: contact.relationship,
    verified: contact.verified,
    createdAt: contact.createdAt.toISOString(),
  };
}

router.get(
  "/emergency-contacts",
  requireProfile,
  requireRole("user"),
  async (_req, res) => {
    const actor = res.locals.aurixActor!;
    const contacts = await db
      .select()
      .from(emergencyContactsTable)
      .where(eq(emergencyContactsTable.userId, actor.user.id));
    return sendParsed(
      res,
      GetEmergencyContactsResponse,
      { contacts: contacts.map(presentContact) },
    );
  },
);

router.post(
  "/emergency-contacts",
  requireProfile,
  requireRole("user"),
  async (req, res) => {
    const input = readBody(CreateEmergencyContactBody, req.body, res);
    if (!input) return;
    const actor = res.locals.aurixActor!;
    const email = input.email.trim().toLowerCase();
    if (email === actor.user.email.toLowerCase()) {
      return res.status(400).json({
        error: "A trusted contact must use a different account email.",
      });
    }
    const [duplicate] = await db
      .select({ id: emergencyContactsTable.id })
      .from(emergencyContactsTable)
      .where(
        and(
          eq(emergencyContactsTable.userId, actor.user.id),
          eq(emergencyContactsTable.email, email),
        ),
      )
      .limit(1);
    if (duplicate) {
      return res.status(409).json({
        error: "That email is already listed as a trusted contact.",
      });
    }
    const [contact] = await db
      .insert(emergencyContactsTable)
      .values({
        userId: actor.user.id,
        name: input.name.trim(),
        email,
        phone: input.phone.trim(),
        relationship: input.relationship.trim(),
        verified: false,
      })
      .returning();
    return sendParsed(
      res,
      CreateEmergencyContactResponse,
      presentContact(contact),
      201,
    );
  },
);

export default router;