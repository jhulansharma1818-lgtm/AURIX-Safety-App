import { and, eq } from "drizzle-orm";
import {
  db,
  emergencyContactsTable,
  journeysTable,
  respondersTable,
  type Incident,
} from "@workspace/db";
import type { ActorContext } from "../middlewares/aurix-auth";

export async function getContactJourneyAccess(
  userId: number,
  incident: Incident,
) {
  if (!incident.journeyId) return null;
  const [contactLink] = await db
    .select({ ownerId: emergencyContactsTable.userId })
    .from(emergencyContactsTable)
    .where(
      and(
        eq(emergencyContactsTable.contactUserId, userId),
        eq(emergencyContactsTable.verified, true),
        eq(emergencyContactsTable.userId, incident.userId),
      ),
    )
    .limit(1);
  if (!contactLink) return null;

  const [journey] = await db
    .select()
    .from(journeysTable)
    .where(
      and(
        eq(journeysTable.id, incident.journeyId),
        eq(journeysTable.userId, incident.userId),
        eq(journeysTable.shareWithContacts, true),
      ),
    )
    .limit(1);
  return journey ? { journey, ownerId: contactLink.ownerId } : null;
}

export async function getIncidentAccess(
  actor: ActorContext,
  incident: Incident,
): Promise<"owner" | "contact" | "authority" | "responder" | null> {
  if (actor.user.role === "authority") return "authority";
  if (actor.user.role === "user" && actor.user.id === incident.userId) {
    return "owner";
  }
  if (actor.user.role === "emergency_contact") {
    const contactAccess = await getContactJourneyAccess(actor.user.id, incident);
    if (contactAccess) return "contact";
  }
  if (actor.user.role === "responder") {
    const [responder] = await db
      .select({ id: respondersTable.id })
      .from(respondersTable)
      .where(
        and(
          eq(respondersTable.userId, actor.user.id),
          eq(respondersTable.verified, true),
          eq(respondersTable.id, incident.assignedResponderId ?? -1),
        ),
      )
      .limit(1);
    if (responder) return "responder";
  }
  return null;
}

export async function getVerifiedResponder(userId: number) {
  const [responder] = await db
    .select()
    .from(respondersTable)
    .where(
      and(
        eq(respondersTable.userId, userId),
        eq(respondersTable.verified, true),
      ),
    )
    .limit(1);
  return responder ?? null;
}