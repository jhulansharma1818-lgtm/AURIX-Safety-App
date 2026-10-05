import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CampusReport,
  CampusReportInput,
  CampusReportReview,
  CampusReportStatus,
  CampusReportsResponse,
  CreateCampusReportBody,
  CreateCampusReportResponse,
  GetCampusOverviewResponse,
  GetCampusReportsResponse,
  UpdateCampusReportVerificationBody,
  UpdateCampusReportVerificationParams,
  UpdateCampusReportVerificationResponse,
} from "@workspace/api-zod";
import {
  campusReportsTable,
  campusZonesTable,
  db,
  incidentsTable,
  respondersTable,
  usersTable,
} from "@workspace/db";
import { parseId, readBody, sendParsed } from "../lib/route-utils";
import { requireProfile, requireRole } from "../middlewares/aurix-auth";

const router: IRouter = Router();
const activeIncidentStates = [
  "open",
  "verification_pending",
  "responder_assigned",
  "help_reached",
] as const;

function presentReport(
  report: typeof campusReportsTable.$inferSelect,
  zoneName: string | null,
  reporterName: string | null,
) {
  return {
    id: report.id,
    campusZoneId: report.campusZoneId,
    zoneName,
    reportType: report.reportType,
    details: report.details,
    locationNote: report.locationNote,
    status: report.status,
    reviewNote: report.reviewNote,
    reporterName,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

router.get(
  "/campus/overview",
  requireProfile,
  requireRole("user", "emergency_contact", "responder", "authority"),
  async (_req, res) => {
    const [zones, activeIncidents, [responderSummary], verifiedReports] =
      await Promise.all([
        db.select().from(campusZonesTable).orderBy(campusZonesTable.name),
        db
          .select({
            id: incidentsTable.id,
            campusZoneId: incidentsTable.campusZoneId,
            incidentType: incidentsTable.incidentType,
            riskLevel: incidentsTable.riskLevel,
            verificationStatus: incidentsTable.verificationStatus,
            responseStatus: incidentsTable.responseStatus,
            detectedAt: incidentsTable.detectedAt,
            locationLabel: incidentsTable.locationLabel,
          })
          .from(incidentsTable)
          .where(
            and(
              inArray(incidentsTable.responseStatus, activeIncidentStates),
              eq(incidentsTable.contextType, "campus"),
            ),
          )
          .orderBy(desc(incidentsTable.detectedAt)),
        db
          .select({ value: count() })
          .from(respondersTable)
          .where(
            and(
              eq(respondersTable.verified, true),
              eq(respondersTable.availabilityStatus, "available"),
            ),
          ),
        db
          .select({
            campusZoneId: campusReportsTable.campusZoneId,
            value: count(),
          })
          .from(campusReportsTable)
          .where(eq(campusReportsTable.status, "verified"))
          .groupBy(campusReportsTable.campusZoneId),
      ]);

    const activeCounts = new Map<number, number>();
    for (const incident of activeIncidents) {
      if (incident.campusZoneId !== null) {
        activeCounts.set(
          incident.campusZoneId,
          (activeCounts.get(incident.campusZoneId) ?? 0) + 1,
        );
      }
    }
    const historyCounts = new Map<number, number>();
    for (const report of verifiedReports) {
      if (report.campusZoneId !== null) {
        historyCounts.set(report.campusZoneId, report.value);
      }
    }
    const zoneById = new Map(zones.map((zone) => [zone.id, zone]));

    return sendParsed(res, GetCampusOverviewResponse, {
      zones: zones.map((zone) => ({
        id: zone.id,
        slug: zone.slug,
        campusName: zone.campusName,
        name: zone.name,
        zoneType: zone.zoneType,
        assistanceStatus: zone.assistanceStatus,
        contextNote: zone.contextNote,
        latitude: zone.latitude,
        longitude: zone.longitude,
        activeIncidentCount: activeCounts.get(zone.id) ?? 0,
        verifiedHistoricalReportCount: historyCounts.get(zone.id) ?? 0,
      })),
      activeIncidents: activeIncidents
        .filter((incident) => incident.campusZoneId !== null)
        .map((incident) => ({
          id: incident.id,
          campusZoneId: incident.campusZoneId!,
          zoneName: zoneById.get(incident.campusZoneId!)?.name ?? "Campus zone",
          incidentType: incident.incidentType,
          riskLevel: incident.riskLevel,
          verificationStatus: incident.verificationStatus,
          responseStatus: incident.responseStatus,
          detectedAt: incident.detectedAt.toISOString(),
          locationLabel:
            zoneById.get(incident.campusZoneId!)?.name ??
            incident.locationLabel ??
            null,
        })),
      availableResponders: responderSummary?.value ?? 0,
      checkedAt: new Date().toISOString(),
    });
  },
);

router.get(
  "/campus/reports",
  requireProfile,
  requireRole("user", "authority"),
  async (_req, res) => {
    const actor = res.locals.aurixActor!;
    const filters =
      actor.user.role === "authority"
        ? undefined
        : eq(campusReportsTable.reporterId, actor.user.id);
    const rows = await db
      .select({
        report: campusReportsTable,
        zoneName: campusZonesTable.name,
        reporterName: usersTable.name,
      })
      .from(campusReportsTable)
      .leftJoin(
        campusZonesTable,
        eq(campusZonesTable.id, campusReportsTable.campusZoneId),
      )
      .leftJoin(usersTable, eq(usersTable.id, campusReportsTable.reporterId))
      .where(filters)
      .orderBy(desc(campusReportsTable.createdAt));
    return sendParsed(res, GetCampusReportsResponse, {
      reports: rows.map((row) =>
        presentReport(
          row.report,
          row.zoneName,
          actor.user.role === "authority" ? row.reporterName : null,
        ),
      ),
    });
  },
);

router.post(
  "/campus/reports",
  requireProfile,
  requireRole("user"),
  async (req, res) => {
    const input = readBody(CreateCampusReportBody, req.body, res);
    if (!input) return;
    if (input.campusZoneId) {
      const [zone] = await db
        .select({ id: campusZonesTable.id })
        .from(campusZonesTable)
        .where(eq(campusZonesTable.id, input.campusZoneId))
        .limit(1);
      if (!zone) {
        res.status(400).json({ error: "Choose a valid campus zone." });
        return;
      }
    }
    const actor = res.locals.aurixActor!;
    const [report] = await db
      .insert(campusReportsTable)
      .values({
        reporterId: actor.user.id,
        campusZoneId: input.campusZoneId ?? null,
        reportType: input.reportType,
        details: input.details.trim(),
        locationNote: input.locationNote?.trim() || null,
        status: "reported",
      })
      .returning();
    const zoneName = report.campusZoneId
      ? (
          await db
            .select({ name: campusZonesTable.name })
            .from(campusZonesTable)
            .where(eq(campusZonesTable.id, report.campusZoneId))
            .limit(1)
        )[0]?.name ?? null
      : null;
    return sendParsed(
      res,
      CreateCampusReportResponse,
      presentReport(report, zoneName, null),
      201,
    );
  },
);

router.patch(
  "/campus/reports/:reportId/verification",
  requireProfile,
  requireRole("authority"),
  async (req, res) => {
    const params = UpdateCampusReportVerificationParams.safeParse({
      reportId: parseId(req.params.reportId),
    });
    if (!params.success) {
      res.status(400).json({ error: "Campus report ID is invalid." });
      return;
    }
    const input = readBody(
      UpdateCampusReportVerificationBody,
      req.body,
      res,
    );
    if (!input) return;
    const actor = res.locals.aurixActor!;
    const [report] = await db
      .update(campusReportsTable)
      .set({
        status: input.status,
        reviewNote: input.reviewNote?.trim() || null,
        reviewedBy: actor.user.id,
        reviewedAt: new Date(),
      })
      .where(eq(campusReportsTable.id, params.data.reportId))
      .returning();
    if (!report) {
      res.status(404).json({ error: "Campus report not found." });
      return;
    }
    const [zone, reporter] = await Promise.all([
      report.campusZoneId
        ? db
            .select({ name: campusZonesTable.name })
            .from(campusZonesTable)
            .where(eq(campusZonesTable.id, report.campusZoneId))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, report.reporterId))
        .limit(1),
    ]);
    return sendParsed(
      res,
      UpdateCampusReportVerificationResponse,
      presentReport(report, zone[0]?.name ?? null, reporter[0]?.name ?? null),
    );
  },
);

export default router;
