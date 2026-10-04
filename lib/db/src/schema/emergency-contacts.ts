import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const emergencyContactsTable = pgTable(
  "aurix_emergency_contacts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    contactUserId: integer("contact_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone").notNull(),
    relationship: text("relationship").notNull(),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("aurix_emergency_contacts_owner_idx").on(table.userId),
    index("aurix_emergency_contacts_link_idx").on(table.contactUserId),
  ],
);

export const emergencyContactRelations = relations(
  emergencyContactsTable,
  ({ one }) => ({
    owner: one(usersTable, {
      fields: [emergencyContactsTable.userId],
      references: [usersTable.id],
      relationName: "contact_owner",
    }),
    contact: one(usersTable, {
      fields: [emergencyContactsTable.contactUserId],
      references: [usersTable.id],
      relationName: "contact_identity",
    }),
  }),
);

export const insertEmergencyContactSchema = createInsertSchema(
  emergencyContactsTable,
).omit({ id: true, createdAt: true });
export type InsertEmergencyContact = z.infer<
  typeof insertEmergencyContactSchema
>;
export type EmergencyContact = typeof emergencyContactsTable.$inferSelect;