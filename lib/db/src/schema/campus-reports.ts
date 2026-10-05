import { createInsertSchema } from "drizzle-zod";
import {
  campusReportStatusEnum,
  campusReportTypeEnum,
} from "./shared";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { campusZonesTable } from "./campus-zones";
import { usersTable } from "./users";

export const campusReportsTable = pgTable(
  "aurix_campus_reports",
  {
    id: serial("id").primaryKey(),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    campusZoneId: integer("campus_zone_id").references(
      () => campusZonesTable.id,
      { onDelete: "set null" },
    ),
    reportType: campusReportTypeEnum("report_type").notNull(),
    details: text("details").notNull(),
    locationNote: text("location_note"),
    status: campusReportStatusEnum("status")
      .notNull()
      .default("reported"),
    reviewNote: text("review_note"),
    reviewedBy: integer("reviewed_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("aurix_campus_reports_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("aurix_campus_reports_reporter_idx").on(table.reporterId),
    index("aurix_campus_reports_zone_idx").on(table.campusZoneId),
  ],
);

export const insertCampusReportSchema = createInsertSchema(
  campusReportsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: true,
  reviewedAt: true,
});
export type InsertCampusReport = z.infer<typeof insertCampusReportSchema>;
export type CampusReport = typeof campusReportsTable.$inferSelect;
