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
  "user_feels_unsafe",
  "being_followed",
  "being_surrounded",
  "manual_sos",
  "new_incident",
]);
export const verificationStatusEnum = pgEnum("aurix_verification_status", [
  "not_started",
  "pending",
  "confirmed_safe",
  "help_requested",
  "no_response",
  "reported",
  "under_verification",
  "verified",
  "unconfirmed",
  "resolved",
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
export const incidentContextEnum = pgEnum("aurix_incident_context", [
  "campus",
  "public_space",
]);
export const detectionModeEnum = pgEnum("aurix_detection_mode", [
  "journey_signal",
  "new_incident_no_history",
  "user_safety_request",
  "manual_sos",
  "campus_report",
]);
export const campusZoneTypeEnum = pgEnum("aurix_campus_zone_type", [
  "girls_hostel",
  "academic_block",
  "parking_area",
  "campus_gate",
  "isolated_pathway",
  "construction_zone",
  "common_area",
  "other",
]);
export const campusAssistanceEnum = pgEnum("aurix_campus_assistance", [
  "available",
  "limited",
  "unknown",
]);
export const campusReportTypeEnum = pgEnum("aurix_campus_report_type", [
  "safety_concern",
  "suspicious_activity",
  "harassment_concern",
  "unsafe_area",
  "infrastructure_safety",
  "other",
]);
export const campusReportStatusEnum = pgEnum("aurix_campus_report_status", [
  "reported",
  "under_verification",
  "verified",
  "unconfirmed",
  "resolved",
]);
export const evidenceTypeEnum = pgEnum("aurix_evidence_type", [
  "photo",
  "video",
  "audio",
  "description",
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
export type IncidentContext = (typeof incidentContextEnum.enumValues)[number];
export type DetectionMode = (typeof detectionModeEnum.enumValues)[number];
export type CampusZoneType = (typeof campusZoneTypeEnum.enumValues)[number];
export type CampusAssistance =
  (typeof campusAssistanceEnum.enumValues)[number];
export type CampusReportType =
  (typeof campusReportTypeEnum.enumValues)[number];
export type CampusReportStatus =
  (typeof campusReportStatusEnum.enumValues)[number];
export type EvidenceType = (typeof evidenceTypeEnum.enumValues)[number];
export const riskSignalCodes = [
  "route_deviation",
  "unexpected_stop",
  "contextual_location",
  "safety_request",
  "manual_sos",
  "no_response",
  "multiple_requests",
  "unusual_journey",
] as const;
export type RiskSignalCode = (typeof riskSignalCodes)[number];

export type GeoPoint = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type LastSafeLocation = GeoPoint & {
  recordedAt: string;
  journeyId: number;
};

export type RiskSignal = {
  code: string;
  label: string;
  points: number;
};

export type RouteSnapshot = {
  origin: string;
  destination: string;
  points?: GeoPoint[];
};