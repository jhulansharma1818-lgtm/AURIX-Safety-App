import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
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
import { incidentsTable } from "./incidents";
import { usersTable } from "./users";

export const responseEventsTable = pgTable(
  "aurix_response_events",
  {
    id: serial("id").primaryKey(),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidentsTable.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorId: integer("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("aurix_response_events_incident_time_idx").on(
      table.incidentId,
      table.timestamp,
    ),
  ],
);

export const responseEventRelations = relations(
  responseEventsTable,
  ({ one }) => ({
    incident: one(incidentsTable, {
      fields: [responseEventsTable.incidentId],
      references: [incidentsTable.id],
    }),
    actor: one(usersTable, {
      fields: [responseEventsTable.actorId],
      references: [usersTable.id],
    }),
  }),
);

export const insertResponseEventSchema = createInsertSchema(
  responseEventsTable,
).omit({ id: true, timestamp: true });
export type InsertResponseEvent = z.infer<typeof insertResponseEventSchema>;
export type ResponseEvent = typeof responseEventsTable.$inferSelect;