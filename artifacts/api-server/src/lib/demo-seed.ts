import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  emergencyContactsTable,
  incidentsTable,
  journeysTable,
  respondersTable,
  responseEventsTable,
  usersTable,
} from "@workspace/db";

const demoUsers = [
  {
    role: "user" as const,
    authSubject: "demo:user",
    name: "Avery Lane",
    email: "avery.lane@aurix-demo.invalid",
    phone: "+1-555-0101",
  },
  {
    role: "emergency_contact" as const,
    authSubject: "demo:emergency_contact",
    name: "Jordan Reed",
    email: "jordan.reed@aurix-demo.invalid",
    phone: "+1-555-0102",
  },
  {
    role: "responder" as const,
    authSubject: "demo:responder",
    name: "Morgan Ellis",
    email: "morgan.ellis@aurix-demo.invalid",
    phone: "+1-555-0103",
  },
  {
    role: "authority" as const,
    authSubject: "demo:authority",
    name: "AURIX Demo Authority",
    email: "authority@aurix-demo.invalid",
    phone: null,
  },
];

const demoPoint = {
  latitude: 47.6182,
  longitude: -122.3361,
  label: "Northgate Community Centre · synthetic location",
};

export async function seedDemoDataset() {
  return db.transaction(async (tx) => {
    const profileRows = await Promise.all(
      demoUsers.map(async (demoUser) => {
        const [profile] = await tx
          .insert(usersTable)
          .values(demoUser)
          .onConflictDoUpdate({
            target: usersTable.authSubject,
            set: {
              name: demoUser.name,
              email: demoUser.email,
              phone: demoUser.phone,
              role: demoUser.role,
            },
          })
          .returning();
        return profile;
      }),
    );
    const user = profileRows.find((profile) => profile.authSubject === "demo:user");
    const contact = profileRows.find(
      (profile) => profile.authSubject === "demo:emergency_contact",
    );
    const responderUser = profileRows.find(
      (profile) => profile.authSubject === "demo:responder",
    );
    if (!user || !contact || !responderUser) {
      throw new Error("The synthetic demo profiles could not be created.");
    }

    const [existingContact] = await tx
      .select({ id: emergencyContactsTable.id })
      .from(emergencyContactsTable)
      .where(
        and(
          eq(emergencyContactsTable.userId, user.id),
          eq(emergencyContactsTable.email, contact.email),
        ),
      )
      .limit(1);
    if (!existingContact) {
      await tx.insert(emergencyContactsTable).values({
        userId: user.id,
        contactUserId: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone ?? "+1-555-0102",
        relationship: "Trusted contact",
        verified: true,
      });
    }

    const [responder] = await tx
      .insert(respondersTable)
      .values({
        userId: responderUser.id,
        responderType: "Community safety partner",
        phone: responderUser.phone,
        verified: true,
        availabilityStatus: "available",
        currentLocation: {
          latitude: 47.6164,
          longitude: -122.334,
          label: "Synthetic responder location",
        },
      })
      .onConflictDoUpdate({
        target: respondersTable.userId,
        set: {
          responderType: "Community safety partner",
          phone: responderUser.phone,
          verified: true,
          availabilityStatus: "available",
          currentLocation: {
            latitude: 47.6164,
            longitude: -122.334,
            label: "Synthetic responder location",
          },
        },
      })
      .returning();
    if (!responder) throw new Error("The synthetic responder could not be created.");

    let [journey] = await tx
      .select()
      .from(journeysTable)
      .where(
        and(
          eq(journeysTable.userId, user.id),
          inArray(journeysTable.status, ["planned", "active", "paused"]),
        ),
      )
      .limit(1);
    if (!journey) {
      [journey] = await tx
        .insert(journeysTable)
        .values({
          userId: user.id,
          destination: "Northgate Community Centre",
          driverName: user.name,
          startTime: new Date(),
          status: "active",
          expectedRoute: {
            origin: "Cedar Park Station",
            destination: "Northgate Community Centre",
            points: [
              { latitude: 47.6121, longitude: -122.3414 },
              demoPoint,
            ],
          },
          currentLocation: demoPoint,
          riskLevel: "high",
          shareWithContacts: true,
        })
        .returning();
    }
    if (!journey) throw new Error("The synthetic journey could not be created.");

    const [existingIncident] = await tx
      .select()
      .from(incidentsTable)
      .where(
        and(
          eq(incidentsTable.userId, user.id),
          inArray(incidentsTable.responseStatus, [
            "open",
            "verification_pending",
            "responder_assigned",
            "help_reached",
          ]),
        ),
      )
      .limit(1);
    let incident = existingIncident;
    if (!incident) {
      [incident] = await tx
        .insert(incidentsTable)
        .values({
          userId: user.id,
          journeyId: journey.id,
          incidentType: "route_deviation",
          riskLevel: "high",
          latitude: demoPoint.latitude,
          longitude: demoPoint.longitude,
          verificationStatus: "pending",
          responseStatus: "open",
        })
        .returning();
    }
    if (!incident) throw new Error("The synthetic incident could not be created.");

    const [event] = await tx
      .select({ id: responseEventsTable.id })
      .from(responseEventsTable)
      .where(
        and(
          eq(responseEventsTable.incidentId, incident.id),
          eq(responseEventsTable.eventType, "route_deviation_detected"),
        ),
      )
      .limit(1);
    if (!event) {
      await tx.insert(responseEventsTable).values({
        incidentId: incident.id,
        eventType: "route_deviation_detected",
        actorId: user.id,
        details: { source: "synthetic_demo_seed", signal: "simulated route shift" },
      });
    }

    return {
      seeded: true,
      message: "Synthetic demo data is ready. No live services are connected.",
      users: profileRows.length,
      journeys: 1,
      incidents: 1,
    };
  });
}