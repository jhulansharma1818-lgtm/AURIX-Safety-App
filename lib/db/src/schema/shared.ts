import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("aurix_user_role", [
  "user",
  "emergency_contact",
  "responder",
  "authority",
]);
export const journeyStatusEnum = pgEnum("aurix_journey_status", [
  "planned",
  "active",
  "paused",
  "arrived",
  "cancelled",
]);
export const riskLevelEnum = pgEnum("aurix_risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const incidentTypeEnum = pgEnum("aurix_incident_type", [
  "route_deviation",
  "unexpected_stop",
  "user_request",
  "no_response",
  "manual_report",
]);
export const verificationStatusEnum = pgEnum("aurix_verification_status", [
  "not_started",
  "pending",
  "confirmed_safe",
  "help_requested",
  "no_response",
]);
export const responseStatusEnum = pgEnum("aurix_response_status", [
  "open",
  "verification_pending",
  "responder_assigned",
  "help_reached",
  "resolved",
]);
export const responderAvailabilityEnum = pgEnum("aurix_responder_availability", [
  "available",
  "busy",
  "offline",
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type JourneyStatus = (typeof journeyStatusEnum.enumValues)[number];
export type RiskLevel = (typeof riskLevelEnum.enumValues)[number];
export type IncidentType = (typeof incidentTypeEnum.enumValues)[number];
export type VerificationStatus =
  (typeof verificationStatusEnum.enumValues)[number];
export type ResponseStatus = (typeof responseStatusEnum.enumValues)[number];
export type ResponderAvailability =
  (typeof responderAvailabilityEnum.enumValues)[number];

export type GeoPoint = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type RouteSnapshot = {
  origin: string;
  destination: string;
  points?: GeoPoint[];
};