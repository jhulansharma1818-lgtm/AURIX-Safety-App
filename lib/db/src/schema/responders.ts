import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { responderAvailabilityEnum, type GeoPoint } from "./shared";
import { usersTable } from "./users";

export const respondersTable = pgTable(
  "aurix_responders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    responderType: text("responder_type").notNull(),
    phone: text("phone"),
    verified: boolean("verified").notNull().default(false),
    availabilityStatus: responderAvailabilityEnum("availability_status")
      .notNull()
      .default("offline"),
    currentLocation: jsonb("current_location").$type<GeoPoint>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("aurix_responders_user_uq").on(table.userId),
    index("aurix_responders_availability_idx").on(table.availabilityStatus),
  ],
);

export const insertResponderSchema = createInsertSchema(respondersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertResponder = z.infer<typeof insertResponderSchema>;
export type Responder = typeof respondersTable.$inferSelect;