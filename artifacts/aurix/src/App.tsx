import { useState, type ReactNode } from 'react';
import { Link, Router as WouterRouter, useLocation } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, Bell,
  Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Crosshair,
  Database, Eye, Fingerprint, HeartHandshake, KeyRound, MapPin, Navigation,
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

  const startJourney = () => {
    setJourneyActive(true);
    setResolved(false);
    setStage(1);
    navigate('/journey/start');
  };
  const nextFlow = (to: number, routePath: string) => {
    setStage(to);
    navigate(routePath);
  };
  const chooseScenario = (choice: Scenario) => {
    setScenario(choice);
    setResolved(false);
    setJourneyActive(true);
    if (choice === 'Normal Journey') { setStage(2); navigate('/journey/live'); }
    else if (choice === 'Route Deviation' || choice === 'Unexpected Stop') { setStage(3); navigate('/risk'); }
    else if (choice === 'New Incident — No History') { setStage(3); navigate('/risk'); }
    else if (choice === "User Doesn't Respond") { setStage(4); navigate('/verify'); }
    else if (choice === 'User Requests Help') { setStage(5); navigate('/response'); }
    else if (choice === 'Responder Accepts') { setResponderAccepted(true); setStage(7); navigate('/responder'); }
    else { setResponderAccepted(true); setStage(8); navigate('/responder'); }
  };

  const isHome = path === '/';
  const renderPage = () => {
    switch (path) {
      case '/': return <Landing onBegin={() => navigate('/roles')} onDemo={() => navigate('/demo')} />;
      case '/roles': return <Roles />;
      case '/portal': return <Portal onBegin={startJourney} />;
      case '/journey/start': return <JourneyStart origin={origin} destination={destination} setOrigin={setOrigin} setDestination={setDestination} onContinue={() => nextFlow(1, '/journey/live')} onStart={startJourney} />;
      case '/journey/live': return <LiveJourney stage={stage} active={journeyActive} scenario={scenario} onRisk={() => nextFlow(3, '/risk')} onFinish={() => { setStage(9); setResolved(true); }} onStop={() => { setJourneyActive(false); setStage(0); navigate('/portal'); }} />;
      case '/risk': return <Risk scenario={scenario} onContinue={() => nextFlow(4, '/verify')} />;
      case '/verify': return <Verify scenario={scenario} onContinue={() => nextFlow(5, '/response')} />;
      case '/response': return <Response onContact={() => { setStage(6); navigate('/contact'); }} onResponder={() => { setStage(7); navigate('/responder'); }} onResolve={() => { setStage(9); setResolved(true); }} />;
      case '/contact': return <Contact acknowledged={contactAcknowledged} shared={routeShared && !privateMode} onAcknowledge={() => { setContactAcknowledged(true); setStage(6); }} onContinue={() => nextFlow(7, '/responder')} />;
      case '/responder': return <Responder accepted={responderAccepted} stage={stage} onAccept={() => { setResponderAccepted(true); setStage(7); }} onHelp={() => { setStage(8); navigate('/authority'); }} onResolve={() => { setStage(9); setResolved(true); }} />;
      case '/authority': return <Authority resolved={resolved} onResolve={() => { setResolved(true); setStage(9); }} />;
      case '/privacy': return <Privacy shared={routeShared} privateMode={privateMode} onShared={() => setRouteShared(!routeShared)} onPrivate={() => setPrivateMode(!privateMode)} />;
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
        <div className="top-actions"><span className="live-pill"><span className="pulse-dot" /> SIMULATION ACTIVE</span><span className="sim-pill"><Crosshair size={12} /> DEMO ENVIRONMENT</span></div>
      </header>
      {renderPage()}
      <footer className="footer-note"><span>AURIX · Adaptive Urban Risk Intelligence eXchange</span><span>Prototype only. No real emergency services, dispatch, or live location connection.</span></footer>
    </div>
  );
}

