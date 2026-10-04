import { useEffect, useState, type ReactNode } from 'react';
import { Link, Route as WouterRoute, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useClerk,
  useUser,
} from '@clerk/react';
import { dark } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetActiveIncidentsQueryKey,
  getGetActiveJourneyQueryKey,
  getGetEmergencyContactsQueryKey,
  getGetAuthSessionQueryKey,
  getHealthCheckQueryKey,
  setRequestHeadersGetter,
  useAcceptIncident,
  useCreateEmergencyContact,
  useCreateIncident,
  useCreateJourney,
  useCreateResponseEvent,
  useGetActiveIncidents,
  useGetActiveJourney,
  useGetAuthSession,
  useGetEmergencyContacts,
  useHealthCheck,
  useRegisterResponder,
  useRegisterUser,
  useResolveIncident,
  useSeedDemoData,
  useUpdateJourneySharing,
  useUpdateJourneyStatus,
  useUpdateResponderStatus,
} from '@workspace/api-client-react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, Bell,
  Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Crosshair,
  Database, Eye, Fingerprint, HeartHandshake, KeyRound, LogIn, LogOut,
  MapPin, Navigation, Plus, RefreshCw,
  Radio, Route, Shield, ShieldAlert, ShieldCheck, Siren, Sparkles, Users,
  UserRound, Waves, X,
} from 'lucide-react';

type Scenario = 'Normal Journey' | 'Route Deviation' | 'Unexpected Stop' | 'New Incident — No History' | "User Doesn't Respond" | 'User Requests Help' | 'Responder Accepts' | 'Help Reached';

const navigation = [
  ['/', 'Overview'], ['/roles', 'Portals'], ['/portal', 'User'], ['/journey/start', 'Journey'],
  ['/journey/live', 'Live'], ['/risk', 'Risk'], ['/verify', 'Verify'], ['/response', 'ResponseChain'],
  ['/contact', 'Contact'], ['/responder', 'Responder'], ['/authority', 'Authority'], ['/privacy', 'Privacy'], ['/demo', 'Demo'],
];

const flow = ['Start Journey', 'Expected Route', 'Live Monitoring', 'Risk Detection', 'Silent Verification', 'ResponseChain', 'Trusted Contact', 'Verified Responder', 'Help Reached', 'Incident Resolved'];

type DemoRole = 'user' | 'emergency_contact' | 'responder' | 'authority' | 'clerk';
type JourneyRecord = {
  id: number;
  destination: string;
  driverName: string | null;
  status: string;
  shareWithContacts: boolean;
  currentLocation: { latitude: number; longitude: number; label?: string } | null;
};
type IncidentRecord = {
  id: number;
  journeyId: number | null;
  incidentType: string;
  riskLevel: string;
  latitude: number;
  longitude: number;
  responseStatus: string;
  verificationStatus: string;
  detectedAt: string;
  destination: string | null;
  victim: { name: string; phone: string | null } | null;
  events: { id: number; eventType: string; timestamp: string; details: Record<string, unknown> }[];
};
type ContactRecord = {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  relationship: string;
  verified: boolean;
};

const demoRoleStorageKey = 'aurix.demo-role';
const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 4_000, retry: 1, refetchOnWindowFocus: true },
  },
});

function initialDemoRole(): DemoRole {
  if (typeof window === 'undefined') return 'user';
  const saved = window.localStorage.getItem(demoRoleStorageKey);
  if (
    saved === 'user' ||
    saved === 'emergency_contact' ||
    saved === 'responder' ||
    saved === 'authority' ||
    saved === 'clerk'
  ) {
    return saved;
  }
  window.localStorage.setItem(demoRoleStorageKey, 'user');
  return 'user';
}

setRequestHeadersGetter((): Record<string, string> => {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const role = window.localStorage.getItem(demoRoleStorageKey);
    if (role && role !== 'clerk') return { 'x-aurix-demo-role': role };
  }
  return {};
});

function apiErrorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The API request failed. Check the API and database status, then try again.';
}

