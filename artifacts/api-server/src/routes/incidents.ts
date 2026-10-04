import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  or,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AcceptIncidentParams,
  AcceptIncidentResponse,
  CreateIncidentBody,
  CreateIncidentResponse,
  CreateResponseEventBody,
  CreateResponseEventParams,
  CreateResponseEventResponse,
  GetActiveIncidentsResponse,
  ResolveIncidentBody,
  ResolveIncidentParams,
  ResolveIncidentResponse,
} from "@workspace/api-zod";
import {
  db,
  emergencyContactsTable,
  incidentsTable,
  journeysTable,
  respondersTable,
  responseEventsTable,
  usersTable,
  type Incident,
} from "@workspace/db";
import {
  getContactJourneyAccess,
  getIncidentAccess,
  getVerifiedResponder,
} from "../lib/incident-access";
import { parseId, readBody, sendParsed } from "../lib/route-utils";
import { requireProfile, requireRole, type ActorContext } from "../middlewares/aurix-auth";

const router: IRouter = Router();
const activeStates = [
  "open",
  "verification_pending",
  "responder_assigned",
  "help_reached",
] as const;
const userEventTypes = new Set([
  "route_deviation_detected",
  "unexpected_stop_detected",
  "verification_requested",
  "user_confirmed_safe",
  "user_requested_help",
  "status_updated",
]);
const responderEventTypes = new Set(["help_reached", "status_updated"]);

async function presentIncident(
  incident: Incident,
  actor: ActorContext,
  allowUnassignedResponder = false,
) {
  let access = await getIncidentAccess(actor, incident);
  if (
    !access &&
    allowUnassignedResponder &&
    actor.user.role === "responder" &&
    incident.assignedResponderId === null &&
    activeStates.includes(incident.responseStatus as (typeof activeStates)[number])
  ) {
    const responder = await getVerifiedResponder(actor.user.id);
    if (responder) access = "responder";
  }
  if (!access) return null;

  const [journey] = incident.journeyId
    ? await db
        .select()
        .from(journeysTable)
        .where(eq(journeysTable.id, incident.journeyId))
        .limit(1)
    : [];
  const events = await db
    .select()
    .from(responseEventsTable)
    .where(eq(responseEventsTable.incidentId, incident.id))
    .orderBy(responseEventsTable.timestamp);

  let victim: { name: string; phone: string | null } | null = null;
  if (access !== "responder") {
    const [user] = await db
      .select({ name: usersTable.name, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, incident.userId))
      .limit(1);
    if (user) victim = user;
  }

  return {
    id: incident.id,
    journeyId: access === "responder" ? null : incident.journeyId,
    incidentType: incident.incidentType,
    riskLevel: incident.riskLevel,
    latitude: incident.latitude,
    longitude: incident.longitude,
    detectedAt: incident.detectedAt.toISOString(),
    verificationStatus: incident.verificationStatus,
    responseStatus: incident.responseStatus,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    destination:
      access === "responder" ? null : journey?.destination ?? null,
    victim,
    events: events.map((event) => ({
      id: event.id,
      incidentId: event.incidentId,
      eventType: event.eventType,
      actorId: access === "responder" ? null : event.actorId,
      timestamp: event.timestamp.toISOString(),
      details: access === "responder" ? {} : event.details,
    })),
  };
}

async function findIncident(incidentId: number) {
  const [incident] = await db
    .select()
    .from(incidentsTable)
    .where(eq(incidentsTable.id, incidentId))
    .limit(1);
  return incident ?? null;
}

async function canWriteEvent(
  actor: ActorContext,
  incident: Incident,
  eventType: string,
) {
  const access = await getIncidentAccess(actor, incident);
  if (!access) return false;
  if (access === "contact") return eventType === "contact_acknowledged";
  if (access === "responder") return responderEventTypes.has(eventType);
  if (access === "owner") return userEventTypes.has(eventType);
  return eventType !== "incident_resolved" && eventType !== "responder_accepted";
}

