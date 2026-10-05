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
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import {
  journeyStatusEnum,
  riskLevelEnum,
  type GeoPoint,
  type LastSafeLocation,
  type RouteSnapshot,
} from "./shared";
import { usersTable } from "./users";

export const journeysTable = pgTable(
  "aurix_journeys",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(),
    vehicleNumber: text("vehicle_number"),
    driverName: text("driver_name"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull().defaultNow(),
    status: journeyStatusEnum("status").notNull().default("planned"),
    expectedRoute: jsonb("expected_route").$type<RouteSnapshot>(),
    currentLocation: jsonb("current_location").$type<GeoPoint>(),
    lastSafeLocation: jsonb("last_safe_location").$type<LastSafeLocation>(),
    lastSafeAt: timestamp("last_safe_at", { withTimezone: true }),
    riskLevel: riskLevelEnum("risk_level").notNull().default("low"),
    shareWithContacts: boolean("share_with_contacts").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("aurix_journeys_owner_status_idx").on(table.userId, table.status),
    index("aurix_journeys_created_idx").on(table.createdAt),
  ],
);

export const insertJourneySchema = createInsertSchema(journeysTable).omit({
  id: true,
  createdAt: true,
});
export type InsertJourney = z.infer<typeof insertJourneySchema>;
export type Journey = typeof journeysTable.$inferSelect;