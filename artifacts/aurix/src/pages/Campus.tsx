import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAuthorityIncidentsQueryKey,
  getGetCampusOverviewQueryKey,
  getGetCampusReportsQueryKey,
  getGetIncidentEvidenceQueryKey,
  getGetActiveIncidentsQueryKey,
  useCreateIncidentEvidence,
  useCreateCampusReport,
  useCreateIncident,
  useGetAuthorityIncidents,
  useGetCampusOverview,
  useGetCampusReports,
  useGetIncidentEvidence,
  useGetActiveIncidents,
  useRespondToNearbySafetyRequest,
  useUpdateCampusReportVerification,
  useUpdateIncidentVerification,
} from '@workspace/api-client-react';
import type { CampusReportStatus, CampusReportType, IncidentEvidenceType, IncidentVerificationUpdateStatus } from '@workspace/api-client-react';
import {
  AlertTriangle, ArrowRight, Check, CircleHelp, Clock3, MapPin, Plus,
  Shield, ShieldAlert, Siren, Users, X,
} from 'lucide-react';

const unsafeReasons = [
  ['being_followed', 'I am being followed'],
  ['being_surrounded', 'I am surrounded'],
  ['user_feels_unsafe', 'I feel threatened'],
  ['assistance', 'I need assistance'],
  ['other', 'Something else'],
] as const;

const reportKinds: { value: CampusReportType; label: string }[] = [
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'suspicious_activity', label: 'Suspicious activity' },
  { value: 'harassment_concern', label: 'Harassment concern' },
  { value: 'unsafe_area', label: 'Unsafe area' },
  { value: 'infrastructure_safety', label: 'Infrastructure safety' },
  { value: 'other', label: 'Other' },
];

function readable(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (['verified', 'available', 'resolved'].includes(status)) return 'green';
  if (['unconfirmed', 'unknown', 'limited'].includes(status)) return 'amber';
  if (['critical', 'high', 'help_requested'].includes(status)) return 'red';
  return 'blue';
}

