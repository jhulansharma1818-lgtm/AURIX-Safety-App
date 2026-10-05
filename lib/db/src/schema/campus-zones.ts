import { createInsertSchema } from "drizzle-zod";
import {
  doublePrecision,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import {
  campusAssistanceEnum,
  campusZoneTypeEnum,
} from "./shared";

export const campusZonesTable = pgTable(
  "aurix_campus_zones",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    campusName: text("campus_name").notNull(),
    name: text("name").notNull(),
    zoneType: campusZoneTypeEnum("zone_type").notNull(),
    assistanceStatus: campusAssistanceEnum("assistance_status")
      .notNull()
      .default("unknown"),
    contextNote: text("context_note").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("aurix_campus_zones_slug_uq").on(table.slug),
    index("aurix_campus_zones_campus_name_idx").on(table.campusName),
  ],
);

export const insertCampusZoneSchema = createInsertSchema(campusZonesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCampusZone = z.infer<typeof insertCampusZoneSchema>;
export type CampusZone = typeof campusZonesTable.$inferSelect;
