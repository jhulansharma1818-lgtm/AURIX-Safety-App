import { clerkClient, getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  db,
  emergencyContactsTable,
  usersTable,
  type User,
  type UserRole,
} from "@workspace/db";

export type ActorContext = {
  user: User;
  demoMode: boolean;
};

declare global {
  namespace Express {
    interface Locals {
      aurixActor?: ActorContext;
    }
  }
}

const userRoles = new Set<UserRole>([
  "user",
  "emergency_contact",
  "responder",
  "authority",
]);

function normalizedAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function findActor(
  req: Request,
): Promise<ActorContext | null> {
  const demoRoleHeader = req.get("x-aurix-demo-role");
  if (process.env.NODE_ENV === "development" && demoRoleHeader) {
    if (!userRoles.has(demoRoleHeader as UserRole)) return null;
    const [demoUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.authSubject, `demo:${demoRoleHeader}`))
      .limit(1);
    if (demoUser) return { user: demoUser, demoMode: true };
    return null;
  }

  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) return null;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.authSubject, clerkUserId))
    .limit(1);
  return user ? { user, demoMode: false } : null;
}

export const requireProfile: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor = await findActor(req);
    if (actor) {
      res.locals.aurixActor = actor;
      next();
      return;
    }

    const hasClerkSession = Boolean(getAuth(req).userId);
    if (hasClerkSession) {
      res.status(403).json({
        error: "Complete profile registration before using this endpoint.",
      });
      return;
    }
    res.status(401).json({ error: "Authentication is required." });
  } catch (error) {
    next(error);
  }
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (_req, res, next) => {
    const actor = res.locals.aurixActor;
    if (!actor) {
      res.status(401).json({ error: "Authentication is required." });
      return;
    }
    if (!roles.includes(actor.user.role)) {
      res.status(403).json({ error: "This account cannot perform that action." });
      return;
    }
    next();
  };
}

export async function registerClerkProfile(input: {
  clerkUserId: string;
  name: string;
  phone?: string | null;
}) {
  const identity = await clerkClient.users.getUser(input.clerkUserId);
  const primaryEmail = identity.emailAddresses.find(
    (email) => email.id === identity.primaryEmailAddressId,
  );
  const email = primaryEmail?.emailAddress.trim().toLowerCase();
  if (!email || primaryEmail?.verification?.status !== "verified") {
    throw new Error("A verified primary email address is required.");
  }

  const authorityEmails = normalizedAllowlist(
    process.env.AURIX_AUTHORITY_EMAILS,
  );
  const responderEmails = normalizedAllowlist(
    process.env.AURIX_RESPONDER_EMAILS,
  );
  const [matchingInvite] = await db
    .select({ id: emergencyContactsTable.id })
    .from(emergencyContactsTable)
    .where(eq(emergencyContactsTable.email, email))
    .limit(1);

  const role: UserRole = authorityEmails.has(email)
    ? "authority"
    : responderEmails.has(email)
      ? "responder"
      : matchingInvite
        ? "emergency_contact"
        : "user";

  return db.transaction(async (tx) => {
    const [profile] = await tx
      .insert(usersTable)
      .values({
        authSubject: input.clerkUserId,
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
        role,
      })
      .onConflictDoUpdate({
        target: usersTable.authSubject,
        set: {
          name: input.name.trim(),
          email,
          phone: input.phone?.trim() || null,
          role,
        },
      })
      .returning();

    if (!profile) throw new Error("AURIX profile could not be saved.");

    if (role === "emergency_contact") {
      await tx
        .update(emergencyContactsTable)
        .set({ contactUserId: profile.id, verified: true })
        .where(
          and(
            eq(emergencyContactsTable.email, email),
            eq(emergencyContactsTable.verified, false),
          ),
        );
    }
    return profile;
  });
}