function AppFrame() {
  const [path, navigate] = useLocation();
  const [scenario, setScenario] = useState<Scenario>('Normal Journey');
  const [destination, setDestination] = useState('Northgate Community Centre');
  const [origin, setOrigin] = useState('Cedar Park Station');
  const [stage, setStage] = useState(0);
  const [resolved, setResolved] = useState(false);
  const [journeyActive, setJourneyActive] = useState(false);
  const [routeShared, setRouteShared] = useState(true);
  const [privateMode, setPrivateMode] = useState(false);
  const [contactAcknowledged, setContactAcknowledged] = useState(false);
  const [responderAccepted, setResponderAccepted] = useState(false);
  const [demoRole, setDemoRole] = useState<DemoRole>(initialDemoRole);
  const [actionError, setActionError] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [incidentSnapshot, setIncidentSnapshot] = useState<IncidentRecord | null>(null);
  const queryClient = useQueryClient();
  const clerk = useClerk();
  const clerkState = useUser();

  const health = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 12_000 },
  });
  const session = useGetAuthSession({
    query: {
      queryKey: getGetAuthSessionQueryKey(),
      refetchInterval: 15_000,
      retry: false,
    },
  });
  const isDemoActor = import.meta.env.DEV && demoRole !== 'clerk';
  const canQueryActorData = Boolean(session.data?.signedIn);
  const activeJourneyQuery = useGetActiveJourney({
    query: {
      queryKey: getGetActiveJourneyQueryKey(),
      enabled: canQueryActorData,
      refetchInterval: 12_000,
    },
  });
  const activeIncidentsQuery = useGetActiveIncidents({
    query: {
      queryKey: getGetActiveIncidentsQueryKey(),
      enabled: canQueryActorData,
      refetchInterval: 7_000,
    },
  });
  const contactsQuery = useGetEmergencyContacts({
    query: {
      queryKey: getGetEmergencyContactsQueryKey(),
      enabled:
        canQueryActorData && session.data?.user?.role === 'user',
      refetchInterval: 20_000,
    },
  });

  const registerProfile = useRegisterUser();
  const seedDemo = useSeedDemoData();
  const createJourneyMutation = useCreateJourney();
  const updateJourneyStatusMutation = useUpdateJourneyStatus();
  const updateJourneySharingMutation = useUpdateJourneySharing();
  const createContactMutation = useCreateEmergencyContact();
  const createIncidentMutation = useCreateIncident();
  const createEventMutation = useCreateResponseEvent();
  const acceptIncidentMutation = useAcceptIncident();
  const resolveIncidentMutation = useResolveIncident();
  const registerResponderMutation = useRegisterResponder();
  const updateResponderStatusMutation = useUpdateResponderStatus();

  const activeJourney = (activeJourneyQuery.data?.journey ?? null) as JourneyRecord | null;
  const activeIncidents = (activeIncidentsQuery.data?.incidents ?? []) as IncidentRecord[];
  const contacts = (contactsQuery.data?.contacts ?? []) as ContactRecord[];
  const selectedActiveIncident =
    activeIncidents.find((incident) => incident.id === selectedIncidentId) ??
    activeIncidents[0] ??
    null;
  const activeIncident =
    selectedActiveIncident ??
    (incidentSnapshot?.id === selectedIncidentId || !selectedIncidentId
      ? incidentSnapshot
      : null);

  useEffect(() => {
    if (!import.meta.env.DEV || window.sessionStorage.getItem('aurix.demo-seeded')) return;
    window.sessionStorage.setItem('aurix.demo-seeded', 'true');
    seedDemo.mutate(undefined, {
      onSuccess: () => void queryClient.invalidateQueries(),
    });
  }, [queryClient, seedDemo.mutate]);

  useEffect(() => {
    if (
      isDemoActor ||
      !clerkState.isLoaded ||
      !clerkState.isSignedIn ||
      !clerkState.user ||
      session.data?.user ||
      registerProfile.isPending ||
      registerProfile.isSuccess ||
      registerProfile.isError
    ) {
      return;
    }
    const email = clerkState.user.primaryEmailAddress?.emailAddress;
    const name =
      clerkState.user.fullName ||
      [clerkState.user.firstName, clerkState.user.lastName].filter(Boolean).join(' ') ||
      email ||
      'AURIX user';
    registerProfile.mutate(
      { data: { name } },
      {
        onSuccess: () =>
          void queryClient.invalidateQueries({
            queryKey: getGetAuthSessionQueryKey(),
          }),
        onError: (error) => setActionError(apiErrorText(error)),
      },
    );
  }, [
    clerkState.isLoaded,
    clerkState.isSignedIn,
    clerkState.user,
    isDemoActor,
    queryClient,
    registerProfile.isError,
    registerProfile.isPending,
    registerProfile.isSuccess,
    registerProfile.mutate,
    session.data?.user,
  ]);

  const switchDemoRole = (role: DemoRole) => {
    if (!import.meta.env.DEV) return;
    window.localStorage.setItem(demoRoleStorageKey, role);
    setDemoRole(role);
    queryClient.clear();
    setActionError('');
    setIncidentSnapshot(null);
    setSelectedIncidentId(null);
  };

  const runAction = async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setActionError('');
    try {
      const result = await action();
      await queryClient.invalidateQueries();
      return result;
    } catch (error) {
      setActionError(apiErrorText(error));
      return null;
    }
  };

  const buildJourneyInput = () => ({
    destination: destination.trim() || 'Northgate Community Centre',
    driverName: session.data?.user?.name ?? 'Demo traveler',
    expectedRoute: {
      origin: origin.trim() || 'Cedar Park Station',
      destination: destination.trim() || 'Northgate Community Centre',
      points: [
        { latitude: 12.9716, longitude: 77.5946, label: origin.trim() || 'Cedar Park Station' },
        { latitude: 12.9784, longitude: 77.6032, label: destination.trim() || 'Northgate Community Centre' },
      ],
    },
    currentLocation: {
      latitude: 12.9716,
      longitude: 77.5946,
      label: origin.trim() || 'Cedar Park Station',
    },
    shareWithContacts: routeShared && !privateMode,
  });

  const createJourney = () =>
    runAction(() => createJourneyMutation.mutateAsync({ data: buildJourneyInput() }));

  const startJourney = async () => {
    const journey = await createJourney();
    if (!journey) return;
    setJourneyActive(true);
    setResolved(false);
    setStage(2);
    navigate('/journey/live');
  };

  const updateJourneyStatus = async (status: 'arrived' | 'cancelled') => {
    if (!activeJourney) return;
    const updated = await runAction(() =>
      updateJourneyStatusMutation.mutateAsync({
        journeyId: activeJourney.id,
        data: { status },
      }),
    );
    if (!updated) return;
    setJourneyActive(false);
    if (status === 'arrived') {
      setResolved(true);
      setStage(9);
    } else {
      setStage(0);
      navigate('/portal');
    }
  };

  const createScenarioIncident = async (
    choice: Scenario,
    journeyId?: number,
  ) => {
    const incidentType =
      choice === 'Route Deviation'
        ? 'route_deviation'
        : choice === 'Unexpected Stop'
          ? 'unexpected_stop'
          : choice === "User Doesn't Respond"
            ? 'no_response'
            : 'user_request';
    const verificationStatus =
      choice === 'User Requests Help' ||
      choice === 'Responder Accepts' ||
      choice === 'Help Reached'
        ? 'help_requested'
        : choice === "User Doesn't Respond"
          ? 'no_response'
          : 'pending';
    const result = await runAction(() =>
      createIncidentMutation.mutateAsync({
        data: {
          journeyId: journeyId ?? null,
          incidentType,
          riskLevel: choice === 'Route Deviation' || choice === 'Unexpected Stop' ? 'high' : 'medium',
          latitude: 12.9761,
          longitude: 77.6014,
          verificationStatus,
        },
      }),
    );
    if (result) {
      setIncidentSnapshot(result as IncidentRecord);
      setSelectedIncidentId(result.id);
    }
    return result;
  };

  const nextFlow = (to: number, routePath: string) => {
    setStage(to);
    navigate(routePath);
  };

  const chooseScenario = async (choice: Scenario) => {
    setScenario(choice);
    setResolved(false);
    setJourneyActive(true);
    switchDemoRole('user');
    if (choice === 'Normal Journey') {
      const journey = await createJourney();
      if (journey) {
        setStage(2);
        navigate('/journey/live');
      }
      return;
    }
    const journey =
      choice === 'New Incident — No History' ? null : await createJourney();
    if (choice !== 'New Incident — No History' && !journey) return;
    const incident = await createScenarioIncident(
      choice,
      journey ? journey.id : undefined,
    );
    if (!incident) return;

    if (choice === 'Route Deviation' || choice === 'Unexpected Stop' || choice === 'New Incident — No History') {
      setStage(3);
      navigate('/risk');
    } else if (choice === "User Doesn't Respond") {
      setStage(4);
      navigate('/verify');
    } else if (choice === 'User Requests Help') {
      setStage(5);
      navigate('/response');
    } else {
      switchDemoRole('responder');
      setResponderAccepted(false);
      if (choice === 'Help Reached') {
        const accepted = await runAction(() =>
          acceptIncidentMutation.mutateAsync({ incidentId: incident.id }),
        );
        if (!accepted) return;
        await runAction(() =>
          createEventMutation.mutateAsync({
            incidentId: incident.id,
            data: { eventType: 'help_reached', details: { source: 'demo_scenario' } },
          }),
        );
        setResponderAccepted(true);
        setStage(8);
      } else {
        setStage(7);
      }
      navigate('/responder');
    }
  };

  const isHome = path === '/';
  const renderPage = () => {
    switch (path) {
      case '/': return <Landing onBegin={() => navigate('/roles')} onDemo={() => navigate('/demo')} />;
      case '/roles': return <Roles />;
      case '/portal': return <Portal onBegin={() => navigate('/journey/start')} userName={session.data?.user?.name ?? 'Demo traveler'} journey={activeJourney} contacts={contacts} contactsLoading={contactsQuery.isLoading} onAddContact={async (contact) => Boolean(await runAction(() => createContactMutation.mutateAsync({ data: contact })))} />;
      case '/journey/start': return <JourneyStart origin={origin} destination={destination} setOrigin={setOrigin} setDestination={setDestination} onContinue={startJourney} onStart={startJourney} saving={createJourneyMutation.isPending} />;
      case '/journey/live': return <LiveJourney stage={stage} active={activeJourney?.status === 'active' || journeyActive} scenario={scenario} journey={activeJourney} onRisk={() => nextFlow(3, '/risk')} onFinish={() => void updateJourneyStatus('arrived')} onStop={() => void updateJourneyStatus('cancelled')} />;
      case '/risk': return <Risk scenario={scenario} onContinue={() => nextFlow(4, '/verify')} />;
      case '/verify': return <Verify scenario={scenario} onConfirmSafe={async () => { if (activeIncident) { const event = await runAction(() => createEventMutation.mutateAsync({ incidentId: activeIncident.id, data: { eventType: 'user_confirmed_safe' } })); if (event) setIncidentSnapshot({ ...activeIncident, responseStatus: 'resolved', verificationStatus: 'confirmed_safe', events: [...activeIncident.events, event] }); } nextFlow(9, '/portal'); }} onRequestHelp={async () => { if (activeIncident) await runAction(() => createEventMutation.mutateAsync({ incidentId: activeIncident.id, data: { eventType: 'user_requested_help' } })); nextFlow(5, '/response'); }} />;
      case '/response': return <Response incident={activeIncident} onContact={() => { switchDemoRole('emergency_contact'); setStage(6); navigate('/contact'); }} onResponder={() => { switchDemoRole('responder'); setStage(7); navigate('/responder'); }} onResolve={() => { if (activeIncident) void runAction(() => resolveIncidentMutation.mutateAsync({ incidentId: activeIncident.id, data: { details: { source: 'user_portal' } } })).then((result) => { if (result) { setIncidentSnapshot(result as IncidentRecord); setResolved(true); setStage(9); } }); }} />;
      case '/contact': return <Contact incident={activeIncident} journey={activeJourney} contactName={session.data?.user?.name ?? 'Trusted contact'} acknowledged={contactAcknowledged || Boolean(activeIncident?.events.some((event) => event.eventType === 'contact_acknowledged'))} shared={Boolean(activeJourney?.shareWithContacts)} onAcknowledge={async () => { if (activeIncident) await runAction(() => createEventMutation.mutateAsync({ incidentId: activeIncident.id, data: { eventType: 'contact_acknowledged' } })); setContactAcknowledged(true); setStage(6); }} onContinue={() => { switchDemoRole('responder'); nextFlow(7, '/responder'); }} />;
      case '/responder': return <Responder incident={activeIncident} accepted={responderAccepted || activeIncident?.responseStatus === 'responder_assigned' || activeIncident?.responseStatus === 'help_reached'} stage={stage} onAccept={async () => { if (!activeIncident) return; const result = await runAction(() => acceptIncidentMutation.mutateAsync({ incidentId: activeIncident.id })); if (result) { setIncidentSnapshot(result as IncidentRecord); setResponderAccepted(true); setStage(7); } }} onHelp={async () => { if (activeIncident) await runAction(() => createEventMutation.mutateAsync({ incidentId: activeIncident.id, data: { eventType: 'help_reached' } })); switchDemoRole('authority'); setStage(8); navigate('/authority'); }} onResolve={async () => { if (!activeIncident) return; const result = await runAction(() => resolveIncidentMutation.mutateAsync({ incidentId: activeIncident.id, data: { details: { source: 'responder_portal' } } })); if (result) { setIncidentSnapshot(result as IncidentRecord); setResolved(true); setStage(9); } }} onSetAvailability={async (availabilityStatus) => { await runAction(() => updateResponderStatusMutation.mutateAsync({ data: { availabilityStatus } })); }} onRegisterResponder={async (responderType) => Boolean(await runAction(() => registerResponderMutation.mutateAsync({ data: { responderType } })))} />;
      case '/authority': return <Authority role={session.data?.user?.role} incidents={activeIncidents} incident={activeIncident} resolved={resolved} onSelect={setSelectedIncidentId} onResolve={async () => { if (!activeIncident) return; const result = await runAction(() => resolveIncidentMutation.mutateAsync({ incidentId: activeIncident.id, data: { details: { source: 'authority_portal' } } })); if (result) { setIncidentSnapshot(result as IncidentRecord); setResolved(true); setStage(9); } }} />;
      case '/privacy': return <Privacy shared={activeJourney?.shareWithContacts ?? routeShared} privateMode={privateMode} onShared={async () => { if (activeJourney) { const result = await runAction(() => updateJourneySharingMutation.mutateAsync({ journeyId: activeJourney.id, data: { shareWithContacts: !activeJourney.shareWithContacts } })); if (result) setRouteShared(result.shareWithContacts); } else setRouteShared(!routeShared); }} onPrivate={async () => { const nextPrivate = !privateMode; setPrivateMode(nextPrivate); if (activeJourney && nextPrivate) { const result = await runAction(() => updateJourneySharingMutation.mutateAsync({ journeyId: activeJourney.id, data: { shareWithContacts: false } })); if (result) setRouteShared(false); } }} />;
      case '/demo': return <Demo scenario={scenario} onChoose={chooseScenario} />;
      default: return <NotFound onHome={() => navigate('/')} />;
    }
  };

  return (
    <div className={`aurix-shell${isHome ? ' home-shell' : ''}`}>
      <header className="topbar">
        <Link href="/" className="brand" data-testid="link-home-brand" aria-label="AURIX home">
          <span className="brand-mark"><Waves size={20} /></span>
          <span><span className="brand-name">AURIX</span><span className="brand-sub">URBAN RISK INTELLIGENCE</span></span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          {navigation.map(([href, label]) => <Link key={href} href={href} className={`nav-link${href === path ? ' active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</Link>)}
        </nav>
        <div className="top-actions">
          {import.meta.env.DEV && <label className="demo-role-picker"><span>DEMO ROLE</span><select value={demoRole} onChange={(event) => switchDemoRole(event.target.value as DemoRole)} aria-label="Choose development demo role"><option value="user">Journey user</option><option value="emergency_contact">Trusted contact</option><option value="responder">Responder</option><option value="authority">Authority</option><option value="clerk">Signed-in account</option></select></label>}
          <BackendStatus health={health.data} loading={health.isLoading} />
          <span className="sim-pill"><Crosshair size={12} /> {isDemoActor || session.data?.demoMode ? 'DEMO ENVIRONMENT' : 'CONNECTED SESSION'}</span>
          {clerkState.isSignedIn ? <button className="auth-link" onClick={() => void clerk.signOut({ redirectUrl: import.meta.env.BASE_URL })}><LogOut size={13} /> Sign out</button> : <Link className="auth-link" href="/sign-in"><LogIn size={13} /> Sign in</Link>}
        </div>
      </header>
      {actionError && <div className="action-alert" role="alert"><CircleHelp size={15} /><span>{actionError}</span><button onClick={() => setActionError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
      {renderPage()}
      <footer className="footer-note"><span>AURIX · Adaptive Urban Risk Intelligence eXchange</span><span>Prototype only. No real emergency services, dispatch, or live location connection.</span></footer>
    </div>
  );
}

function Eyebrow({ children }: { children: string }) { return <div className="eyebrow">{children}</div>; }
function Heading({ eyebrow, title, description, tag }: { eyebrow: string; title: string; description: string; tag?: string }) {
  return <div className="page-heading"><div><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1><p>{description}</p></div>{tag && <span className="tagline">{tag}</span>}</div>;
}
function Button({ children, onClick, href, variant = 'primary', testid, type = 'button', disabled = false }: { children: ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; testid: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  const className = `btn btn-${variant}${disabled ? ' disabled' : ''}`;
  if (href) return <Link href={href} className={className} data-testid={testid}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={className} data-testid={testid}>{children}</button>;
}
function BackendStatus({ health, loading }: { health: { status: string; database?: string; demoData?: boolean } | undefined; loading: boolean }) {
  const ready = health?.status === 'ok' && health.database === 'connected';
  const label = loading ? 'CHECKING' : ready ? 'API + DB ONLINE' : 'API DEGRADED';
  return <span className={`api-status${ready ? ' online' : loading ? ' checking' : ' degraded'}`} role="status" aria-label={`Backend status: ${label}`} title={health?.demoData ? 'Synthetic demo records are seeded.' : 'Synthetic demo records are not confirmed.'}>
    <span className="api-status-dot" />{label}
  </span>;
}
function SimNote({ children = 'All locations, routes, incidents, responder identities, and timing shown here are simulated for this prototype.' }: { children?: string }) {
  return <div className="sim-note" data-testid="notice-simulated"><Crosshair size={15} /><span><strong>SIMULATED DATA</strong> · {children}</span></div>;
}
function Chip({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' }) { return <span className={`status-chip ${tone}`}>{children}</span>; }
function FlowTrack({ stage }: { stage: number }) {
  return <div className="flow-track" aria-label="Journey progress">{flow.map((label, i) => <div key={label} className={`flow-step${i === stage ? ' current' : ''}${i < stage ? ' done' : ''}`} data-testid={`flow-step-${i}`}>
    <span className="flow-num">{i < stage ? <Check size={11} /> : String(i + 1).padStart(2, '0')}</span>{label}{i < flow.length - 1 && <ChevronRight size={11} />}
  </div>)}</div>;
}
function RouteMap({ deviation = false, stop = false }: { deviation?: boolean; stop?: boolean }) {
  return <div className="route-map" role="img" aria-label="Simulated map showing the expected route">
    <svg className="map-path" viewBox="0 0 600 320" preserveAspectRatio="none" aria-hidden="true">
      <path d="M92 250 C145 232 141 185 218 191 S294 132 348 153 S403 80 500 74" fill="none" stroke="#2ebaff" strokeWidth="3" strokeDasharray="7 7" />
      {deviation && <path d="M217 191 C255 220 312 235 363 213" fill="none" stroke="#edbd66" strokeWidth="3" strokeDasharray="5 6" />}
      {stop && <circle cx="295" cy="151" r="16" fill="none" stroke="#e8bb6c" strokeWidth="2" />}
    </svg>
    <span className="map-point" style={{ left: '15%', top: '74%' }} /><span className="map-point dest" style={{ left: '80%', top: '22%' }} />
    <span className="map-label" style={{ left: '10%', top: '80%' }}>CEDAR PARK</span><span className="map-label" style={{ left: '70%', top: '11%' }}>NORTHGATE</span>
    <span className="map-label" style={{ left: '41%', top: '43%' }}>{deviation ? 'ROUTE DEVIATION' : stop ? 'STOP DETECTED' : 'EXPECTED PATH'}</span>
    <span className="map-label" style={{ right: '3%', bottom: '4%' }}>SIMULATED MAP · NOT TO SCALE</span>
  </div>;
}

function Landing({ onBegin, onDemo }: { onBegin: () => void; onDemo: () => void }) {
  return <main className="page-wrap">
    <section className="hero-layout">
      <div><Eyebrow>PERSONAL SAFETY · COORDINATED RESPONSE</Eyebrow><h1 className="hero-title">Turning risk<br />into <em>response.</em></h1>
        <p className="hero-copy">AURIX brings journey awareness, quiet check-ins, and trusted people into one calm coordination experience. Designed to make the next step clear—not louder.</p>
        <div className="btn-row"><Button onClick={onBegin} testid="button-begin">Explore AURIX <ArrowRight size={15} /></Button><Button variant="secondary" onClick={onDemo} testid="button-demo-mode">Open Demo Mode <Activity size={15} /></Button></div>
        <div className="stat-strip"><div><strong>01</strong><span>One clear journey</span></div><div><strong>10</strong><span>Connected response steps</span></div><div><strong>0</strong><span>Live services connected</span></div></div>
      </div>
      <div className="hero-visual" aria-hidden="true"><div className="orb"><div className="orb-center"><ShieldCheck size={48} strokeWidth={1.2} /></div><div className="orb-caption">AWARENESS&nbsp;&nbsp; / &nbsp;&nbsp;TRUST&nbsp;&nbsp; / &nbsp;&nbsp;RESPONSE</div></div></div>
    </section>
    <section className="grid grid-3" style={{ marginTop: 30 }}>
      <div className="panel"><div className="small-label">01 / PREPARE</div><div className="metric" style={{ fontSize: 20 }}>A route with context</div><p className="panel-copy">Share an expected journey and define who should know if plans change.</p></div>
      <div className="panel"><div className="small-label">02 / NOTICE</div><div className="metric" style={{ fontSize: 20 }}>Signals, not noise</div><p className="panel-copy">A simulated risk layer notices route shifts and unexpected pauses before escalating.</p></div>
      <div className="panel"><div className="small-label">03 / COORDINATE</div><div className="metric" style={{ fontSize: 20 }}>People in the loop</div><p className="panel-copy">Walk through a clear sequence from private check-in to trusted contact and responder.</p></div>
    </section>
    <div className="notice-banner" style={{ marginTop: 16 }}><Shield size={17} />AURIX is a frontend-only prototype. It does not contact emergency services or dispatch responders. Every location and incident in this demo is simulated.</div>
  </main>;
}

function Roles() {
  const roles = [
    { icon: UserRound, title: 'Journey user', text: 'Plan a trip, monitor a route, and move through safety check-ins.', link: '/portal', label: 'Open user portal' },
    { icon: HeartHandshake, title: 'Trusted contact', text: 'See a shared simulated journey and acknowledge an update.', link: '/contact', label: 'Open contact portal' },
    { icon: BadgeCheck, title: 'Verified responder', text: 'Review a simulated request and update your response status.', link: '/responder', label: 'Open responder portal' },
    { icon: ShieldAlert, title: 'Authority view', text: 'Review a prototype incident overview and resolution state.', link: '/authority', label: 'Open authority portal' },
  ];
  return <main className="page-wrap"><Heading eyebrow="AURIX / ACCESS" title="Choose your view." description="Each portal is a separate window into the same simulated coordination flow. No account or real dispatch is involved." tag="PROTOTYPE PORTALS" />
    <section className="grid grid-2">{roles.map(({ icon: Icon, title, text, link, label }) => <Link href={link} key={link} className="panel role-card" data-testid={`link-role-${title.toLowerCase().replaceAll(' ', '-')}`}><div className="role-icon"><Icon size={20} /></div><h2 className="panel-title">{title}</h2><p className="panel-copy">{text}</p><div className="btn-row"><span className="btn btn-secondary">{label}<ArrowRight size={14} /></span></div></Link>)}</section>
    <div className="btn-row"><Button href="/journey/start" variant="quiet" testid="link-start-journey"><ArrowLeft size={14} /> Start a journey</Button></div>
  </main>;
}

function Portal({
  onBegin,
  userName,
  journey,
  contacts,
  contactsLoading,
  onAddContact,
}: {
  onBegin: () => void;
  userName: string;
  journey: JourneyRecord | null;
  contacts: ContactRecord[];
  contactsLoading: boolean;
  onAddContact: (contact: { name: string; email: string; phone: string; relationship: string }) => Promise<boolean>;
}) {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const submitContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingContact(true);
    setContactMessage('');
    const saved = await onAddContact({
      name: contactName.trim(),
      email: contactEmail.trim(),
      phone: contactPhone.trim(),
      relationship: relationship.trim(),
    });
    setSavingContact(false);
    if (saved) {
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setRelationship('');
      setContactMessage('Invitation saved. Access is enabled only after the invitee signs in with this verified email.');
    } else {
      setContactMessage('The invitation could not be saved. Check the API message above and try again.');
    }
  };
  return <main className="page-wrap"><Heading eyebrow="USER PORTAL / OVERVIEW" title="Your journey, in view." description="A quiet home base for trip planning, check-ins, and the people you choose to keep informed." />
    <div className="grid grid-3">
      <div className="panel"><div className="small-label">JOURNEY STATUS</div><div className="metric">{journey ? journey.status.replaceAll('_', ' ') : 'Ready'}</div><div className="metric-caption">{journey ? `Active route to ${journey.destination}` : `No active journey for ${userName}`}</div><div className="btn-row"><Button onClick={onBegin} testid="button-start-journey">Start journey <ArrowRight size={14} /></Button></div></div>
      <div className="panel"><div className="small-label">TRUSTED CONTACTS</div><div className="metric" style={{ fontSize: 21 }}>{contacts.length} saved</div><div className="metric-caption">{contacts.filter(contact => contact.verified).length} verified · {contacts.filter(contact => !contact.verified).length} awaiting sign-in</div><div className="btn-row"><Button href="/privacy" variant="secondary" testid="link-privacy-controls">Privacy controls <KeyRound size={14} /></Button></div></div>
      <div className="panel"><div className="small-label">SAFETY CHECK-IN</div><div className="metric" style={{ fontSize: 21 }}>Available</div><div className="metric-caption">Silent verification is a prototype interaction</div><div className="btn-row"><Button href="/verify" variant="secondary" testid="link-open-verification">View verification <Fingerprint size={14} /></Button></div></div>
    </div>
    <div className="grid grid-2" style={{ marginTop: 16 }}>
      <div className="panel"><h2 className="panel-title">AURIX in three moves</h2><div className="timeline" style={{ marginTop: 18 }}><Timeline icon={<Route size={12} />} title="Set an expected route" detail="Choose the path and timing you expect." /><Timeline icon={<Eye size={12} />} title="Keep a quiet watch" detail="Review simulated route events and risk cues." /><Timeline icon={<Users size={12} />} title="Bring the right people in" detail="Step through trusted contacts and responder roles." /></div></div>
      <div className="panel"><h2 className="panel-title">Continue exploring</h2><p className="panel-copy">Try a normal trip first, then use Demo Mode to reveal edge cases.</p><div className="btn-row"><Button href="/demo" variant="secondary" testid="link-open-demo">Open Demo Mode <Activity size={14} /></Button><Button href="/roles" variant="quiet" testid="link-view-portals">View all portals <ArrowRight size={14} /></Button></div><div style={{ marginTop: 20 }}><SimNote /></div></div>
    </div>
    <div className="grid grid-2" style={{ marginTop: 16 }}>
      <section className="panel"><div className="small-label">SAVED TRUSTED CONTACTS</div>
        {contactsLoading ? <p className="panel-copy" style={{ marginTop: 12 }}>Loading contacts…</p> : contacts.length ? <div className="timeline" style={{ marginTop: 12 }}>{contacts.map(contact => <Timeline key={contact.id} icon={<UserRound size={12} />} title={contact.name} detail={`${contact.relationship} · ${contact.email ?? contact.phone} · ${contact.verified ? 'verified access' : 'invitation pending'}`} />)}</div> : <p className="panel-copy" style={{ marginTop: 12 }}>No contacts saved yet. Add someone you trust; their access remains disabled until they verify their account.</p>}
      </section>
      <form className="panel contact-form" onSubmit={submitContact}><div className="small-label">ADD A TRUSTED CONTACT</div>
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <div className="field"><label className="field-label" htmlFor="contact-name">Name</label><input id="contact-name" className="form-control" value={contactName} onChange={event => setContactName(event.target.value)} required maxLength={120} /></div>
          <div className="field"><label className="field-label" htmlFor="contact-email">Email</label><input id="contact-email" type="email" className="form-control" value={contactEmail} onChange={event => setContactEmail(event.target.value)} required /></div>
          <div className="field"><label className="field-label" htmlFor="contact-phone">Phone</label><input id="contact-phone" type="tel" className="form-control" value={contactPhone} onChange={event => setContactPhone(event.target.value)} required /></div>
          <div className="field"><label className="field-label" htmlFor="contact-relationship">Relationship</label><input id="contact-relationship" className="form-control" value={relationship} onChange={event => setRelationship(event.target.value)} required maxLength={80} /></div>
        </div>
        <div className="btn-row"><Button type="submit" testid="button-add-contact" disabled={savingContact}>{savingContact ? 'Saving…' : 'Save invitation'} <Plus size={14} /></Button></div>
        {contactMessage && <p className="form-feedback" role="status">{contactMessage}</p>}
      </form>
    </div>
  </main>;
}
function Timeline({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <div className="timeline-item"><div className="timeline-icon">{icon}</div><div className="timeline-text"><strong>{title}</strong><span>{detail}</span></div></div>; }

function JourneyStart({ origin, destination, setOrigin, setDestination, onContinue, onStart, saving }: { origin: string; destination: string; setOrigin: (v: string) => void; setDestination: (v: string) => void; onContinue: () => void; onStart: () => void; saving: boolean }) {
  return <main className="page-wrap"><Heading eyebrow="JOURNEY / 01" title="Set your expected route." description="Create a simple plan. AURIX will use it as context for this local simulation—not as live GPS." tag="SIMULATED GPS" />
    <FlowTrack stage={0} />
    <div className="split-layout"><section className="panel"><div className="small-label">TRIP DETAILS</div>
      <div className="field"><label className="field-label" htmlFor="origin">Starting point</label><input id="origin" className="form-control" value={origin} onChange={e => setOrigin(e.target.value)} data-testid="input-origin" /></div>
      <div className="field"><label className="field-label" htmlFor="destination">Destination</label><input id="destination" className="form-control" value={destination} onChange={e => setDestination(e.target.value)} data-testid="input-destination" /></div>
      <div className="grid grid-2"><div><div className="small-label">ESTIMATED DURATION</div><div style={{ marginTop: 8, fontSize: 13 }}>24 minutes</div></div><div><div className="small-label">CHECK-IN WINDOW</div><div style={{ marginTop: 8, fontSize: 13 }}>Every 8 minutes</div></div></div>
      <div className="btn-row"><Button onClick={onContinue} variant="secondary" testid="button-preview-route" disabled={saving}>Preview expected route <Route size={14} /></Button><Button onClick={onStart} testid="button-confirm-start" disabled={saving}>{saving ? 'Saving journey…' : 'Start journey'} <ArrowRight size={14} /></Button></div>
    </section><section className="panel"><div className="small-label">EXPECTED ROUTE · SIMULATED</div><div style={{ margin: '15px 0' }}><RouteMap /></div><div className="grid grid-2"><div><div className="small-label">FROM</div><div style={{ fontSize: 11, marginTop: 5 }}>{origin || 'Not set'}</div></div><div><div className="small-label">TO</div><div style={{ fontSize: 11, marginTop: 5 }}>{destination || 'Not set'}</div></div></div><div style={{ marginTop: 17 }}><SimNote>Map, route, ETA, and GPS markers are illustrative demo data only.</SimNote></div></section></div>
  </main>;
}

function LiveJourney({ stage, active, scenario, journey, onRisk, onFinish, onStop }: { stage: number; active: boolean; scenario: Scenario; journey: JourneyRecord | null; onRisk: () => void; onFinish: () => void; onStop: () => void }) {
  const deviation = scenario === 'Route Deviation';
  const stop = scenario === 'Unexpected Stop';
  return <main className="page-wrap"><Heading eyebrow="JOURNEY / LIVE" title={active ? 'A calm eye on the route.' : 'Live monitoring.'} description="Follow the expected journey and see how simulated events become useful context for a response." tag="LOCAL SIMULATION" />
    <FlowTrack stage={Math.max(2, stage)} />
    <div className="split-layout"><section className="panel"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 14 }}><div><h2 className="panel-title">{journey?.currentLocation?.label ?? 'Cedar Park Station'} → {journey?.destination ?? 'Northgate Community Centre'}</h2><p className="panel-copy">Journey {journey ? `#${journey.id} · ${journey.status}` : 'is not yet saved'} · synthetic route</p></div><Chip tone={active ? 'green' : 'amber'}><span className="pulse-dot" style={{ width: 6, height: 6 }} />{active ? 'MONITORING' : 'PAUSED'}</Chip></div><RouteMap deviation={deviation} stop={stop} /><div className="grid grid-3" style={{ marginTop: 14 }}><Metric label="CURRENT POSITION" value={deviation ? '0.8 km off · simulated' : 'On expected path · simulated'} /><Metric label="NEXT CHECK-IN" value="In 04:18 · example" /><Metric label="CONTACT SHARING" value={journey?.shareWithContacts ? 'Enabled' : 'Off'} /></div></section>
      <aside className="panel"><div className="small-label">JOURNEY ACTIVITY</div><div style={{ marginTop: 18 }} className="timeline"><Timeline icon={<Check size={12} />} title="Journey started" detail="Cedar Park Station · simulated 18:18" /><Timeline icon={<Navigation size={12} />} title={deviation ? 'Route deviation noticed' : stop ? 'Unexpected stop noticed' : 'Movement looks expected'} detail={deviation ? 'A short distance outside the planned path.' : stop ? 'No movement detected for 3 minutes.' : 'No risk indicators in this example.'} /><Timeline icon={<Bell size={12} />} title="Trusted contact is on standby" detail="Simulated sharing only; no message sent." /></div>
        <div className="notice-banner" style={{ marginTop: 10 }}>{deviation || stop ? <ShieldAlert size={16} /> : <CircleHelp size={16} />}{deviation || stop ? 'A simulated risk signal is ready for review.' : 'This interface does not track a real device.'}</div>
        <div className="btn-row"><Button onClick={onRisk} testid="button-review-risk">Review risk signal <ArrowRight size={14} /></Button><Button onClick={onFinish} variant="secondary" testid="button-mark-arrived">Mark arrived <CheckCircle2 size={14} /></Button><Button onClick={onStop} variant="quiet" testid="button-end-journey">End journey</Button></div>
      </aside>
    </div>
  </main>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div><div className="small-label">{label}</div><div style={{ fontSize: 11, marginTop: 6 }}>{value}</div></div>; }

function Risk({ scenario, onContinue }: { scenario: Scenario; onContinue: () => void }) {
  const incident = scenario === 'New Incident — No History';
  const deviation = scenario === 'Route Deviation';
  const stop = scenario === 'Unexpected Stop';
  return <main className="page-wrap"><Heading eyebrow="AURIX SIGNAL / 03" title="A signal, with context." description="Risk detection combines route context and a small set of simulated cues. It does not make a real-world threat assessment." tag="SIMULATED AI" />
    <FlowTrack stage={3} />
    <div className="split-layout"><section className="panel"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}><div><div className="small-label">RISK PROFILE</div><div className="metric" style={{ fontSize: 26 }}>{incident ? 'Elevated' : deviation || stop ? 'Review suggested' : 'Low · no anomaly'}</div><p className="panel-copy">{incident ? 'A new incident scenario is active with no prior journey history.' : deviation ? 'Position is outside the expected path. Verify with the user before any next step.' : stop ? 'An unexpected stationary period was identified in the example.' : 'No deviation or unplanned stop appears in the normal journey scenario.'}</p></div><div className="role-icon"><Sparkles size={19} /></div></div>
      <div className="grid grid-3" style={{ marginTop: 22 }}><Metric label="ROUTE MATCH" value={incident ? 'No history' : deviation ? '72%' : '98.4%'} /><Metric label="MOTION SIGNAL" value={stop ? 'Stationary' : 'Consistent'} /><Metric label="CONFIDENCE" value="Prototype only" /></div>
      <div className={`notice-banner${deviation || stop || incident ? ' warning' : ''}`} style={{ marginTop: 20 }}><ShieldAlert size={17} />{incident ? 'No previous route is available. AURIX avoids assuming this signal is harmless.' : deviation || stop ? 'Recommended next step: use silent verification to check in before escalating.' : 'This normal-path example has no active incident. Explore a demo scenario to test the response flow.'}</div>
      <div className="btn-row"><Button onClick={onContinue} testid="button-continue-verify">Continue to silent verification <ArrowRight size={14} /></Button><Button href="/demo" variant="secondary" testid="link-change-scenario">Change scenario</Button></div>
    </section><aside><div className="panel"><div className="small-label">OBSERVED SIGNALS</div><div style={{ marginTop: 17 }} className="timeline"><Timeline icon={<Route size={12} />} title={deviation ? 'Off-route position' : 'Route adherence'} detail={incident ? 'No baseline; first event in this scenario.' : deviation ? 'Simulated location differs from planned corridor.' : 'Simulated path remains near expectation.'} /><Timeline icon={<Clock3 size={12} />} title={stop ? 'Unplanned pause' : 'Timing pattern'} detail={stop ? 'Movement paused for three example minutes.' : 'No unusual stop in this scenario.'} /><Timeline icon={<Database size={12} />} title={incident ? 'No history available' : 'Prior journey context'} detail={incident ? 'A fresh profile is treated cautiously.' : 'Synthetic journey context only.'} /></div></div><div style={{ marginTop: 14 }}><SimNote>All signal inputs and any risk classification are synthetic and non-operational.</SimNote></div></aside></div>
  </main>;
}

function Verify({ scenario, onConfirmSafe, onRequestHelp }: { scenario: Scenario; onConfirmSafe: () => void; onRequestHelp: () => void }) {
  const noReply = scenario === "User Doesn't Respond";
  const askedHelp = scenario === 'User Requests Help';
  return <main className="page-wrap"><Heading eyebrow="CHECK-IN / 04" title="A quiet check-in." description="Silent verification gives the user a private way to confirm they are okay—or request help—before the coordination step." tag="NO REAL ALERTS" /><FlowTrack stage={4} />
    <div className="grid grid-2"><section className="panel" style={{ textAlign: 'center', padding: '34px 24px' }}><div className="role-icon" style={{ margin: '0 auto 18px' }}><Fingerprint size={22} /></div><div className="small-label">PRIVATE VERIFICATION WINDOW</div><div className="metric" style={{ fontSize: 24 }}>{noReply ? 'No response yet' : askedHelp ? 'Help requested' : 'Check-in sent'}</div><p className="panel-copy" style={{ maxWidth: 390, margin: '9px auto 0' }}>{noReply ? 'The simulated timer expired without an acknowledgement. ResponseChain can now begin.' : askedHelp ? 'The user selected a request for help in Demo Mode.' : 'A soft check-in is ready. In this prototype, nothing is delivered to a real device.'}</p><div className="btn-row" style={{ justifyContent: 'center' }}><Button variant="secondary" onClick={onConfirmSafe} testid="button-im-ok"><CheckCircle2 size={14} /> I'm okay</Button><Button onClick={onRequestHelp} testid="button-request-help"><ShieldAlert size={14} /> I need help</Button></div><div style={{ marginTop: 20 }}><SimNote>These actions save synthetic status and audit events; no notification is sent.</SimNote></div></section>
      <aside className="panel"><div className="small-label">VERIFICATION SEQUENCE</div><div style={{ marginTop: 20 }} className="timeline"><Timeline icon={<Radio size={12} />} title="Private prompt" detail="A quiet check-in is shown to the user." /><Timeline icon={<Clock3 size={12} />} title={noReply ? 'Window elapsed' : 'Response window'} detail={noReply ? 'Scenario: user does not respond.' : 'Waiting state is simulated in this view.'} /><Timeline icon={<Users size={12} />} title="Escalation choice" detail="Continue into a local coordination storyboard." /></div><div className="notice-banner" style={{ marginTop: 8 }}><KeyRound size={16} />No audio, calls, messages, or real location data are collected.</div></aside></div>
  </main>;
}

function Response({ incident, onContact, onResponder, onResolve }: { incident: IncidentRecord | null; onContact: () => void; onResponder: () => void; onResolve: () => void }) {
  const eventDetails = incident?.events.length
    ? incident.events.map(event => <Timeline key={event.id} icon={<Activity size={12} />} title={eventLabel(event.eventType)} detail={`${new Date(event.timestamp).toLocaleString()} · saved event`} />)
    : <Timeline icon={<CircleHelp size={12} />} title="No response events yet" detail="Choose a demo action to add a synthetic audit event." />;
  return <main className="page-wrap"><Heading eyebrow="RESPONSECHAIN / 05" title="A clear chain of care." description="A coordinated sequence keeps each handoff visible. In this prototype, every actor and acknowledgement is simulated in the browser." tag="NO DISPATCH" /><FlowTrack stage={5} />
    <div className="split-layout"><section className="panel"><div className="small-label">INCIDENT COORDINATION · SYNTHETIC RECORD</div><div className="notice-banner warning" style={{ margin: '15px 0 18px' }}><Siren size={17} />This is a prototype incident record. No outside party has been contacted.</div>
      <div className="incident-summary"><span>Incident {incident ? `#${incident.id}` : 'not selected'}</span><strong>{incident ? `${incident.incidentType.replaceAll('_', ' ')} · ${incident.responseStatus.replaceAll('_', ' ')}` : 'No active incident'}</strong></div>
      <div className="timeline">{eventDetails}</div>
      <div className="btn-row"><Button onClick={onContact} testid="button-notify-contact">Continue to trusted contact <ArrowRight size={14} /></Button><Button variant="secondary" onClick={onResponder} testid="button-open-responder">View responder portal <BadgeCheck size={14} /></Button></div></section>
      <aside className="panel"><div className="small-label">RESPONSE STATUS</div><div className="metric" style={{ fontSize: 22 }}>{incident?.responseStatus.replaceAll('_', ' ') ?? 'Coordination ready'}</div><div className="metric-caption">Status and event history come from the API.</div><div style={{ marginTop: 20 }} className="grid"><Metric label="CONTACT ACKNOWLEDGEMENT" value={incident?.events.some(event => event.eventType === 'contact_acknowledged') ? 'Recorded' : 'Not recorded'} /><Metric label="RESPONDER ASSIGNMENT" value={incident?.responseStatus === 'responder_assigned' || incident?.responseStatus === 'help_reached' ? 'Assigned' : 'Not assigned'} /><Metric label="LOCATION DATA" value="Synthetic coordinates only" /></div><div className="btn-row"><Button onClick={onResolve} variant="secondary" testid="button-resolve-incident" disabled={!incident || incident.responseStatus === 'resolved'}>Mark incident resolved <CheckCircle2 size={14} /></Button></div></aside></div>
  </main>;
}

function eventLabel(eventType: string) {
  return eventType.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Contact({ incident, journey, contactName, acknowledged, shared, onAcknowledge, onContinue }: { incident: IncidentRecord | null; journey: JourneyRecord | null; contactName: string; acknowledged: boolean; shared: boolean; onAcknowledge: () => void; onContinue: () => void }) {
  return <main className="page-wrap"><Heading eyebrow="TRUSTED CONTACT / 06" title="A familiar person, in the loop." description="This portal previews the kind of concise update a trusted contact might receive. It is not actually sent." tag="SIMULATED CONTACT" /><FlowTrack stage={6} />
    <div className="grid grid-2"><section className="panel"><div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><div className="role-icon" style={{ margin: 0 }}><UserRound size={20} /></div><div><h2 className="panel-title">{contactName}</h2><p className="panel-copy">Signed-in trusted contact · limited shared view</p></div><Chip tone={acknowledged ? 'green' : 'amber'}>{acknowledged ? 'ACKNOWLEDGED' : 'UPDATE READY'}</Chip></div><div className="notice-banner" style={{ marginTop: 22 }}><MapPin size={16} />{shared ? `Synthetic journey context: ${journey?.destination ?? 'destination not available'}. No live location is connected.` : 'Route sharing is off. The contact cannot view journey location details.'}</div><div style={{ marginTop: 18 }}><div className="small-label">SHARED TRIP CONTEXT</div><div style={{ marginTop: 10 }}>{shared ? <RouteMap deviation /> : <div className="panel" style={{ textAlign: 'center', minHeight: 210, display: 'grid', placeItems: 'center' }}><div><Shield size={23} style={{ color: '#65caff', marginBottom: 10 }} /><div className="panel-title">Location hidden</div><p className="panel-copy">The user has paused route sharing.</p></div></div>}</div></div><div className="incident-summary"><span>Visible incident</span><strong>{incident ? `#${incident.id} · ${incident.responseStatus.replaceAll('_', ' ')}` : 'No shared active incident'}</strong></div><div className="btn-row"><Button onClick={onAcknowledge} testid="button-acknowledge-update" disabled={!incident || acknowledged}>{acknowledged ? 'Acknowledged' : 'Acknowledge update'} <Check size={14} /></Button><Button onClick={onContinue} variant="secondary" testid="button-continue-responder">Continue to responder <ArrowRight size={14} /></Button></div></section>
      <aside className="panel"><div className="small-label">WHAT THIS CONTACT CAN SEE</div><div className="timeline" style={{ marginTop: 20 }}><Timeline icon={<MapPin size={12} />} title="Shared route snapshot" detail={shared ? 'Only while the journey owner has enabled sharing.' : 'Hidden until the journey owner explicitly enables sharing.'} /><Timeline icon={<Clock3 size={12} />} title="Check-in status" detail={incident ? `${incident.verificationStatus.replaceAll('_', ' ')} · synthetic event` : 'No shared incident details are available.'} /><Timeline icon={<Shield size={12} />} title="Limited incident context" detail="No responder-only or authority-only details are exposed." /></div><div style={{ marginTop: 10 }}><SimNote>Contact and trip information is synthetic. No message is sent.</SimNote></div></aside></div>
  </main>;
}

function Responder({ incident, accepted, stage, onAccept, onHelp, onResolve, onRegisterResponder, onSetAvailability }: { incident: IncidentRecord | null; accepted: boolean; stage: number; onAccept: () => void; onHelp: () => void; onResolve: () => void; onRegisterResponder: (type: string) => Promise<boolean>; onSetAvailability: (status: 'available' | 'offline') => Promise<void> }) {
  const reached = stage >= 8;
  const [responderType, setResponderType] = useState('Community safety partner');
  const [profileMessage, setProfileMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    const saved = await onRegisterResponder(responderType.trim());
    setSavingProfile(false);
    setProfileMessage(saved ? 'Responder profile saved.' : 'Profile could not be saved; check the API status and role.');
  };
  return <main className="page-wrap"><Heading eyebrow="RESPONDER PORTAL / 07" title="A verified handoff." description="Review a synthetic responder card and advance the storyboard. No real responders are available through AURIX." tag="SIMULATED RESPONDER" /><FlowTrack stage={Math.max(7, stage)} />
    <div className="split-layout"><section className="panel"><div className="small-label">RESPONDER PROFILE · VERIFIED ROLE</div><form className="responder-profile-form" onSubmit={saveProfile}><div className="field"><label className="field-label" htmlFor="responder-type">Responder organization or type</label><input id="responder-type" className="form-control" value={responderType} onChange={event => setResponderType(event.target.value)} maxLength={120} required /></div><Button type="submit" testid="button-save-responder-profile" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save responder profile'} <BadgeCheck size={14} /></Button></form>{profileMessage && <p className="form-feedback" role="status">{profileMessage}</p>}
      <div style={{ display: 'flex', gap: 15, alignItems: 'center', margin: '19px 0' }}><div className="role-icon" style={{ width: 54, height: 54, margin: 0 }}><UserRound size={24} /></div><div style={{ flex: 1 }}><h2 className="panel-title" style={{ fontSize: 17 }}>Verified responder</h2><p className="panel-copy">{responderType} · synthetic account</p></div><Chip tone="green"><BadgeCheck size={12} /> VERIFIED ROLE</Chip></div>
      <div className="incident-summary"><span>Actionable incident</span><strong>{incident ? `#${incident.id} · ${incident.incidentType.replaceAll('_', ' ')}` : 'No active incident available'}</strong></div>
      {incident && <div className="grid grid-3"><Metric label="RISK" value={incident.riskLevel} /><Metric label="STATUS" value={reached ? 'Help reached' : accepted ? 'Accepted' : 'Available'} /><Metric label="LOCATION" value="Synthetic coordinates" /></div>}
      <div className="notice-banner" style={{ marginTop: 19 }}>{reached ? <CheckCircle2 size={16} /> : <Navigation size={16} />}{reached ? 'Help reached — recorded as a simulated status, not a real-world arrival.' : 'Incident details are limited. No victim identity, phone, destination, or live GPS is shared with responders.'}</div>
      <div className="btn-row">{!accepted && <Button onClick={onAccept} testid="button-accept-response" disabled={!incident}>Accept simulated request <Check size={14} /></Button>}{accepted && <Button onClick={onHelp} testid="button-mark-help-reached" disabled={!incident || reached}>Record help reached <MapPin size={14} /></Button>}<Button onClick={onResolve} variant="secondary" testid="button-resolve-from-responder" disabled={!incident || incident.responseStatus === 'resolved'}>Resolve incident <CheckCircle2 size={14} /></Button><Button onClick={() => void onSetAvailability('offline')} variant="quiet" testid="button-responder-offline">Set offline</Button><Button onClick={() => void onSetAvailability('available')} variant="quiet" testid="button-responder-available">Set available</Button></div>
    </section><aside className="panel"><div className="small-label">HANDOFF CHECKLIST</div><div style={{ marginTop: 20 }} className="timeline"><Timeline icon={<Check size={12} />} title="Identity verified" detail="Responder eligibility comes from server-side role configuration." /><Timeline icon={<ArrowDownRight size={12} />} title="Request accepted" detail={accepted ? 'Assignment is recorded by the API.' : 'Accept an available synthetic incident to claim it.'} /><Timeline icon={<MapPin size={12} />} title="Help reached" detail={reached ? 'Milestone is saved in the event history.' : 'The next state is a simulation only.'} /></div><div style={{ marginTop: 12 }}><SimNote>No real responder network or dispatch is connected.</SimNote></div></aside></div>
  </main>;
}

function Authority({ role, incidents, incident, resolved, onResolve, onSelect }: { role: string | undefined; incidents: IncidentRecord[]; incident: IncidentRecord | null; resolved: boolean; onResolve: () => void; onSelect: (id: number) => void }) {
  const eventRows = incident?.events.length
    ? incident.events.map(event => <Event key={event.id} title={eventLabel(event.eventType)} detail={`${new Date(event.timestamp).toLocaleString()} · ${JSON.stringify(event.details)}`} time="saved" />)
    : <p className="panel-copy">No event history is available for this incident.</p>;
  return <main className="page-wrap"><Heading eyebrow="AUTHORITY PORTAL / 08" title="Incident overview." description="A read-only coordination view for a simulated incident, its audit trail, and its resolution state." tag="DEMO RECORD" />
    {role !== 'authority' && <div className="notice-banner warning" style={{ marginBottom: 16 }}><ShieldAlert size={15} />This account can see only incidents allowed by its role. Select the Authority demo role in development to view all synthetic records.</div>}
    <div className="grid grid-3"><div className="panel"><div className="small-label">CASE REFERENCE</div><div className="metric" style={{ fontSize: 20 }}>{incident ? `AX-${incident.id}` : 'No active case'}</div><div className="metric-caption">Synthetic database record</div></div><div className="panel"><div className="small-label">CURRENT STATE</div><div className="metric" style={{ fontSize: 20 }}>{resolved || incident?.responseStatus === 'resolved' ? 'Resolved' : incident?.responseStatus.replaceAll('_', ' ') ?? 'No active incident'}</div><div className="metric-caption">{incident ? new Date(incident.detectedAt).toLocaleString() : 'No incident selected'}</div></div><div className="panel"><div className="small-label">SUBJECT</div><div className="metric" style={{ fontSize: 20 }}>{incident?.victim?.name ?? 'Not available'}</div><div className="metric-caption">{incident?.victim?.phone ?? 'No subject contact data'}</div></div></div>
    <div className="grid grid-2" style={{ marginTop: 16 }}><section className="panel"><div className="small-label">ACTIVE INCIDENTS · {incidents.length}</div>{incidents.length ? <div className="incident-selector">{incidents.map(item => <button key={item.id} className={`incident-select${incident?.id === item.id ? ' selected' : ''}`} onClick={() => onSelect(item.id)}><span>#{item.id} · {item.incidentType.replaceAll('_', ' ')}</span><strong>{item.responseStatus.replaceAll('_', ' ')}</strong></button>)}</div> : <p className="panel-copy" style={{ marginTop: 12 }}>There are no active incidents visible to this account.</p>}<div className="small-label" style={{ marginTop: 20 }}>EVENT RECORD</div><div style={{ marginTop: 12 }}>{eventRows}</div></section>
      <section className="panel"><div className="small-label">SITUATIONAL CONTEXT</div><div className="incident-summary"><span>Incident type / risk</span><strong>{incident ? `${incident.incidentType.replaceAll('_', ' ')} · ${incident.riskLevel}` : 'No incident selected'}</strong></div><div style={{ margin: '15px 0' }}><RouteMap deviation={incident?.incidentType === 'route_deviation'} stop={incident?.incidentType === 'unexpected_stop'} /></div><div className="grid grid-2"><Metric label="COORDINATES" value={incident ? `${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)} · synthetic` : 'Not available'} /><Metric label="DESTINATION" value={incident?.destination ?? 'Hidden or not set'} /></div><div className="btn-row"><Button onClick={onResolve} testid="button-authority-resolve" disabled={!incident || resolved || incident.responseStatus === 'resolved'}>{resolved || incident?.responseStatus === 'resolved' ? 'Resolved' : 'Record resolution'} <CheckCircle2 size={14} /></Button><Button href="/demo" variant="secondary" testid="link-authority-demo">Scenario controls</Button></div></section></div>
  </main>;
}
function Event({ title, detail, time }: { title: string; detail: string; time: string }) { return <div className="event-row"><div className="event-icon"><Activity size={14} /></div><div className="event-info"><strong>{title}</strong><span>{detail}</span></div><span className="event-time">{time}</span></div>; }

function Privacy({ shared, privateMode, onShared, onPrivate }: { shared: boolean; privateMode: boolean; onShared: () => void; onPrivate: () => void }) {
  return <main className="page-wrap"><Heading eyebrow="PRIVACY / CONTROL" title="You set the boundaries." description="AURIX shows what is shared and lets the journey owner pause contact access. Sharing preferences are stored with the journey." tag="SAVED CONTROLS" />
    <div className="split-layout"><section className="panel"><div className="small-label">JOURNEY SHARING PREFERENCES</div><PrivacyToggle title="Share journey with trusted contacts" detail="Allows verified contacts to see limited active journey context." checked={shared} onClick={onShared} testid="toggle-route-sharing" /><PrivacyToggle title="Private journey mode" detail="Turns off contact route sharing for the active journey." checked={privateMode} onClick={onPrivate} testid="toggle-private-mode" /><div className="notice-banner" style={{ marginTop: 20 }}><ShieldCheck size={16} />{privateMode ? 'Private mode is active. Contact route access has been turned off.' : shared ? 'Contact sharing is enabled on the active journey. You can switch it off at any time.' : 'Contact sharing is off. No journey route is visible to contacts.'}</div></section>
      <aside className="panel"><div className="small-label">DATA, EXPLAINED</div><div style={{ marginTop: 18 }} className="timeline"><Timeline icon={<Crosshair size={12} />} title="Location" detail="Coordinates are synthetic; the app does not request GPS permission." /><Timeline icon={<Database size={12} />} title="Storage" detail="Journeys, contacts, incidents, and response events are stored by the API." /><Timeline icon={<Users size={12} />} title="People" detail="Roles and ownership are checked on the server." /><Timeline icon={<X size={12} />} title="Emergency services" detail="No real calls, messages, dispatch, or integrations are connected." /></div></aside></div>
  </main>;
}
function PrivacyToggle({ title, detail, checked, onClick, testid }: { title: string; detail: string; checked: boolean; onClick: () => void; testid: string }) {
  return <button onClick={onClick} className="event-row" style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer' }} aria-pressed={checked} data-testid={testid}><div className="event-icon">{checked ? <Check size={15} /> : <X size={15} />}</div><div className="event-info"><strong>{title}</strong><span>{detail}</span></div><span className={`status-chip ${checked ? 'green' : 'amber'}`}>{checked ? 'ON' : 'OFF'}</span></button>;
}

const scenarios: { name: Scenario; desc: string }[] = [
  { name: 'Normal Journey', desc: 'Expected route; no alert signal.' },
  { name: 'Route Deviation', desc: 'Off-route cue → risk review.' },
  { name: 'Unexpected Stop', desc: 'Stationary cue → risk review.' },
  { name: 'New Incident — No History', desc: 'Elevated signal without prior context.' },
  { name: "User Doesn't Respond", desc: 'Verification window expires.' },
  { name: 'User Requests Help', desc: 'User opts into the response chain.' },
  { name: 'Responder Accepts', desc: 'A synthetic responder takes the request.' },
  { name: 'Help Reached', desc: 'Advance to the simulated arrival milestone.' },
];
function Demo({ scenario, onChoose }: { scenario: Scenario; onChoose: (scenario: Scenario) => void }) {
  return <main className="page-wrap"><Heading eyebrow="DEMO MODE / SCENARIOS" title="Choose what happens next." description="Scenarios change the local simulation and send you to the relevant next screen. Start with Normal Journey for the simplest path." tag="BROWSER STATE ONLY" />
    <section className="panel"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18 }}><div><h2 className="panel-title">Scenario controls</h2><p className="panel-copy">Selected: {scenario} · choose any card to jump into that moment.</p></div><Chip tone="blue"><Activity size={12} /> DEMO MODE</Chip></div>
      <div className="scenario-list">{scenarios.map(item => <button key={item.name} onClick={() => onChoose(item.name)} className={`scenario-btn${scenario === item.name ? ' selected' : ''}`} data-testid={`scenario-${item.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}><strong>{item.name}</strong><span>{item.desc}</span></button>)}</div>
      <div className="notice-banner" style={{ marginTop: 18 }}><CircleHelp size={16} />Selecting a scenario updates the active story and navigates to the appropriate step. Nothing is sent or dispatched.</div>
    </section>
    <section className="grid grid-3" style={{ marginTop: 16 }}><div className="panel"><div className="small-label">FAST PATH</div><h2 className="panel-title" style={{ marginTop: 12 }}>Normal → arrived</h2><p className="panel-copy">Start with a route, review monitoring, and mark the trip complete.</p><div className="btn-row"><Button href="/journey/start" variant="secondary" testid="link-demo-start-journey">Start journey <ArrowRight size={14} /></Button></div></div><div className="panel"><div className="small-label">RISK PATH</div><h2 className="panel-title" style={{ marginTop: 12 }}>Signal → check-in</h2><p className="panel-copy">Try a deviation or stop, then walk through verification.</p><div className="btn-row"><Button onClick={() => onChoose('Route Deviation')} variant="secondary" testid="button-demo-risk-path">Run risk scenario <ShieldAlert size={14} /></Button></div></div><div className="panel"><div className="small-label">COORDINATION PATH</div><h2 className="panel-title" style={{ marginTop: 12 }}>Contact → resolution</h2><p className="panel-copy">Explore all response roles, with each step explicitly simulated.</p><div className="btn-row"><Button onClick={() => onChoose('User Requests Help')} testid="button-demo-response-path">Run response scenario <ArrowRight size={14} /></Button></div></div></section>
  </main>;
}

function NotFound({ onHome }: { onHome: () => void }) {
  return <main className="page-wrap"><section className="panel"><Eyebrow>404 / ROUTE NOT FOUND</Eyebrow><h1 className="page-heading" style={{ display: 'block' }}>This path isn't in the exchange.</h1><p className="panel-copy">Return to the overview to explore the AURIX prototype.</p><div className="btn-row"><Button onClick={onHome} testid="button-return-home">Return home <ArrowRight size={14} /></Button></div></section></main>;
}

const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function appRelativePath(path: string) {
  return appBasePath && path.startsWith(appBasePath)
    ? path.slice(appBasePath.length) || '/'
    : path;
}

function AuthPage({ children }: { children: ReactNode }) {
  return <main className="auth-page">
    <Link href="/" className="brand auth-brand" aria-label="Return to AURIX">
      <span className="brand-mark"><Waves size={20} /></span>
      <span><span className="brand-name">AURIX</span><span className="brand-sub">URBAN RISK INTELLIGENCE</span></span>
    </Link>
    <section className="auth-card">{children}</section>
    <p className="auth-disclaimer">AURIX is a prototype. It does not contact emergency services or dispatch responders.</p>
  </main>;
}

function SignedInHome() {
  const { isLoaded, isSignedIn } = useUser();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (isLoaded && isSignedIn) navigate('/portal');
  }, [isLoaded, isSignedIn, navigate]);
  return <AppFrame />;
}

function ClerkRouterProvider() {
  const [, navigate] = useLocation();
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  return <ClerkProvider
    publishableKey={publishableKey}
    proxyUrl={import.meta.env.PROD ? '/api/__clerk' : undefined}
    appearance={dark}
    routerPush={(to) => navigate(appRelativePath(to))}
    routerReplace={(to) => navigate(appRelativePath(to), { replace: true })}
  >
    <Switch>
      <WouterRoute path="/sign-in">
        <AuthPage><SignIn routing="hash" signUpUrl={`${appBasePath}/sign-up`} forceRedirectUrl={`${appBasePath}/portal`} /></AuthPage>
      </WouterRoute>
      <WouterRoute path="/sign-up">
        <AuthPage><SignUp routing="hash" signInUrl={`${appBasePath}/sign-in`} forceRedirectUrl={`${appBasePath}/portal`} /></AuthPage>
      </WouterRoute>
      <WouterRoute path="/"><SignedInHome /></WouterRoute>
      <WouterRoute><AppFrame /></WouterRoute>
    </Switch>
  </ClerkProvider>;
}

function App() {
  return <QueryClientProvider client={appQueryClient}>
    <WouterRouter base={appBasePath}>
      <ClerkRouterProvider />
    </WouterRouter>
  </QueryClientProvider>;
}

export default App;