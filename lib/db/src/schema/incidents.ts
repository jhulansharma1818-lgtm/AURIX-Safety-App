import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  pgTable,
  serial,
  doublePrecision,
  boolean,
  jsonb,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import {
  incidentTypeEnum,
  incidentContextEnum,
  detectionModeEnum,
  responseStatusEnum,
  riskLevelEnum,
  verificationStatusEnum,
  type LastSafeLocation,
  type RiskSignal,
} from "./shared";
import { journeysTable } from "./journeys";
import { respondersTable } from "./responders";
import { usersTable } from "./users";
import { campusZonesTable } from "./campus-zones";

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
    riskScore: integer("risk_score").notNull().default(0),
    riskSignals: jsonb("risk_signals").$type<RiskSignal[]>().notNull().default([]),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    locationLabel: text("location_label"),
    contextType: incidentContextEnum("context_type").notNull().default("public_space"),
    campusZoneId: integer("campus_zone_id").references(() => campusZonesTable.id, {
      onDelete: "set null",
    }),
    detectionMode: detectionModeEnum("detection_mode").notNull().default("journey_signal"),
    historicalReportsAvailable: boolean("historical_reports_available"),
    lastSafeLocation: jsonb("last_safe_location").$type<LastSafeLocation>(),
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