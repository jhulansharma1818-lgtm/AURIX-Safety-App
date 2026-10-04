import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateJourneyBody,
  CreateJourneyResponse,
  GetActiveJourneyResponse,
  UpdateJourneyLocationBody,
  UpdateJourneyLocationParams,
  UpdateJourneyLocationResponse,
  UpdateJourneySharingBody,
  UpdateJourneySharingParams,
  UpdateJourneySharingResponse,
  UpdateJourneyStatusBody,
  UpdateJourneyStatusParams,
  UpdateJourneyStatusResponse,
} from "@workspace/api-zod";
import {
  db,
  emergencyContactsTable,
  journeysTable,
  type Journey,
} from "@workspace/db";
import { requireProfile, requireRole } from "../middlewares/aurix-auth";
import { parseId, readBody, sendParsed } from "../lib/route-utils";

const router: IRouter = Router();
const visibleStatuses = ["planned", "active", "paused"] as const;

function presentJourney(journey: Journey) {
  return {
    id: journey.id,
    userId: journey.userId,
    destination: journey.destination,
    vehicleNumber: journey.vehicleNumber,
    driverName: journey.driverName,
    startTime: journey.startTime.toISOString(),
    status: journey.status,
    expectedRoute: journey.expectedRoute ?? null,
    currentLocation: journey.currentLocation ?? null,
    riskLevel: journey.riskLevel,
    shareWithContacts: journey.shareWithContacts,
    createdAt: journey.createdAt.toISOString(),
  };
}

router.post(
  "/journeys",
  requireProfile,
  requireRole("user"),
  async (req, res) => {
    const input = readBody(CreateJourneyBody, req.body, res);
    if (!input) return;
    const actor = res.locals.aurixActor!;
    const [journey] = await db
      .insert(journeysTable)
      .values({
        userId: actor.user.id,
        destination: input.destination.trim(),
        vehicleNumber: input.vehicleNumber?.trim() || null,
        driverName: input.driverName?.trim() || actor.user.name,
        status: "active",
        expectedRoute: input.expectedRoute,
        currentLocation: input.currentLocation,
        shareWithContacts: input.shareWithContacts ?? false,
      })
      .returning();
    return sendParsed(
      res,
      CreateJourneyResponse,
      presentJourney(journey),
      201,
    );
  },
);

router.get("/journeys/active", requireProfile, async (_req, res) => {
  const actor = res.locals.aurixActor!;
  if (actor.user.role === "user") {
    const [journey] = await db
      .select()
      .from(journeysTable)
      .where(
        and(
          eq(journeysTable.userId, actor.user.id),
          inArray(journeysTable.status, visibleStatuses),
        ),
      )
      .orderBy(desc(journeysTable.createdAt))
      .limit(1);
    return sendParsed(
      res,
      GetActiveJourneyResponse,
      { journey: journey ? presentJourney(journey) : null },
    );
  }

  if (actor.user.role === "emergency_contact") {
    const [link] = await db
      .select({ ownerId: emergencyContactsTable.userId })
      .from(emergencyContactsTable)
      .where(
        and(
          eq(emergencyContactsTable.contactUserId, actor.user.id),
          eq(emergencyContactsTable.verified, true),
        ),
      )
      .limit(1);
    if (!link) {
      return sendParsed(res, GetActiveJourneyResponse, { journey: null });
    }
    const [journey] = await db
      .select()
      .from(journeysTable)
      .where(
        and(
          eq(journeysTable.userId, link.ownerId),
          eq(journeysTable.shareWithContacts, true),
          inArray(journeysTable.status, visibleStatuses),
        ),
      )
      .orderBy(desc(journeysTable.createdAt))
      .limit(1);
    return sendParsed(
      res,
      GetActiveJourneyResponse,
      { journey: journey ? presentJourney(journey) : null },
    );
  }

  return sendParsed(res, GetActiveJourneyResponse, { journey: null });
});

router.patch(
  "/journeys/:journeyId/status",
  requireProfile,
  requireRole("user"),
  async (req, res) => {
    const params = UpdateJourneyStatusParams.safeParse({
      journeyId: parseId(req.params.journeyId),
    });
    if (!params.success) {
      return res.status(400).json({ error: "Journey ID is invalid." });
    }
    const input = readBody(UpdateJourneyStatusBody, req.body, res);
    if (!input) return;
    const actor = res.locals.aurixActor!;
    const [journey] = await db
      .update(journeysTable)
      .set({ status: input.status })
      .where(
        and(
          eq(journeysTable.id, params.data.journeyId),
          eq(journeysTable.userId, actor.user.id),
        ),
      )
      .returning();
    if (!journey) return res.status(404).json({ error: "Journey not found." });
    return sendParsed(
      res,
      UpdateJourneyStatusResponse,
      presentJourney(journey),
    );
  },
);

router.patch(
  "/journeys/:journeyId/location",
  requireProfile,
  requireRole("user"),
  async (req, res) => {
    const params = UpdateJourneyLocationParams.safeParse({
      journeyId: parseId(req.params.journeyId),
    });
    if (!params.success) {
      return res.status(400).json({ error: "Journey ID is invalid." });
    }
    const input = readBody(UpdateJourneyLocationBody, req.body, res);
    if (!input) return;
    const actor = res.locals.aurixActor!;
    const [journey] = await db
      .update(journeysTable)
      .set({ currentLocation: input.location })
      .where(
        and(
          eq(journeysTable.id, params.data.journeyId),
          eq(journeysTable.userId, actor.user.id),
        ),
      )
      .returning();
    if (!journey) return res.status(404).json({ error: "Journey not found." });
    return sendParsed(
      res,
      UpdateJourneyLocationResponse,
      presentJourney(journey),
    );
  },
);

router.patch(
  "/journeys/:journeyId/sharing",
  requireProfile,
  requireRole("user"),
  async (req, res) => {
    const params = UpdateJourneySharingParams.safeParse({
      journeyId: parseId(req.params.journeyId),
    });
    if (!params.success) {
      return res.status(400).json({ error: "Journey ID is invalid." });
    }
    const input = readBody(UpdateJourneySharingBody, req.body, res);
    if (!input) return;
    const actor = res.locals.aurixActor!;
    const [journey] = await db
      .update(journeysTable)
      .set({ shareWithContacts: input.shareWithContacts })
      .where(
        and(
          eq(journeysTable.id, params.data.journeyId),
          eq(journeysTable.userId, actor.user.id),
        ),
      )
      .returning();
    if (!journey) return res.status(404).json({ error: "Journey not found." });
    return sendParsed(
      res,
      UpdateJourneySharingResponse,
      presentJourney(journey),
    );
  },
);

export default router;