router.post(
  "/incidents",
  requireProfile,
  requireRole("user"),
  async (req, res) => {
    const input = readBody(CreateIncidentBody, req.body, res);
    if (!input) return;
    const actor = res.locals.aurixActor!;

    if (input.journeyId) {
      const [journey] = await db
        .select({ id: journeysTable.id })
        .from(journeysTable)
        .where(
          and(
            eq(journeysTable.id, input.journeyId),
            eq(journeysTable.userId, actor.user.id),
            inArray(journeysTable.status, ["planned", "active", "paused"]),
          ),
        )
        .limit(1);
      if (!journey) {
        return res.status(400).json({
          error: "The journey is missing or does not belong to this account.",
        });
      }
    }

    const responseStatus =
      input.verificationStatus === "help_requested" ||
      input.verificationStatus === "no_response"
        ? "verification_pending"
        : "open";
    const incident = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(incidentsTable)
        .values({
          userId: actor.user.id,
          journeyId: input.journeyId ?? null,
          incidentType: input.incidentType,
          riskLevel: input.riskLevel,
          latitude: input.latitude,
          longitude: input.longitude,
          verificationStatus: input.verificationStatus,
          responseStatus,
        })
        .returning();

      const eventType =
        input.incidentType === "route_deviation"
          ? "route_deviation_detected"
          : input.incidentType === "unexpected_stop"
            ? "unexpected_stop_detected"
            : input.incidentType === "user_request"
              ? "user_requested_help"
              : "verification_requested";
      await tx.insert(responseEventsTable).values({
        incidentId: created.id,
        eventType,
        actorId: actor.user.id,
        details: { source: "simulated_app_flow" },
      });

      if (input.journeyId) {
        await tx
          .update(journeysTable)
          .set({ riskLevel: input.riskLevel })
          .where(
            and(
              eq(journeysTable.id, input.journeyId),
              eq(journeysTable.userId, actor.user.id),
            ),
          );
      }
      return created;
    });
    const view = await presentIncident(incident, actor);
    return sendParsed(res, CreateIncidentResponse, view, 201);
  },
);

router.get("/incidents/active", requireProfile, async (_req, res) => {
  const actor = res.locals.aurixActor!;
  let incidents: Incident[] = [];

  if (actor.user.role === "authority") {
    incidents = await db
      .select()
      .from(incidentsTable)
      .where(inArray(incidentsTable.responseStatus, activeStates))
      .orderBy(desc(incidentsTable.detectedAt));
  } else if (actor.user.role === "user") {
    incidents = await db
      .select()
      .from(incidentsTable)
      .where(
        and(
          eq(incidentsTable.userId, actor.user.id),
          inArray(incidentsTable.responseStatus, activeStates),
        ),
      )
      .orderBy(desc(incidentsTable.detectedAt));
  } else if (actor.user.role === "emergency_contact") {
    const links = await db
      .select({ ownerId: emergencyContactsTable.userId })
      .from(emergencyContactsTable)
      .where(
        and(
          eq(emergencyContactsTable.contactUserId, actor.user.id),
          eq(emergencyContactsTable.verified, true),
        ),
      );
    const ownerIds = [...new Set(links.map((link) => link.ownerId))];
    if (ownerIds.length) {
      incidents = await db
        .selectDistinct({ incident: incidentsTable })
        .from(incidentsTable)
        .innerJoin(
          journeysTable,
          eq(journeysTable.id, incidentsTable.journeyId),
        )
        .where(
          and(
            inArray(incidentsTable.userId, ownerIds),
            inArray(incidentsTable.responseStatus, activeStates),
            eq(journeysTable.shareWithContacts, true),
          ),
        )
        .orderBy(desc(incidentsTable.detectedAt))
        .then((rows) => rows.map((row) => row.incident));
    }
  } else if (actor.user.role === "responder") {
    const responder = await getVerifiedResponder(actor.user.id);
    if (!responder) {
      return res.status(403).json({
        error: "A verified responder profile is required.",
      });
    }
    incidents = await db
      .select()
      .from(incidentsTable)
      .where(
        and(
          inArray(incidentsTable.responseStatus, activeStates),
          or(
            eq(incidentsTable.assignedResponderId, responder.id),
            and(
              isNull(incidentsTable.assignedResponderId),
              inArray(incidentsTable.responseStatus, [
                "open",
                "verification_pending",
              ]),
            ),
          ),
        ),
      )
      .orderBy(desc(incidentsTable.detectedAt));
  }

  const views = (
    await Promise.all(
      incidents.map((incident) =>
        presentIncident(
          incident,
          actor,
          actor.user.role === "responder" &&
            incident.assignedResponderId === null,
        ),
      ),
    )
  ).filter((incident) => incident !== null);
  return sendParsed(
    res,
    GetActiveIncidentsResponse,
    { incidents: views },
  );
});

router.post(
  "/incidents/:incidentId/accept",
  requireProfile,
  requireRole("responder"),
  async (req, res) => {
    const params = AcceptIncidentParams.safeParse({
      incidentId: parseId(req.params.incidentId),
    });
    if (!params.success) {
      return res.status(400).json({ error: "Incident ID is invalid." });
    }
    const actor = res.locals.aurixActor!;
    const responder = await getVerifiedResponder(actor.user.id);
    if (!responder || responder.availabilityStatus !== "available") {
      return res.status(403).json({
        error: "A verified responder marked available is required.",
      });
    }

    const incident = await db.transaction(async (tx) => {
      const [assigned] = await tx
        .update(incidentsTable)
        .set({
          assignedResponderId: responder.id,
          responseStatus: "responder_assigned",
        })
        .where(
          and(
            eq(incidentsTable.id, params.data.incidentId),
            isNull(incidentsTable.assignedResponderId),
            inArray(incidentsTable.responseStatus, [
              "open",
              "verification_pending",
            ]),
          ),
        )
        .returning();
      if (!assigned) return null;

      await tx
        .update(respondersTable)
        .set({ availabilityStatus: "busy" })
        .where(eq(respondersTable.id, responder.id));
      await tx.insert(responseEventsTable).values({
        incidentId: assigned.id,
        eventType: "responder_accepted",
        actorId: actor.user.id,
        details: { responderType: responder.responderType },
      });
      return assigned;
    });
    if (!incident) {
      return res.status(409).json({
        error: "This incident is no longer available to accept.",
      });
    }
    const view = await presentIncident(incident, actor);
    return sendParsed(res, AcceptIncidentResponse, view);
  },
);

