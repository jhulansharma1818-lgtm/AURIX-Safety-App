import type {
  IncidentContext,
  IncidentType,
  RiskLevel,
  RiskSignal,
  RiskSignalCode,
} from "@workspace/db";

const signalDefinitions: Record<
  RiskSignalCode,
  { label: string; points: number }
> = {
  route_deviation: { label: "Route deviation", points: 25 },
  unexpected_stop: { label: "Unexpected prolonged stop", points: 20 },
  contextual_location: { label: "Contextual location information", points: 15 },
  safety_request: { label: "User safety request", points: 40 },
  manual_sos: { label: "Manual SOS", points: 100 },
  no_response: { label: "No response to verification", points: 25 },
  multiple_requests: { label: "Multiple simultaneous safety requests", points: 20 },
  unusual_journey: { label: "Unusual journey behavior", points: 20 },
};

function defaultSignalsForIncident(
  incidentType: IncidentType,
): RiskSignalCode[] {
  switch (incidentType) {
    case "route_deviation":
      return ["route_deviation"];
    case "unexpected_stop":
      return ["unexpected_stop"];
    case "no_response":
      return ["no_response"];
    case "user_feels_unsafe":
    case "being_followed":
      return ["safety_request"];
    case "being_surrounded":
      return ["safety_request", "multiple_requests"];
    case "manual_sos":
      return ["manual_sos"];
    case "new_incident":
      return ["unexpected_stop", "no_response", "unusual_journey"];
    case "manual_report":
    case "user_request":
    default:
      return ["safety_request"];
  }
}

export function assessRisk(input: {
  incidentType: IncidentType;
  contextType: IncidentContext;
  signals?: RiskSignalCode[];
  zoneNeedsContext?: boolean;
  requestedRiskLevel?: RiskLevel;
}) {
  const signalCodes = new Set(
    input.signals?.length
      ? input.signals
      : defaultSignalsForIncident(input.incidentType),
  );
  if (input.zoneNeedsContext) signalCodes.add("contextual_location");

  const signals: RiskSignal[] = [...signalCodes].map((code) => ({
    code,
    ...signalDefinitions[code],
  }));
  let score = signals.some((signal) => signal.code === "manual_sos")
    ? 100
    : Math.min(
        100,
        signals.reduce((sum, signal) => sum + signal.points, 0),
      );

  // Preserve the former demo-only risk input for generic reports; safety actions
  // and journey signals always use the server's explainable score.
  if (
    input.incidentType === "manual_report" &&
    input.requestedRiskLevel &&
    signals.length === 0
  ) {
    score =
      input.requestedRiskLevel === "critical"
        ? 85
        : input.requestedRiskLevel === "high"
          ? 55
          : input.requestedRiskLevel === "medium"
            ? 30
            : 10;
  }

  const riskLevel: RiskLevel =
    score >= 70 ? "critical" : score >= 40 ? "high" : score >= 20 ? "medium" : "low";

  return { riskScore: score, riskLevel, riskSignals: signals };
}

export function defaultDetectionMode(input: {
  incidentType: IncidentType;
  requestedMode?: "journey_signal" | "new_incident_no_history" | "user_safety_request" | "manual_sos" | "campus_report";
}) {
  if (input.requestedMode) return input.requestedMode;
  if (input.incidentType === "manual_sos") return "manual_sos" as const;
  if (input.incidentType === "new_incident") return "new_incident_no_history" as const;
  if (
    input.incidentType === "user_feels_unsafe" ||
    input.incidentType === "being_followed" ||
    input.incidentType === "being_surrounded"
  ) {
    return "user_safety_request" as const;
  }
  return "journey_signal" as const;
}
