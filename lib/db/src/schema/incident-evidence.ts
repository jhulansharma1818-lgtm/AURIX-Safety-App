import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { evidenceTypeEnum, type GeoPoint } from "./shared";
import { incidentsTable } from "./incidents";
import { usersTable } from "./users";

export const incidentEvidenceTable = pgTable(
  "aurix_incident_evidence",
  {
    id: serial("id").primaryKey(),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidentsTable.id, { onDelete: "cascade" }),
    submittedBy: integer("submitted_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    evidenceType: evidenceTypeEnum("evidence_type").notNull(),
    description: text("description").notNull(),
    fileLabel: text("file_label"),
    location: jsonb("location").$type<GeoPoint>(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("aurix_incident_evidence_incident_idx").on(table.incidentId),
    index("aurix_incident_evidence_submitter_idx").on(table.submittedBy),
  ],
);

export const insertIncidentEvidenceSchema = createInsertSchema(
  incidentEvidenceTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertIncidentEvidence = z.infer<typeof insertIncidentEvidenceSchema>;
export type IncidentEvidence = typeof incidentEvidenceTable.$inferSelect;