export function Campus() {
  const queryClient = useQueryClient();
  const overview = useGetCampusOverview({ query: { queryKey: getGetCampusOverviewQueryKey(), refetchInterval: 15_000 } });
  const reports = useGetCampusReports({ query: { queryKey: getGetCampusReportsQueryKey(), refetchInterval: 20_000 } });
  const active = useGetActiveIncidents({ query: { queryKey: getGetActiveIncidentsQueryKey(), refetchInterval: 12_000 } });
  const createReport = useCreateCampusReport();
  const createIncident = useCreateIncident();
  const nearbyResponse = useRespondToNearbySafetyRequest();
  const [selectedZone, setSelectedZone] = useState<number | ''>('');
  const [reason, setReason] = useState<(typeof unsafeReasons)[number][0] | ''>('');
  const [confirmAction, setConfirmAction] = useState<'unsafe' | 'sos' | null>(null);
  const [reportType, setReportType] = useState<CampusReportType>('safety_concern');
  const [details, setDetails] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [respondedIncident, setRespondedIncident] = useState<number | null>(null);
  const zones = overview.data?.zones ?? [];
  const selected = zones.find((zone) => zone.id === selectedZone) ?? zones[0];
  const myIncidents = active.data?.incidents ?? [];

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCampusOverviewQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCampusReportsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetActiveIncidentsQueryKey() }),
    ]);
  };
  const triggerSafetyIncident = async (kind: 'unsafe' | 'sos') => {
    if (!selected || (kind === 'unsafe' && !reason)) return;
    setError('');
    try {
      const incidentType = kind === 'sos' ? 'manual_sos' : reason === 'assistance' || reason === 'other' ? 'user_feels_unsafe' : reason;
      await createIncident.mutateAsync({ data: {
        journeyId: null,
        incidentType,
        riskLevel: kind === 'sos' ? 'critical' : 'high',
        latitude: selected.latitude,
        longitude: selected.longitude,
        verificationStatus: 'help_requested',
        signals: [kind === 'sos' ? 'manual_sos' : 'safety_request'],
        contextType: 'campus',
        campusZoneId: selected.id,
        locationLabel: selected.name,
        detectionMode: kind === 'sos' ? 'manual_sos' : 'user_safety_request',
        historicalReportsAvailable: selected.verifiedHistoricalReportCount > 0,
      } });
      setNotice(kind === 'sos' ? 'Manual SOS recorded in the simulation.' : 'Your safety request was recorded in the simulation.');
      setConfirmAction(null);
      setReason('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record this simulated request. Try again.');
    }
  };
  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (details.trim().length < 8) {
      setError('Add at least eight characters so the report has useful context.');
      return;
    }
    setError('');
    try {
      await createReport.mutateAsync({ data: {
        campusZoneId: selected?.id ?? null,
        reportType,
        details: details.trim(),
        locationNote: locationNote.trim() || null,
      } });
      setDetails('');
      setLocationNote('');
      setNotice('Report submitted. It remains unverified until an authorized review.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Report submission failed. Try again.');
    }
  };
  const respondNearby = async (incidentId: number) => {
    setError('');
    try {
      await nearbyResponse.mutateAsync({ incidentId, data: { response: 'can_help' } });
      setRespondedIncident(incidentId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record the anonymous response.');
    }
  };

  return <main className="page-wrap campus-page">
    <header className="campus-hero">
      <div>
        <div className="eyebrow">AURIX / CAMPUS SAFETY</div>
        <h1>Campus, with context.</h1>
        <p>See coverage and community reports. Every signal is a starting point for review—not a verified fact.</p>
      </div>
      <div className="campus-live-stamp"><span className="api-status-dot" /> SIMULATED CAMPUS VIEW</div>
    </header>
    <div className="notice-banner campus-sim-banner"><Shield size={17} /> Prototype only: no real GPS, messaging, dispatch, crime verification or emergency-service connection. Use local emergency services if you need urgent real-world help.</div>
    {error && <div className="campus-alert" role="alert" data-testid="status-campus-error"><AlertTriangle size={16} />{error}<button onClick={() => setError('')} aria-label="Dismiss error" data-testid="button-dismiss-campus-error"><X size={14} /></button></div>}
    {notice && <div className="campus-success" role="status" data-testid="status-campus-action"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message" data-testid="button-dismiss-campus-notice"><X size={14} /></button></div>}
    <section className="campus-summary-grid" aria-label="Campus overview">
      <div className="campus-summary"><span>MONITORED ZONES</span><strong data-testid="value-campus-zones">{overview.data?.zones.length ?? (overview.isLoading ? '—' : 'Unavailable')}</strong><small>{overview.data?.zones.length ? 'Coverage records available' : overview.isError ? 'Retry to load coverage' : 'Campus coverage overview'}</small></div>
      <div className="campus-summary"><span>ACTIVE SIGNALS</span><strong data-testid="value-campus-signals">{overview.data?.activeIncidents.length ?? (overview.isLoading ? '—' : 'Unavailable')}</strong><small>All signals remain unverified by default</small></div>
      <div className="campus-summary"><span>AVAILABLE RESPONDERS</span><strong data-testid="value-campus-responders">{overview.data?.availableResponders ?? (overview.isLoading ? '—' : 'Unavailable')}</strong><small>Prototype availability only</small></div>
      <div className="campus-summary"><span>LAST CHECK</span><strong>{overview.data?.checkedAt ? new Date(overview.data.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong><small>{overview.isError ? 'Campus overview could not load' : 'Refreshes periodically'}</small></div>
    </section>

    <div className="campus-layout">
      <section className="campus-main-column">
        <section className="panel campus-section">
          <div className="campus-section-head"><div><div className="small-label">COVERAGE DIRECTORY</div><h2 className="panel-title">Campus zones</h2></div><span className="status-chip blue"><MapPin size={12} /> {zones.length} zones</span></div>
          {overview.isLoading && <div className="campus-skeleton" aria-label="Loading campus zones"><i /><i /><i /></div>}
          {overview.isError && <div className="campus-empty"><CircleHelp size={18} /><span>Coverage is temporarily unavailable.</span><button className="btn btn-secondary" onClick={() => void overview.refetch()} data-testid="button-retry-campus-overview">Retry overview</button></div>}
          {!overview.isLoading && !overview.isError && zones.length === 0 && <div className="campus-empty"><MapPin size={19} /><span>No campus zones are configured yet.</span></div>}
          {zones.length > 0 && <div className="zone-list">{zones.map((zone) => <button key={zone.id} className={`zone-row${selected?.id === zone.id ? ' selected' : ''}`} onClick={() => setSelectedZone(zone.id)} data-testid={`button-campus-zone-${zone.id}`} aria-pressed={selected?.id === zone.id}>
            <span className="zone-pin"><MapPin size={16} /></span><span className="zone-details"><strong>{zone.name}</strong><small>{zone.campusName} · {readable(zone.zoneType)}</small><small>{zone.contextNote}</small></span><span className={`status-chip ${statusTone(zone.assistanceStatus)}`}>{readable(zone.assistanceStatus)}</span>
            <span className="zone-count"><strong>{zone.activeIncidentCount}</strong><small>active</small></span>
          </button>)}</div>}
        </section>

        <section className="panel campus-section">
          <div className="campus-section-head"><div><div className="small-label">COMMUNITY SIGNALS</div><h2 className="panel-title">Recent campus reports</h2></div><span className="status-chip amber">Unverified by default</span></div>
          {reports.isLoading && <div className="campus-skeleton short" aria-label="Loading reports"><i /><i /></div>}
          {reports.isError && <div className="campus-empty"><CircleHelp size={18} /><span>Report history could not load.</span><button className="btn btn-secondary" onClick={() => void reports.refetch()} data-testid="button-retry-campus-reports">Retry reports</button></div>}
          {!reports.isLoading && !reports.isError && !(reports.data?.reports.length) && <div className="campus-empty"><ShieldCheckIcon /><span>No campus reports yet. A new report will remain unverified until authority review.</span></div>}
          <div className="report-history">{(reports.data?.reports ?? []).slice(0, 5).map((report) => <article className="report-row" key={report.id} data-testid={`card-campus-report-${report.id}`}>
            <div className="report-mark"><ShieldAlert size={15} /></div><div className="report-body"><div className="report-title">{readable(report.reportType)} <span className={`status-chip ${statusTone(report.status)}`}>{readable(report.status)}</span></div><p>{report.details}</p><small>{report.zoneName ?? report.locationNote ?? 'Location not specified'} · {new Date(report.createdAt).toLocaleString()}</small>{report.reviewNote && <small className="review-note">Authority note: {report.reviewNote}</small>}</div>
          </article>)}</div>
        </section>
      </section>
      <aside className="campus-side-column">
        <section className="panel campus-action-panel">
          <div className="small-label">NEED SUPPORT?</div><h2 className="panel-title">Choose a clear next step.</h2>
          <label className="field-label" htmlFor="campus-zone-select">Campus zone</label>
          <select id="campus-zone-select" className="form-control" value={selected?.id ?? ''} onChange={(event) => setSelectedZone(event.target.value ? Number(event.target.value) : '')} data-testid="select-campus-zone">
            {zones.length === 0 && <option value="">No zones available</option>}
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
          </select>
          <div className="unsafe-card">
            <div className="unsafe-title"><ShieldAlert size={17} /><div><strong>I feel unsafe</strong><small>Choose what is happening before requesting help.</small></div></div>
            <div className="reason-options">{unsafeReasons.map(([value, label]) => <button key={value} className={`reason-option${reason === value ? ' chosen' : ''}`} aria-pressed={reason === value} onClick={() => { setReason(value); setConfirmAction(null); }} data-testid={`button-unsafe-reason-${value}`}>{reason === value && <Check size={13} />}{label}</button>)}</div>
            <button className="btn btn-primary unsafe-submit" disabled={!reason || !selected || createIncident.isPending} onClick={() => setConfirmAction('unsafe')} data-testid="button-open-unsafe-confirm">{createIncident.isPending ? 'Recording request…' : 'Continue to confirmation'}<ArrowRight size={14} /></button>
          </div>
          <button className="btn btn-danger sos-button" disabled={!selected || createIncident.isPending} onClick={() => setConfirmAction('sos')} data-testid="button-open-manual-sos"><Siren size={16} /> Manual SOS</button>
          <p className="microcopy">SOS is not an emergency call. It creates a simulation record only.</p>
          {confirmAction && <div className="confirm-box" role="alertdialog" aria-labelledby="campus-confirm-title" data-testid={`dialog-confirm-${confirmAction}`}>
            <strong id="campus-confirm-title">{confirmAction === 'sos' ? 'Confirm manual SOS' : 'Confirm safety request'}</strong>
            <p>{confirmAction === 'sos' ? 'This will record a simulated high-priority incident for this selected zone.' : `This will record “${unsafeReasons.find(([value]) => value === reason)?.[1]}” as a simulated request.`} Nothing will contact a real person or service.</p>
            <div className="btn-row"><button className="btn btn-danger" onClick={() => void triggerSafetyIncident(confirmAction)} disabled={createIncident.isPending} data-testid={`button-confirm-${confirmAction}`}>Confirm {confirmAction === 'sos' ? 'SOS' : 'request'}</button><button className="btn btn-quiet" onClick={() => setConfirmAction(null)} data-testid="button-cancel-campus-confirm">Cancel</button></div>
          </div>}
        </section>
        <section className="panel campus-action-panel">
          <div className="small-label">CONTRIBUTE CONTEXT</div><h2 className="panel-title">Submit a campus report</h2><p className="panel-copy">Reports are not treated as verified until an authorized reviewer changes the status.</p>
          <form onSubmit={(event) => void submitReport(event)} data-testid="form-campus-report">
            <label className="field-label" htmlFor="campus-report-type">Report type</label><select id="campus-report-type" className="form-control" value={reportType} onChange={(event) => setReportType(event.target.value as CampusReportType)} data-testid="select-campus-report-type">{reportKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select>
            <label className="field-label" htmlFor="campus-report-details">What should be reviewed?</label><textarea id="campus-report-details" className="form-control report-textarea" value={details} onChange={(event) => setDetails(event.target.value)} minLength={8} maxLength={2000} required placeholder="Describe what you observed. Keep it factual." data-testid="input-campus-report-details" />
            <label className="field-label" htmlFor="campus-report-location">Location note <span>(optional)</span></label><input id="campus-report-location" className="form-control" value={locationNote} onChange={(event) => setLocationNote(event.target.value)} maxLength={200} placeholder="A landmark or area—not a precise coordinate" data-testid="input-campus-report-location" />
            <button type="submit" className="btn btn-secondary report-submit" disabled={createReport.isPending} data-testid="button-submit-campus-report"><Plus size={14} />{createReport.isPending ? 'Submitting…' : 'Submit report'}</button>
          </form>
        </section>
        <section className="panel campus-section">
          <div className="campus-section-head"><div><div className="small-label">NEARBY HELP</div><h2 className="panel-title">Anonymous response</h2></div><Users size={17} /></div>
          <p className="panel-copy">A nearby person can volunteer without sharing identity, phone, profile, or precise location.</p>
          {(overview.data?.activeIncidents ?? []).length === 0 && <div className="campus-empty compact"><Clock3 size={16} /><span>No active nearby requests.</span></div>}
          {(overview.data?.activeIncidents ?? []).slice(0, 3).map((incident) => <div className="nearby-row" key={incident.id} data-testid={`card-nearby-request-${incident.id}`}>
            <div><strong>{incident.zoneName}</strong><small>{readable(incident.incidentType)} · <span className={`status-inline ${statusTone(incident.verificationStatus)}`}>{readable(incident.verificationStatus)}</span></small></div>
            {respondedIncident === incident.id ? <span className="status-chip green">Response recorded</span> : <button className="btn btn-secondary compact-btn" onClick={() => void respondNearby(incident.id)} disabled={nearbyResponse.isPending} data-testid={`button-nearby-can-help-${incident.id}`}>I can help</button>}
          </div>)}
        </section>
        <div className="notice-banner warning"><AlertTriangle size={16} />Incident history is incomplete where indicated. A lack of reports does not mean an area is safe.</div>
      </aside>
    </div>
  </main>;
}

export function AuthorityReviews() {
  const queryClient = useQueryClient();
  const incidentsQuery = useGetAuthorityIncidents({ query: { queryKey: getGetAuthorityIncidentsQueryKey(), refetchInterval: 15_000 } });
  const reportsQuery = useGetCampusReports({ query: { queryKey: getGetCampusReportsQueryKey(), refetchInterval: 20_000 } });
  const incidents = incidentsQuery.data?.incidents ?? [];
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const selectedId = incidents.some((item) => item.id === selectedIncidentId) ? selectedIncidentId! : incidents[0]?.id;
  const evidenceQuery = useGetIncidentEvidence(selectedId ?? 0, { query: { queryKey: getGetIncidentEvidenceQueryKey(selectedId ?? 0), enabled: Boolean(selectedId) } });
  const updateIncident = useUpdateIncidentVerification();
  const updateReport = useUpdateCampusReportVerification();
  const createEvidence = useCreateIncidentEvidence();
  const [reviewNote, setReviewNote] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [evidenceType, setEvidenceType] = useState<IncidentEvidenceType>('description');
  const [fileLabel, setFileLabel] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reviewIncident = async (status: IncidentVerificationUpdateStatus) => {
    if (!selectedId) return;
    setError('');
    try {
      await updateIncident.mutateAsync({ incidentId: selectedId, data: { status, note: reviewNote.trim() || null } });
      setNotice(`Incident marked ${readable(status).toLowerCase()}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAuthorityIncidentsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetActiveIncidentsQueryKey() }),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Incident review could not be saved.');
    }
  };
  const reviewReport = async (reportId: number, status: CampusReportStatus) => {
    setError('');
    try {
      await updateReport.mutateAsync({ reportId, data: { status, reviewNote: reviewNote.trim() || null } });
      setNotice(`Report ${reportId} marked ${readable(status).toLowerCase()}.`);
      await queryClient.invalidateQueries({ queryKey: getGetCampusReportsQueryKey() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Report review could not be saved.');
    }
  };
  const submitEvidence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || evidenceDescription.trim().length < 3) return;
    setError('');
    try {
      await createEvidence.mutateAsync({ incidentId: selectedId, data: {
        evidenceType,
        description: evidenceDescription.trim(),
        fileLabel: fileLabel.trim() || null,
      } });
      setEvidenceDescription('');
      setFileLabel('');
      setNotice('Private evidence metadata saved. No media file was uploaded.');
      await queryClient.invalidateQueries({ queryKey: getGetIncidentEvidenceQueryKey(selectedId) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Evidence metadata could not be saved.');
    }
  };

  return <main className="page-wrap campus-page">
    <header className="campus-hero authority-hero"><div><div className="eyebrow">AURIX / AUTHORITY REVIEW</div><h1>Review, then verify.</h1><p>Reports and incident signals stay unverified until an authorized reviewer changes their state.</p></div><span className="status-chip amber">REVIEW WORKSPACE</span></header>
    <div className="notice-banner campus-sim-banner"><Shield size={17} />Authority actions update prototype records only. AURIX does not verify crime, contact emergency services, or dispatch responders.</div>
    {error && <div className="campus-alert" role="alert" data-testid="status-authority-error"><AlertTriangle size={16} />{error}<button onClick={() => setError('')} aria-label="Dismiss error" data-testid="button-dismiss-authority-error"><X size={14} /></button></div>}
    {notice && <div className="campus-success" role="status" data-testid="status-authority-action"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message" data-testid="button-dismiss-authority-notice"><X size={14} /></button></div>}
    <div className="authority-workspace">
      <section className="panel campus-section">
        <div className="campus-section-head"><div><div className="small-label">INCIDENT QUEUE</div><h2 className="panel-title">Active incident signals</h2></div><span className="status-chip blue">{incidents.length} items</span></div>
        {incidentsQuery.isLoading && <div className="campus-skeleton short"><i /><i /></div>}
        {incidentsQuery.isError && <div className="campus-empty"><CircleHelp size={17} /><span>Authority incident queue is unavailable for this account.</span><button className="btn btn-secondary" onClick={() => void incidentsQuery.refetch()} data-testid="button-retry-authority-incidents">Retry queue</button></div>}
        {!incidentsQuery.isLoading && !incidentsQuery.isError && incidents.length === 0 && <div className="campus-empty"><Shield size={18} /><span>No active incident signals need review.</span></div>}
        {incidents.map((incident) => <button className={`authority-incident${selectedId === incident.id ? ' selected' : ''}`} key={incident.id} onClick={() => setSelectedIncidentId(incident.id)} data-testid={`button-review-incident-${incident.id}`}>
          <span className="incident-risk-mark"><ShieldAlert size={16} /></span><span className="authority-incident-copy"><strong>{readable(incident.incidentType)}</strong><small>{incident.campusZoneName ?? incident.locationLabel ?? 'Location not specified'} · {incident.contextType === 'campus' ? 'Campus' : 'Public space'}</small><small>Risk score {incident.riskScore} / 100 · {new Date(incident.detectedAt).toLocaleString()}</small></span><span className={`status-chip ${statusTone(incident.verificationStatus)}`}>{readable(incident.verificationStatus)}</span>
        </button>)}
      </section>
      <section className="panel campus-section">
        <div className="campus-section-head"><div><div className="small-label">REVIEW DETAIL</div><h2 className="panel-title">{selectedId ? `Incident ${selectedId}` : 'Select a signal'}</h2></div></div>
        {selectedId ? <>
          {incidents.find((item) => item.id === selectedId)?.historicalReportsAvailable === false && <div className="notice-banner warning"><CircleHelp size={15} />No historical reports are available for this incident. Absence of history is not evidence of safety.</div>}
          {incidents.find((item) => item.id === selectedId)?.lastSafeLocation && <div className="last-safe-location" data-testid="text-last-safe-location"><MapPin size={15} /><span><strong>Last safe location returned</strong><small>{incidents.find((item) => item.id === selectedId)?.lastSafeLocation?.label ?? 'Location label unavailable'} · recorded {new Date(incidents.find((item) => item.id === selectedId)!.lastSafeLocation!.recordedAt).toLocaleString()}</small></span></div>}
          <div className="risk-signal-list"><strong>Explainable risk signals</strong>{(incidents.find((item) => item.id === selectedId)?.riskSignals ?? []).length ? incidents.find((item) => item.id === selectedId)?.riskSignals.map((signal) => <div className="risk-signal-row" key={signal.code}><span>{readable(signal.label)}</span><span>+{signal.points} points</span></div>) : <p className="panel-copy">No risk signals were returned.</p>}</div>
          <label className="field-label" htmlFor="authority-review-note">Review note</label><textarea className="form-control report-textarea" id="authority-review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={1000} placeholder="Record the basis for this review." data-testid="input-authority-review-note" />
          <div className="authority-actions">
            <button className="btn btn-secondary" onClick={() => void reviewIncident('under_verification')} disabled={updateIncident.isPending} data-testid="button-incident-under-verification">Under verification</button>
            <button className="btn btn-primary" onClick={() => void reviewIncident('verified')} disabled={updateIncident.isPending} data-testid="button-incident-verified">Mark verified</button>
            <button className="btn btn-danger" onClick={() => void reviewIncident('unconfirmed')} disabled={updateIncident.isPending} data-testid="button-incident-unconfirmed">Mark unconfirmed</button>
          </div>
          <div className="evidence-block">
            <div className="small-label">PRIVATE EVIDENCE METADATA</div><p className="panel-copy">Metadata only. This prototype stores no image, video, or audio bytes.</p>
            {evidenceQuery.isLoading && <div className="campus-skeleton short"><i /></div>}
            {evidenceQuery.isError && <div className="campus-inline-error">Evidence metadata is unavailable for this account.</div>}
            {(evidenceQuery.data?.evidence ?? []).map((item) => <div key={item.id} className="evidence-row" data-testid={`row-evidence-${item.id}`}><span>{readable(item.evidenceType)}</span><strong>{item.description}</strong><small>{item.fileLabel ?? 'No file label'} · recorded {new Date(item.recordedAt).toLocaleString()}</small></div>)}
            <form onSubmit={(event) => void submitEvidence(event)} className="evidence-form" data-testid="form-evidence-metadata">
              <select className="form-control" aria-label="Evidence metadata type" value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as IncidentEvidenceType)} data-testid="select-evidence-type">{(['description', 'photo', 'video', 'audio'] as IncidentEvidenceType[]).map((type) => <option key={type} value={type}>{readable(type)} metadata</option>)}</select>
              <input className="form-control" value={evidenceDescription} onChange={(event) => setEvidenceDescription(event.target.value)} required minLength={3} maxLength={2000} placeholder="Evidence description" aria-label="Evidence description" data-testid="input-evidence-description" />
              <input className="form-control" value={fileLabel} onChange={(event) => setFileLabel(event.target.value)} maxLength={200} placeholder="Optional file label; no upload" aria-label="Optional file label" data-testid="input-evidence-file-label" />
              <button type="submit" className="btn btn-secondary" disabled={createEvidence.isPending} data-testid="button-save-evidence-metadata">{createEvidence.isPending ? 'Saving…' : 'Save metadata'}</button>
            </form>
          </div>
        </> : <div className="campus-empty"><Shield size={18} /><span>Select an incident to see its review context.</span></div>}
      </section>
    </div>
    <section className="panel campus-section authority-reports">
      <div className="campus-section-head"><div><div className="small-label">CAMPUS REPORT QUEUE</div><h2 className="panel-title">Community submissions</h2></div><span className="status-chip amber">Not verified by submission</span></div>
      {reportsQuery.isLoading && <div className="campus-skeleton short"><i /><i /></div>}
      {reportsQuery.isError && <div className="campus-empty"><CircleHelp size={17} /><span>Report review queue is unavailable for this account.</span><button className="btn btn-secondary" onClick={() => void reportsQuery.refetch()} data-testid="button-retry-authority-reports">Retry reports</button></div>}
      {!reportsQuery.isLoading && !reportsQuery.isError && !(reportsQuery.data?.reports.length) && <div className="campus-empty"><Shield size={18} /><span>No campus reports have been submitted.</span></div>}
      {(reportsQuery.data?.reports ?? []).map((report) => <article className="authority-report-row" key={report.id} data-testid={`row-authority-report-${report.id}`}>
        <div className="report-body"><div className="report-title">{readable(report.reportType)} <span className={`status-chip ${statusTone(report.status)}`}>{readable(report.status)}</span></div><p>{report.details}</p><small>{report.zoneName ?? report.locationNote ?? 'Location not specified'} · submitted by {report.reporterName ?? 'Community member'}</small>{report.reviewNote && <small className="review-note">Review note: {report.reviewNote}</small>}</div>
        <div className="authority-actions report-actions"><button className="btn btn-secondary" onClick={() => void reviewReport(report.id, 'under_verification')} disabled={updateReport.isPending} data-testid={`button-report-review-${report.id}`}>Review</button><button className="btn btn-primary" onClick={() => void reviewReport(report.id, 'verified')} disabled={updateReport.isPending} data-testid={`button-report-verify-${report.id}`}>Verify</button><button className="btn btn-danger" onClick={() => void reviewReport(report.id, 'unconfirmed')} disabled={updateReport.isPending} data-testid={`button-report-unconfirmed-${report.id}`}>Unconfirmed</button></div>
      </article>)}
    </section>
  </main>;
}

function ShieldCheckIcon() {
  return <Shield size={18} aria-hidden="true" />;
}