function Eyebrow({ children }: { children: string }) { return <div className="eyebrow">{children}</div>; }
function Heading({ eyebrow, title, description, tag }: { eyebrow: string; title: string; description: string; tag?: string }) {
  return <div className="page-heading"><div><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1><p>{description}</p></div>{tag && <span className="tagline">{tag}</span>}</div>;
}
function Button({ children, onClick, href, variant = 'primary', testid, type = 'button' }: { children: ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; testid: string; type?: 'button' | 'submit' }) {
  const className = `btn btn-${variant}`;
  if (href) return <Link href={href} className={className} data-testid={testid}>{children}</Link>;
  return <button type={type} onClick={onClick} className={className} data-testid={testid}>{children}</button>;
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

function Portal({ onBegin }: { onBegin: () => void }) {
  return <main className="page-wrap"><Heading eyebrow="USER PORTAL / OVERVIEW" title="Your journey, in view." description="A quiet home base for trip planning, check-ins, and the people you choose to keep informed." />
    <div className="grid grid-3">
      <div className="panel"><div className="small-label">JOURNEY STATUS</div><div className="metric">Ready</div><div className="metric-caption">No active journey</div><div className="btn-row"><Button onClick={onBegin} testid="button-start-journey">Start journey <ArrowRight size={14} /></Button></div></div>
      <div className="panel"><div className="small-label">TRUSTED CONTACT</div><div className="metric" style={{ fontSize: 21 }}>Maya Chen</div><div className="metric-caption">Simulated · route sharing enabled</div><div className="btn-row"><Button href="/privacy" variant="secondary" testid="link-privacy-controls">Privacy controls <KeyRound size={14} /></Button></div></div>
      <div className="panel"><div className="small-label">SAFETY CHECK-IN</div><div className="metric" style={{ fontSize: 21 }}>Available</div><div className="metric-caption">Silent verification is a prototype interaction</div><div className="btn-row"><Button href="/verify" variant="secondary" testid="link-open-verification">View verification <Fingerprint size={14} /></Button></div></div>
    </div>
    <div className="grid grid-2" style={{ marginTop: 16 }}>
      <div className="panel"><h2 className="panel-title">AURIX in three moves</h2><div className="timeline" style={{ marginTop: 18 }}><Timeline icon={<Route size={12} />} title="Set an expected route" detail="Choose the path and timing you expect." /><Timeline icon={<Eye size={12} />} title="Keep a quiet watch" detail="Review simulated route events and risk cues." /><Timeline icon={<Users size={12} />} title="Bring the right people in" detail="Step through trusted contacts and responder roles." /></div></div>
      <div className="panel"><h2 className="panel-title">Continue exploring</h2><p className="panel-copy">Try a normal trip first, then use Demo Mode to reveal edge cases.</p><div className="btn-row"><Button href="/demo" variant="secondary" testid="link-open-demo">Open Demo Mode <Activity size={14} /></Button><Button href="/roles" variant="quiet" testid="link-view-portals">View all portals <ArrowRight size={14} /></Button></div><div style={{ marginTop: 20 }}><SimNote /></div></div>
    </div>
  </main>;
}
function Timeline({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <div className="timeline-item"><div className="timeline-icon">{icon}</div><div className="timeline-text"><strong>{title}</strong><span>{detail}</span></div></div>; }

function JourneyStart({ origin, destination, setOrigin, setDestination, onContinue, onStart }: { origin: string; destination: string; setOrigin: (v: string) => void; setDestination: (v: string) => void; onContinue: () => void; onStart: () => void }) {
  return <main className="page-wrap"><Heading eyebrow="JOURNEY / 01" title="Set your expected route." description="Create a simple plan. AURIX will use it as context for this local simulation—not as live GPS." tag="SIMULATED GPS" />
    <FlowTrack stage={0} />
    <div className="split-layout"><section className="panel"><div className="small-label">TRIP DETAILS</div>
      <div className="field"><label className="field-label" htmlFor="origin">Starting point</label><input id="origin" className="form-control" value={origin} onChange={e => setOrigin(e.target.value)} data-testid="input-origin" /></div>
      <div className="field"><label className="field-label" htmlFor="destination">Destination</label><input id="destination" className="form-control" value={destination} onChange={e => setDestination(e.target.value)} data-testid="input-destination" /></div>
      <div className="grid grid-2"><div><div className="small-label">ESTIMATED DURATION</div><div style={{ marginTop: 8, fontSize: 13 }}>24 minutes</div></div><div><div className="small-label">CHECK-IN WINDOW</div><div style={{ marginTop: 8, fontSize: 13 }}>Every 8 minutes</div></div></div>
      <div className="btn-row"><Button onClick={onContinue} variant="secondary" testid="button-preview-route">Preview expected route <Route size={14} /></Button><Button onClick={onStart} testid="button-confirm-start">Start journey <ArrowRight size={14} /></Button></div>
    </section><section className="panel"><div className="small-label">EXPECTED ROUTE · SIMULATED</div><div style={{ margin: '15px 0' }}><RouteMap /></div><div className="grid grid-2"><div><div className="small-label">FROM</div><div style={{ fontSize: 11, marginTop: 5 }}>{origin || 'Not set'}</div></div><div><div className="small-label">TO</div><div style={{ fontSize: 11, marginTop: 5 }}>{destination || 'Not set'}</div></div></div><div style={{ marginTop: 17 }}><SimNote>Map, route, ETA, and GPS markers are illustrative demo data only.</SimNote></div></section></div>
  </main>;
}

function LiveJourney({ stage, active, scenario, onRisk, onFinish, onStop }: { stage: number; active: boolean; scenario: Scenario; onRisk: () => void; onFinish: () => void; onStop: () => void }) {
  const deviation = scenario === 'Route Deviation';
  const stop = scenario === 'Unexpected Stop';
  return <main className="page-wrap"><Heading eyebrow="JOURNEY / LIVE" title={active ? 'A calm eye on the route.' : 'Live monitoring.'} description="Follow the expected journey and see how simulated events become useful context for a response." tag="LOCAL SIMULATION" />
    <FlowTrack stage={Math.max(2, stage)} />
    <div className="split-layout"><section className="panel"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 14 }}><div><h2 className="panel-title">Cedar Park Station → Northgate</h2><p className="panel-copy">Expected arrival 18:42 · 24 min trip</p></div><Chip tone={active ? 'green' : 'amber'}><span className="pulse-dot" style={{ width: 6, height: 6 }} />{active ? 'MONITORING' : 'PAUSED'}</Chip></div><RouteMap deviation={deviation} stop={stop} /><div className="grid grid-3" style={{ marginTop: 14 }}><Metric label="CURRENT POSITION" value={deviation ? '0.8 km off' : 'On expected path'} /><Metric label="NEXT CHECK-IN" value="In 04:18" /><Metric label="SHARING" value="Maya Chen" /></div></section>
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

function Verify({ scenario, onContinue }: { scenario: Scenario; onContinue: () => void }) {
  const noReply = scenario === "User Doesn't Respond";
  const askedHelp = scenario === 'User Requests Help';
  return <main className="page-wrap"><Heading eyebrow="CHECK-IN / 04" title="A quiet check-in." description="Silent verification gives the user a private way to confirm they are okay—or request help—before the coordination step." tag="NO REAL ALERTS" /><FlowTrack stage={4} />
    <div className="grid grid-2"><section className="panel" style={{ textAlign: 'center', padding: '34px 24px' }}><div className="role-icon" style={{ margin: '0 auto 18px' }}><Fingerprint size={22} /></div><div className="small-label">PRIVATE VERIFICATION WINDOW</div><div className="metric" style={{ fontSize: 24 }}>{noReply ? 'No response yet' : askedHelp ? 'Help requested' : 'Check-in sent'}</div><p className="panel-copy" style={{ maxWidth: 390, margin: '9px auto 0' }}>{noReply ? 'The simulated timer expired without an acknowledgement. ResponseChain can now begin.' : askedHelp ? 'The user selected a request for help in Demo Mode.' : 'A soft check-in is ready. In this prototype, nothing is delivered to a real device.'}</p><div className="btn-row" style={{ justifyContent: 'center' }}><Button variant="secondary" onClick={onContinue} testid="button-im-ok"><CheckCircle2 size={14} /> I'm okay</Button><Button onClick={onContinue} testid="button-request-help"><ShieldAlert size={14} /> I need help</Button></div><div style={{ marginTop: 20 }}><SimNote>Buttons update local prototype state only; no notification is sent.</SimNote></div></section>
      <aside className="panel"><div className="small-label">VERIFICATION SEQUENCE</div><div style={{ marginTop: 20 }} className="timeline"><Timeline icon={<Radio size={12} />} title="Private prompt" detail="A quiet check-in is shown to the user." /><Timeline icon={<Clock3 size={12} />} title={noReply ? 'Window elapsed' : 'Response window'} detail={noReply ? 'Scenario: user does not respond.' : 'Waiting state is simulated in this view.'} /><Timeline icon={<Users size={12} />} title="Escalation choice" detail="Continue into a local coordination storyboard." /></div><div className="notice-banner" style={{ marginTop: 8 }}><KeyRound size={16} />No audio, calls, messages, or real location data are collected.</div></aside></div>
  </main>;
}

function Response({ onContact, onResponder, onResolve }: { onContact: () => void; onResponder: () => void; onResolve: () => void }) {
  return <main className="page-wrap"><Heading eyebrow="RESPONSECHAIN / 05" title="A clear chain of care." description="A coordinated sequence keeps each handoff visible. In this prototype, every actor and acknowledgement is simulated in the browser." tag="NO DISPATCH" /><FlowTrack stage={5} />
    <div className="split-layout"><section className="panel"><div className="small-label">INCIDENT COORDINATION · SIMULATED</div><div className="notice-banner warning" style={{ margin: '15px 0 18px' }}><Siren size={17} />Help request scenario is active. This is not an actual emergency and no outside party has been contacted.</div>
      <div className="timeline"><Timeline icon={<Check size={12} />} title="Risk signal reviewed" detail="Route deviation / user check-in scenario · simulated" /><Timeline icon={<Bell size={12} />} title="Trusted contact notified" detail="Maya Chen · local acknowledgement step" /><Timeline icon={<BadgeCheck size={12} />} title="Responder offered the request" detail="A nearby verified responder is shown in the demo." /><Timeline icon={<CheckCircle2 size={12} />} title="Resolution recorded" detail="The storyboard can be completed by any demo role." /></div>
      <div className="btn-row"><Button onClick={onContact} testid="button-notify-contact">Continue to trusted contact <ArrowRight size={14} /></Button><Button variant="secondary" onClick={onResponder} testid="button-open-responder">View responder portal <BadgeCheck size={14} /></Button></div></section>
      <aside className="panel"><div className="small-label">RESPONSE STATUS</div><div className="metric" style={{ fontSize: 22 }}>Coordination ready</div><div className="metric-caption">Three clear steps · simulated workflow</div><div style={{ marginTop: 20 }} className="grid"><Metric label="CONTACT" value="Maya Chen · pending demo acknowledgement" /><Metric label="RESPONDER" value="Leah Ortiz · synthetic profile" /><Metric label="LOCATION" value="Northgate / simulated map point" /></div><div className="btn-row"><Button onClick={onResolve} variant="secondary" testid="button-resolve-incident">Mark incident resolved <CheckCircle2 size={14} /></Button></div></aside></div>
  </main>;
}

function Contact({ acknowledged, shared, onAcknowledge, onContinue }: { acknowledged: boolean; shared: boolean; onAcknowledge: () => void; onContinue: () => void }) {
  return <main className="page-wrap"><Heading eyebrow="TRUSTED CONTACT / 06" title="A familiar person, in the loop." description="This portal previews the kind of concise update a trusted contact might receive. It is not actually sent." tag="SIMULATED CONTACT" /><FlowTrack stage={6} />
    <div className="grid grid-2"><section className="panel"><div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><div className="role-icon" style={{ margin: 0 }}><UserRound size={20} /></div><div><h2 className="panel-title">Maya Chen</h2><p className="panel-copy">Trusted contact · synthetic profile</p></div><Chip tone={acknowledged ? 'green' : 'amber'}>{acknowledged ? 'ACKNOWLEDGED' : 'UPDATE READY'}</Chip></div><div className="notice-banner" style={{ marginTop: 22 }}><MapPin size={16} />{shared ? 'AURIX demo update: journey context needs a check-in. The shown location is illustrative only.' : 'Route sharing is off. The demo contact cannot view journey location details.'}</div><div style={{ marginTop: 18 }}><div className="small-label">SHARED TRIP CONTEXT</div><div style={{ marginTop: 10 }}>{shared ? <RouteMap deviation /> : <div className="panel" style={{ textAlign: 'center', minHeight: 210, display: 'grid', placeItems: 'center' }}><div><Shield size={23} style={{ color: '#65caff', marginBottom: 10 }} /><div className="panel-title">Location hidden</div><p className="panel-copy">The user has paused route sharing.</p></div></div>}</div></div><div className="btn-row"><Button onClick={onAcknowledge} testid="button-acknowledge-update">{acknowledged ? 'Acknowledged' : 'Acknowledge update'} <Check size={14} /></Button><Button onClick={onContinue} variant="secondary" testid="button-continue-responder">Continue to responder <ArrowRight size={14} /></Button></div></section>
      <aside className="panel"><div className="small-label">WHAT THIS CONTACT CAN SEE</div><div className="timeline" style={{ marginTop: 20 }}><Timeline icon={<MapPin size={12} />} title="Shared route snapshot" detail="Only because route-sharing is enabled in the prototype." /><Timeline icon={<Clock3 size={12} />} title="Check-in status" detail="A summary state, not continuous live GPS." /><Timeline icon={<Shield size={12} />} title="Limited incident context" detail="Enough to understand why a check-in matters." /></div><div style={{ marginTop: 10 }}><SimNote>Contact and trip details here are invented examples and stay in local app state.</SimNote></div></aside></div>
  </main>;
}

function Responder({ accepted, stage, onAccept, onHelp, onResolve }: { accepted: boolean; stage: number; onAccept: () => void; onHelp: () => void; onResolve: () => void }) {
  const reached = stage >= 8;
  return <main className="page-wrap"><Heading eyebrow="RESPONDER PORTAL / 07" title="A verified handoff." description="Review a synthetic responder card and advance the storyboard. No real responders are available through AURIX." tag="SIMULATED RESPONDER" /><FlowTrack stage={Math.max(7, stage)} />
    <div className="split-layout"><section className="panel"><div className="small-label">RESPONDER PROFILE · SIMULATED</div><div style={{ display: 'flex', gap: 15, alignItems: 'center', margin: '19px 0' }}><div className="role-icon" style={{ width: 54, height: 54, margin: 0 }}><UserRound size={24} /></div><div style={{ flex: 1 }}><h2 className="panel-title" style={{ fontSize: 17 }}>Leah Ortiz</h2><p className="panel-copy">Community safety partner · 0.7 km (simulated)</p></div><Chip tone="green"><BadgeCheck size={12} /> VERIFIED DEMO</Chip></div>
      <div className="grid grid-3"><Metric label="STATUS" value={reached ? 'Help reached' : accepted ? 'Accepted' : 'Available'} /><Metric label="ETA" value={reached ? 'Arrived' : '4 min · simulated'} /><Metric label="MATCH" value="Community partner" /></div>
      <div className="notice-banner" style={{ marginTop: 19 }}>{reached ? <CheckCircle2 size={16} /> : <Navigation size={16} />}{reached ? 'Help reached — this is a simulated milestone, not a real-world arrival.' : 'Responder route and arrival estimate are illustrative. No one is being dispatched.'}</div>
      <div className="btn-row">{!accepted && <Button onClick={onAccept} testid="button-accept-response">Accept simulated request <Check size={14} /></Button>}{accepted && <Button onClick={onHelp} testid="button-mark-help-reached">Mark help reached <MapPin size={14} /></Button>}<Button onClick={onResolve} variant="secondary" testid="button-resolve-from-responder">Resolve incident <CheckCircle2 size={14} /></Button></div>
    </section><aside className="panel"><div className="small-label">HANDOFF CHECKLIST</div><div style={{ marginTop: 20 }} className="timeline"><Timeline icon={<Check size={12} />} title="Identity verified" detail="Badge state is simulated for this demo." /><Timeline icon={<ArrowDownRight size={12} />} title="Request accepted" detail={accepted ? 'Accepted in local app state.' : 'Use the action to advance the scenario.'} /><Timeline icon={<MapPin size={12} />} title="Help reached" detail={reached ? 'Milestone set in the browser.' : 'Optional next storyboard step.'} /></div><div style={{ marginTop: 12 }}><SimNote>Not a real responder network. Do not rely on this prototype for safety assistance.</SimNote></div></aside></div>
  </main>;
}

function Authority({ resolved, onResolve }: { resolved: boolean; onResolve: () => void }) {
  return <main className="page-wrap"><Heading eyebrow="AUTHORITY PORTAL / 08" title="Incident overview." description="A read-only coordination view for a simulated incident, its audit trail, and its resolution state." tag="DEMO RECORD" />
    <div className="grid grid-3"><div className="panel"><div className="small-label">CASE REFERENCE</div><div className="metric" style={{ fontSize: 20 }}>AX-2048-DEMO</div><div className="metric-caption">Generated locally · non-operational</div></div><div className="panel"><div className="small-label">CURRENT STATE</div><div className="metric" style={{ fontSize: 20 }}>{resolved ? 'Resolved' : 'Coordination active'}</div><div className="metric-caption">Last updated just now · simulated</div></div><div className="panel"><div className="small-label">PARTICIPANTS</div><div className="metric" style={{ fontSize: 20 }}>03</div><div className="metric-caption">User · contact · responder (synthetic)</div></div></div>
    <div className="grid grid-2" style={{ marginTop: 16 }}><section className="panel"><div className="small-label">EVENT RECORD</div><div style={{ marginTop: 16 }}><Event title="Journey monitoring began" detail="Cedar Park Station · simulated" time="18:18:03" /><Event title="Risk signal reviewed" detail="Route / pause event · local demo" time="18:24:16" /><Event title="Trusted contact acknowledged" detail="Maya Chen · sample profile" time="18:26:41" /><Event title={resolved ? 'Incident resolved' : 'Responder handoff available'} detail={resolved ? 'Resolution recorded in local state.' : 'No outside party has been contacted.'} time="18:28:09" /></div></section>
      <section className="panel"><div className="small-label">SITUATIONAL CONTEXT</div><div style={{ margin: '15px 0' }}><RouteMap deviation /></div><div className="btn-row"><Button onClick={onResolve} testid="button-authority-resolve">{resolved ? 'Resolved' : 'Record demo resolution'} <CheckCircle2 size={14} /></Button><Button href="/demo" variant="secondary" testid="link-authority-demo">Scenario controls</Button></div></section></div>
  </main>;
}
function Event({ title, detail, time }: { title: string; detail: string; time: string }) { return <div className="event-row"><div className="event-icon"><Activity size={14} /></div><div className="event-info"><strong>{title}</strong><span>{detail}</span></div><span className="event-time">{time}</span></div>; }

function Privacy({ shared, privateMode, onShared, onPrivate }: { shared: boolean; privateMode: boolean; onShared: () => void; onPrivate: () => void }) {
  return <main className="page-wrap"><Heading eyebrow="PRIVACY / CONTROL" title="You set the boundaries." description="AURIX should show what is shared, when it is shared, and how to pause it. These controls demonstrate local UI state only." tag="LOCAL CONTROLS" />
    <div className="split-layout"><section className="panel"><div className="small-label">YOUR SIMULATED PREFERENCES</div><PrivacyToggle title="Share journey with Maya Chen" detail="Allows the demo contact portal to show route context." checked={shared} onClick={onShared} testid="toggle-route-sharing" /><PrivacyToggle title="Private journey mode" detail="Keeps route details hidden from the demo contact portal." checked={privateMode} onClick={onPrivate} testid="toggle-private-mode" /><div className="notice-banner" style={{ marginTop: 20 }}><ShieldCheck size={16} />{privateMode ? 'Private mode is on in local state. No route detail is displayed by these controls.' : shared ? 'Route sharing is on in local state. You can switch it off at any time.' : 'Route sharing is off in local state.'}</div></section>
      <aside className="panel"><div className="small-label">DATA, EXPLAINED</div><div style={{ marginTop: 18 }} className="timeline"><Timeline icon={<Crosshair size={12} />} title="Location" detail="Typed or generated examples only; no GPS permission is requested." /><Timeline icon={<Database size={12} />} title="Storage" detail="Scenario states live in this browser session and are not sent to a backend." /><Timeline icon={<Users size={12} />} title="People" detail="Contacts and responder cards are invented profile examples." /><Timeline icon={<X size={12} />} title="Emergency services" detail="No real calls, messages, dispatch, or integrations are connected." /></div></aside></div>
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

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppFrame /></WouterRouter>;
}

export default App;