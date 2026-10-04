import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  pgTable,
  serial,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import {
  incidentTypeEnum,
  responseStatusEnum,
  riskLevelEnum,
  verificationStatusEnum,
} from "./shared";
import { journeysTable } from "./journeys";
import { respondersTable } from "./responders";
import { usersTable } from "./users";

export const incidentsTable = pgTable(
  "aurix_incidents",
  {
    id: serial("id").primaryKey(),
    journeyId: integer("journey_id").references(() => journeysTable.id, {
      onDelete: "set null",
    }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    assignedResponderId: integer("assigned_responder_id").references(
      () => respondersTable.id,
      { onDelete: "set null" },
    ),
    incidentType: incidentTypeEnum("incident_type").notNull(),
    riskLevel: riskLevelEnum("risk_level").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("not_started"),
    responseStatus: responseStatusEnum("response_status")
      .notNull()
      .default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("aurix_incidents_owner_status_idx").on(table.userId, table.responseStatus),
    index("aurix_incidents_responder_idx").on(table.assignedResponderId),
    index("aurix_incidents_detected_idx").on(table.detectedAt),
  ],
);

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;