router.post(
  "/incidents/:incidentId/events",
  requireProfile,
  async (req, res) => {
    const params = CreateResponseEventParams.safeParse({
      incidentId: parseId(req.params.incidentId),
    });
    if (!params.success) {
      return res.status(400).json({ error: "Incident ID is invalid." });
    }
    const input = readBody(CreateResponseEventBody, req.body, res);
    if (!input) return;
    if (JSON.stringify(input.details ?? {}).length > 4096) {
      return res.status(400).json({ error: "Event details are too large." });
    }

    const actor = res.locals.aurixActor!;
    const incident = await findIncident(params.data.incidentId);
    if (!incident || !(await canWriteEvent(actor, incident, input.eventType))) {
      return res.status(404).json({
        error: "The incident is unavailable to this account.",
      });
    }

    const event = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(responseEventsTable)
        .values({
          incidentId: incident.id,
          eventType: input.eventType,
          actorId: actor.user.id,
          details: input.details ?? {},
        })
        .returning();

      if (input.eventType === "verification_requested") {
        await tx
          .update(incidentsTable)
          .set({
            verificationStatus: "pending",
            responseStatus: "verification_pending",
          })
          .where(eq(incidentsTable.id, incident.id));
      } else if (input.eventType === "user_requested_help") {
        await tx
          .update(incidentsTable)
          .set({
            verificationStatus: "help_requested",
            responseStatus: "verification_pending",
          })
          .where(eq(incidentsTable.id, incident.id));
      } else if (input.eventType === "user_confirmed_safe") {
        await tx
          .update(incidentsTable)
          .set({
            verificationStatus: "confirmed_safe",
            responseStatus: "resolved",
            resolvedAt: new Date(),
          })
          .where(eq(incidentsTable.id, incident.id));
      } else if (input.eventType === "help_reached") {
        await tx
          .update(incidentsTable)
          .set({ responseStatus: "help_reached" })
          .where(eq(incidentsTable.id, incident.id));
      }
      return created;
    });
    return sendParsed(
      res,
      CreateResponseEventResponse,
      {
        id: event.id,
        incidentId: event.incidentId,
        eventType: event.eventType,
        actorId: event.actorId,
        timestamp: event.timestamp.toISOString(),
        details: event.details,
      },
      201,
    );
  },
);

router.post(
  "/incidents/:incidentId/resolve",
  requireProfile,
  async (req, res) => {
    const params = ResolveIncidentParams.safeParse({
      incidentId: parseId(req.params.incidentId),
    });
    if (!params.success) {
      return res.status(400).json({ error: "Incident ID is invalid." });
    }
    const input = readBody(ResolveIncidentBody, req.body ?? {}, res);
    if (!input) return;
    if (JSON.stringify(input.details ?? {}).length > 4096) {
      return res.status(400).json({ error: "Resolution details are too large." });
    }

    const actor = res.locals.aurixActor!;
    const incident = await findIncident(params.data.incidentId);
    if (!incident) return res.status(404).json({ error: "Incident not found." });
    const access = await getIncidentAccess(actor, incident);
    if (
      !access ||
      access === "contact" ||
      (access === "responder" && incident.assignedResponderId == null)
    ) {
      return res.status(404).json({
        error: "The incident is unavailable to this account.",
      });
    }

    const resolved = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(incidentsTable)
        .set({ responseStatus: "resolved", resolvedAt: new Date() })
        .where(
          and(
            eq(incidentsTable.id, incident.id),
            inArray(incidentsTable.responseStatus, activeStates),
          ),
        )
        .returning();
      if (!updated) return null;
      await tx.insert(responseEventsTable).values({
        incidentId: incident.id,
        eventType: "incident_resolved",
        actorId: actor.user.id,
        details: input.details ?? {},
      });
      if (incident.assignedResponderId) {
        await tx
          .update(respondersTable)
          .set({ availabilityStatus: "available" })
          .where(eq(respondersTable.id, incident.assignedResponderId));
      }
      return updated;
    });
    if (!resolved) {
      return res.status(409).json({ error: "The incident is already resolved." });
    }
    const view = await presentIncident(resolved, actor);
    return sendParsed(res, ResolveIncidentResponse, view);
  },
);

export default router;