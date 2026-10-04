import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetAvailableRespondersResponse,
  RegisterResponderBody,
  RegisterResponderResponse,
  UpdateResponderStatusBody,
  UpdateResponderStatusResponse,
} from "@workspace/api-zod";
import { db, respondersTable } from "@workspace/db";
import { requireProfile, requireRole } from "../middlewares/aurix-auth";
import { getVerifiedResponder } from "../lib/incident-access";
import { readBody, sendParsed } from "../lib/route-utils";

const router: IRouter = Router();

function presentResponder(responder: typeof respondersTable.$inferSelect) {
  return {
    id: responder.id,
    userId: responder.userId,
    responderType: responder.responderType,
    phone: responder.phone,
    verified: responder.verified,
    availabilityStatus: responder.availabilityStatus,
    currentLocation: responder.currentLocation ?? null,
    createdAt: responder.createdAt.toISOString(),
  };
}

router.post(
  "/responders",
  requireProfile,
  requireRole("responder"),
  async (req, res) => {
    const input = readBody(RegisterResponderBody, req.body, res);
    if (!input) return;
    const actor = res.locals.aurixActor!;
    const [responder] = await db
      .insert(respondersTable)
      .values({
        userId: actor.user.id,
        responderType: input.responderType.trim(),
        phone: input.phone?.trim() || actor.user.phone,
        verified: true,
        availabilityStatus: "available",
        currentLocation: input.currentLocation,
      })
      .onConflictDoUpdate({
        target: respondersTable.userId,
        set: {
          responderType: input.responderType.trim(),
          phone: input.phone?.trim() || actor.user.phone,
          verified: true,
          currentLocation: input.currentLocation,
        },
      })
      .returning();
    return sendParsed(
      res,
      RegisterResponderResponse,
      presentResponder(responder),
    );
  },
);

router.get(
  "/responders/available",
  requireProfile,
  async (_req, res) => {
    const actor = res.locals.aurixActor!;
    const responders = await db
      .select()
      .from(respondersTable)
      .where(
        and(
          eq(respondersTable.verified, true),
          eq(respondersTable.availabilityStatus, "available"),
        ),
      );
    const authorityView = actor.user.role === "authority";
    return sendParsed(
      res,
      GetAvailableRespondersResponse,
      {
        responders: responders.map((responder) => ({
          id: responder.id,
          responderType: responder.responderType,
          availabilityStatus: responder.availabilityStatus,
          currentLocation: authorityView
            ? responder.currentLocation ?? null
            : null,
        })),
      },
    );
  },
);

router.patch(
  "/responders/status",
  requireProfile,
  requireRole("responder"),
  async (req, res) => {
    const input = readBody(UpdateResponderStatusBody, req.body, res);
    if (!input) return;
    const actor = res.locals.aurixActor!;
    const responder = await getVerifiedResponder(actor.user.id);
    if (!responder) {
      return res.status(403).json({
        error: "A verified responder profile is required.",
      });
    }
    const [updated] = await db
      .update(respondersTable)
      .set({ availabilityStatus: input.availabilityStatus })
      .where(
        and(
          eq(respondersTable.id, responder.id),
          eq(respondersTable.userId, actor.user.id),
        ),
      )
      .returning();
    return sendParsed(
      res,
      UpdateResponderStatusResponse,
      presentResponder(updated),
    );
  },
);

export default router;