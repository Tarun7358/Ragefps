import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Zap, 
  Download, 
  Cpu, 
  Layers, 
  Lock, 
  HelpCircle, 
  Send, 
  Check, 
  ExternalLink, 
  User, 
  Key, 
  RefreshCw, 
  Sliders, 
  CheckCircle2, 
  MessageSquare,
  ChevronDown,
  Info,
  Mail
} from 'lucide-react';

const getApiUrl = (path) => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && (window.location.port === '5175' || window.location.port === '5176')) {
    return `http://localhost:5000${path}`;
  }
  return path;
};

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [fps, setFps] = useState(65);
  const [ping, setPing] = useState(48);
  const [ram, setRam] = useState(72);
  const [simCompleted, setSimCompleted] = useState(false);

  // Pricing / Checkout state
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentName, setPaymentName] = useState('');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [orderComplete, setOrderComplete] = useState(false);

  // Login Portal state
  const [licenseInput, setLicenseInput] = useState('');
  const [loginUser, setLoginUser] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [hwidResetting, setHwidResetting] = useState(false);
  const [hwidResetMessage, setHwidResetMessage] = useState('');

  // Support / Tickets state
  const [projectId, setProjectId] = useState(() => localStorage.getItem('firebase_project_id') || 'rage-optimization');
  const [latestVersion, setLatestVersion] = useState('1.0.0');
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!projectId || projectId === 'rage-optimization-db') return;
      try {
        const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/metadata/version`);
        if (response.ok) {
          const data = await response.json();
          const fields = data.fields || {};
          setLatestVersion(fields.latestVersion?.stringValue || '1.0.0');
          setDownloadUrl(fields.downloadUrl?.stringValue || '');
        }
      } catch (err) {
        console.error("Error fetching version metadata:", err);
      }
    };
    fetchMetadata();
  }, [projectId]);

  const [tickets, setTickets] = useState([
    { id: 'TICKET-1042', subject: 'HWID Reset requested after CPU upgrade', status: 'Resolved', date: '2 hours ago', licenseKey: 'anonymous' }
  ]);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketSuccess, setTicketSuccess] = useState(false);

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Optimization simulator animation loop
  useEffect(() => {
    let interval = null;
    if (simulating) {
      interval = setInterval(() => {
        setSimProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setSimulating(false);
            setSimCompleted(true);
            return 100;
          }
          // Incremental adjustments to stats
          setFps((f) => Math.min(240, Math.floor(65 + (prev * 1.75))));
          setPing((p) => Math.max(8, Math.floor(48 - (prev * 0.4))));
          setRam((r) => Math.max(28, Math.floor(72 - (prev * 0.44))));
          return prev + 2;
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [simulating]);

  const fetchTickets = async () => {
    const fallbackToLocal = () => {
      const local = localStorage.getItem('rage_tickets');
      if (local) {
        const parsed = JSON.parse(local);
        if (isLoggedIn) {
          setTickets(parsed.filter(t => t.licenseKey === licenseInput));
        } else {
          setTickets(parsed);
        }
      }
    };

    // If using the default project IDs, try the local Express server first for live cross-origin syncing
    if (!projectId || projectId === 'rage-optimization-db' || projectId === 'rage-optimization') {
      try {
        const response = await fetch(getApiUrl('/api/tickets'));
        if (response.ok) {
          const fetched = await response.json();
          localStorage.setItem('rage_tickets', JSON.stringify(fetched));
          if (isLoggedIn) {
            setTickets(fetched.filter(t => t.licenseKey === licenseInput));
          } else {
            setTickets(fetched);
          }
          return;
        }
      } catch (err) {
        // Express backend is not running, fallback to local storage
      }
      fallbackToLocal();
      return;
    }
    
    try {
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tickets`);
      if (response.ok) {
        const data = await response.json();
        if (data.documents) {
          const fetched = data.documents.map(doc => {
            const fields = doc.fields || {};
            const nameParts = doc.name.split('/');
            const id = nameParts[nameParts.length - 1];
            return {
              id: id,
              subject: fields.subject?.stringValue || '',
              message: fields.message?.stringValue || '',
              status: fields.status?.stringValue || 'Pending Review',
              date: fields.date?.stringValue || 'Just now',
              licenseKey: fields.licenseKey?.stringValue || ''
            };
          });
          if (isLoggedIn) {
            setTickets(fetched.filter(t => t.licenseKey === licenseInput));
          } else {
            setTickets(fetched);
          }
        } else {
          setTickets([]);
        }
      } else {
        fallbackToLocal();
      }
    } catch (err) {
      console.error("Error fetching tickets:", err);
      fallbackToLocal();
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => {
      fetchTickets();
    }, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn, licenseInput, projectId]);

  const handleSimulate = () => {
    setSimProgress(0);
    setFps(65);
    setPing(48);
    setRam(72);
    setSimCompleted(false);
    setSimulating(true);
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    if (!paymentName || !paymentEmail) return;

    // Generate simulated license key
    const uniqueKey = `RAGE-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-PREMIUM`;
    setGeneratedKey(uniqueKey);
    setOrderComplete(true);
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!licenseInput.trim()) {
      setLoginError('Please enter a license key.');
      return;
    }

    if (licenseInput.toLowerCase().startsWith('rage-') || licenseInput.toLowerCase() === 'admin') {
      setIsLoggedIn(true);
      setLoginUser(loginUser || 'GamerPro');
      setLoginError('');
    } else {
      setLoginError('Invalid license format. In Demo Mode, use any key starting with "RAGE-" or "admin".');
    }
  };

  const handleResetHwid = () => {
    setHwidResetting(true);
    setHwidResetMessage('');
    setTimeout(() => {
      setHwidResetting(false);
      setHwidResetMessage('HWID lock successfully reset on the cloud database! You can now log in on a new PC.');
    }, 1500);
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!ticketSubject || !ticketMsg) return;

    const ticketId = `TICKET-${Math.floor(1000 + Math.random() * 9000)}`;
    const ticketDate = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' today';
    
    const newTicket = {
      id: ticketId,
      subject: ticketSubject,
      message: ticketMsg,
      status: 'Pending Review',
      date: ticketDate,
      licenseKey: isLoggedIn ? licenseInput : 'anonymous'
    };

    const saveLocally = async () => {
      try {
        const response = await fetch(getApiUrl('/api/tickets'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTicket)
        });
        if (response.ok) {
          fetchTickets();
          setTicketSubject('');
          setTicketMsg('');
          setTicketSuccess(true);
          setTimeout(() => setTicketSuccess(false), 4000);
          return;
        }
      } catch (err) {
        // Express backend is not running, fallback to pure localStorage
      }

      const local = localStorage.getItem('rage_tickets');
      const currentTickets = local ? JSON.parse(local) : [];
      const updated = [newTicket, ...currentTickets];
      setTickets(isLoggedIn ? updated.filter(t => t.licenseKey === licenseInput) : updated);
      localStorage.setItem('rage_tickets', JSON.stringify(updated));
      
      setTicketSubject('');
      setTicketMsg('');
      setTicketSuccess(true);
      setTimeout(() => setTicketSuccess(false), 4000);
    };

    if (!projectId || projectId === 'rage-optimization-db' || projectId === 'rage-optimization') {
      saveLocally();
      return;
    }

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tickets/${ticketId}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            subject: { stringValue: ticketSubject },
            message: { stringValue: ticketMsg },
            status: { stringValue: 'Pending Review' },
            date: { stringValue: ticketDate },
            licenseKey: { stringValue: isLoggedIn ? licenseInput : 'anonymous' }
          }
        })
      });

      if (response.ok) {
        setTicketSubject('');
        setTicketMsg('');
        setTicketSuccess(true);
        setTimeout(() => setTicketSuccess(false), 4000);
        fetchTickets();
      } else {
        console.warn("Firestore access error, falling back to local storage:", response.statusText);
        saveLocally();
      }
    } catch (err) {
      console.warn("Network error during ticket submit, falling back to local storage:", err);
      saveLocally();
    }
  };

  const faqs = [
    { q: 'Is this tweak vault anti-cheat safe?', a: 'Yes, 100%. Our tool modifies native Windows parameters, priority queues, and network configurations. It does not inject code, hook game engines, or modify game files.' },
    { q: 'How does the hardware lock (HWID) function?', a: 'To prevent license piracy, each license is securely bound to your computer’s CPU, baseboard, and main disk drive. You can reset your HWID lock via this dashboard if you upgrade hardware.' },
    { q: 'What is the dynamic rotating password system?', a: 'For maximum database panel security, our team uses standard 30-second rotating Time-based One-Time Passwords (TOTP). This ensures that admin operations require physical token synchronization.' },
    { q: 'Do the tweaks persist after computer reboot?', a: 'Some registry values persist, while other high-priority process schedulers run dynamically. We recommend keeping the client open for auto-cleanup optimizations during gaming.' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Navigation Header */}
      <header style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '20px 5%',
        background: 'rgba(5, 5, 8, 0.9)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img 
            src="/logo.jpeg" 
            alt="Rage Logo" 
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 6, 
              objectFit: 'cover', 
              boxShadow: '0 0 15px rgba(255, 26, 26, 0.4)',
              border: '1px solid var(--border-color)'
            }} 
          />
          <div>
            <span style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '1px', background: 'linear-gradient(to right, #ffffff, #ff5555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              RAGE TWEAK VAULT
            </span>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 30 }}>
          <button 
            onClick={() => { setActiveTab('home'); setIsLoggedIn(false); }} 
            className={`nav-link ${activeTab === 'home' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Home
          </button>
          <button 
            onClick={() => { setActiveTab('pricing'); setIsLoggedIn(false); }} 
            className={`nav-link ${activeTab === 'pricing' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Pricing
          </button>
          <button 
            onClick={() => { setActiveTab('download'); setIsLoggedIn(false); }} 
            className={`nav-link ${activeTab === 'download' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Downloads
          </button>
          <button 
            onClick={() => { setActiveTab('login'); }} 
            className={`nav-link ${activeTab === 'login' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            License Portal
          </button>
          <button 
            onClick={() => { setActiveTab('support'); setIsLoggedIn(false); }} 
            className={`nav-link ${activeTab === 'support' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Support
          </button>
        </nav>

        <div>
          <button 
            onClick={() => setActiveTab('pricing')} 
            className="btn-primary"
            style={{ fontSize: '13px', padding: '8px 18px' }}
          >
            <Zap size={14} /> Get Premium
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '40px 5%', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* ==================== 1. LANDING PAGE ==================== */}
        {activeTab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 80 }}>
            {/* Hero Section */}
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '40px auto 0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'inline-flex', alignSelf: 'center', alignItems: 'center', gap: 6, background: 'rgba(255, 26, 26, 0.1)', border: '1px solid rgba(255, 26, 26, 0.3)', padding: '6px 16px', borderRadius: 20 }}>
                <Zap size={12} color="#ff1a1a" />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#ff5555', letterSpacing: '0.5px' }}>VERSION 1.0.0 IS LIVE</span>
              </div>
              <h1 style={{ fontSize: '52px', lineHeight: '1.1', background: 'linear-gradient(to bottom, #ffffff 60%, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Unleash Your PC's True Gaming Potential
              </h1>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Deploy military-grade registry configurations, optimize CPU core parking scheduler priorities, and eliminate network packet drops instantly. 
              </p>
              <div style={{ display: 'flex', gap: 15, justifyContent: 'center', marginTop: 10 }}>
                <button onClick={() => setActiveTab('download')} className="btn-primary" style={{ fontSize: '15px', padding: '14px 32px' }}>
                  <Download size={18} /> Download Optimizer
                </button>
                <button onClick={() => setActiveTab('pricing')} className="btn-secondary" style={{ fontSize: '15px', padding: '14px 32px' }}>
                  View Pricing Plans
                </button>
              </div>
            </div>

            {/* Interactive Live Optimizer Simulator */}
            <div className="glass-card" style={{ padding: '30px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '25px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sliders size={20} color="#ff1a1a" /> Live Registry Optimization Simulator
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Experience how our kernel tweaks modify Windows performance metrics in real-time.
                  </p>
                </div>
                <button 
                  onClick={handleSimulate} 
                  disabled={simulating}
                  className="btn-primary animate-pulse-slow"
                  style={{ opacity: simulating ? 0.7 : 1 }}
                >
                  {simulating ? 'OPTIMIZING REGISTRY...' : 'RUN SIMULATION BOOST'}
                </button>
              </div>

              {/* Live Sim Indicators Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: '25px' }}>
                {/* Stat 1: FPS */}
                <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '1px' }}>FPS RATE</span>
                  <div style={{ fontSize: '42px', fontWeight: '900', color: simCompleted ? '#39ff14' : '#fff', transition: 'color 0.5s ease', margin: '5px 0' }}>
                    {fps} <span style={{ fontSize: '16px', fontWeight: '500' }}>FPS</span>
                  </div>
                  <div style={{ height: 4, width: '100%', background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(fps / 240) * 100}%`, background: simCompleted ? '#39ff14' : 'var(--primary)', transition: 'width 0.1s ease' }} />
                  </div>
                </div>

                {/* Stat 2: Ping */}
                <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '1px' }}>NETWORK LATENCY</span>
                  <div style={{ fontSize: '42px', fontWeight: '900', color: simCompleted ? '#39ff14' : '#fff', transition: 'color 0.5s ease', margin: '5px 0' }}>
                    {ping} <span style={{ fontSize: '16px', fontWeight: '500' }}>MS</span>
                  </div>
                  <div style={{ height: 4, width: '100%', background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((50 - ping) / 42) * 100}%`, background: simCompleted ? '#39ff14' : 'var(--primary)', transition: 'width 0.1s ease' }} />
                  </div>
                </div>

                {/* Stat 3: RAM */}
                <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '1px' }}>RAM RESOURCE UTILIZATION</span>
                  <div style={{ fontSize: '42px', fontWeight: '900', color: simCompleted ? '#39ff14' : '#fff', transition: 'color 0.5s ease', margin: '5px 0' }}>
                    {ram}%
                  </div>
                  <div style={{ height: 4, width: '100%', background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${ram}%`, background: simCompleted ? '#39ff14' : 'var(--primary)', transition: 'width 0.1s ease' }} />
                  </div>
                </div>
              </div>

              {simulating && (
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${simProgress}%`, height: '100%', background: 'linear-gradient(to right, #ff1a1a, #ffaa00)', transition: 'width 0.1s ease' }} />
                </div>
              )}

              {simCompleted && (
                <div style={{ textAlign: 'center', background: 'rgba(57, 255, 20, 0.1)', border: '1px solid rgba(57, 255, 20, 0.3)', color: '#39ff14', padding: '12px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} /> Registry Optimization Simulation Success: System Speed Boosted by 269%!
                </div>
              )}
            </div>

            {/* Core Features Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '28px', color: '#fff' }}>Secure Kernel-Level Features</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: 5 }}>All tweaks are encrypted, verified, and run entirely local on your operating system.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                {/* Feature 1 */}
                <div className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'rgba(255, 26, 26, 0.1)', width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifySelf: 'flex-start', justifyContent: 'center' }}>
                    <Lock size={18} color="#ff1a1a" />
                  </div>
                  <h4 style={{ fontSize: '17px', color: '#fff' }}>Encrypted Registry Vault</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    All scripts, batch tweaks, and registry files are encrypted within the executable binary. Prevents corruption or illegal modifications from malicious software.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'rgba(255, 26, 26, 0.1)', width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifySelf: 'flex-start', justifyContent: 'center' }}>
                    <Cpu size={18} color="#ff1a1a" />
                  </div>
                  <h4 style={{ fontSize: '17px', color: '#fff' }}>Gamer Priority Schedulers</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Directly overrides Windows Multimedia Task Scheduler parameters. Routes 100% of processing power to games such as BlueStacks, Free Fire, and esports titles.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'rgba(255, 26, 26, 0.1)', width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifySelf: 'flex-start', justifyContent: 'center' }}>
                    <Key size={18} color="#ff1a1a" />
                  </div>
                  <h4 style={{ fontSize: '17px', color: '#fff' }}>HWID Hardware Locking</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Secure hardware integration binds license keys directly to base motherboard configurations. Prevents unauthorized redistribution of premium plans.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. PRICING PAGE ==================== */}
        {activeTab === 'pricing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40, marginTop: 20 }}>
            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '32px', color: '#fff' }}>Flexible License Access</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', marginTop: 6 }}>
                Choose the perfect gaming priority tier. Instant setup key generated immediately upon checkout authorization.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 30, maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              {/* Premium Plan */}
              <div className="glass-card" style={{ padding: '35px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '1px' }}>STANDARD LICENSE</span>
                  <h3 style={{ fontSize: '26px', color: '#fff', marginTop: 5 }}>Premium Plan</h3>
                </div>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
                  <span style={{ fontSize: '38px', fontWeight: '900', color: '#fff' }}>₹499</span>
                  <span style={{ color: 'var(--text-secondary)' }}> once</span>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> Standard Registry Optimization</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> Advanced RAM Memory Cleanups</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> Standard DNS Ping Reducer</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> 1 Hardware (HWID) Device Limit</li>
                </ul>
                <button 
                  onClick={() => window.open('https://discord.gg/qE67Uqnc3N', '_blank')}
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Order via Discord
                </button>
              </div>

              {/* Elite Plan */}
              <div className="glass-card" style={{ padding: '35px', display: 'flex', flexDirection: 'column', gap: 20, border: '2px solid var(--primary)', position: 'relative', transform: 'scale(1.02)' }}>
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: '#fff', fontSize: '10px', fontWeight: '900', padding: '4px 12px', borderRadius: 20, letterSpacing: '0.5px' }}>
                  BEST VALUE CHOICE
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#ff5555', letterSpacing: '1px' }}>UNLIMITED ACCESS</span>
                  <h3 style={{ fontSize: '26px', color: '#fff', marginTop: 5 }}>Elite Plan</h3>
                </div>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
                  <span style={{ fontSize: '38px', fontWeight: '900', color: '#fff' }}>₹999</span>
                  <span style={{ color: 'var(--text-secondary)' }}> once</span>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> Everything in Premium License</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> Free Fire sensitivity optimization</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> BlueStacks priority scheduler keys</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> GPU Multimedia priority controls</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> Direct Discord Developer Chat Access</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#ff1a1a" /> Unlimited HWID Reset Requests</li>
                </ul>
                <button 
                  onClick={() => window.open('https://discord.gg/qE67Uqnc3N', '_blank')}
                  className="btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Order via Discord
                </button>
              </div>
            </div>

            {/* Interactive Checkout Modal Overlay */}
            {isCheckingOut && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '30px', position: 'relative' }}>
                  <button 
                    onClick={() => { setIsCheckingOut(false); setOrderComplete(false); setPaymentName(''); setPaymentEmail(''); }}
                    style={{ position: 'absolute', top: 15, right: 15, background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>

                  {!orderComplete ? (
                    <form onSubmit={handleCheckoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                      <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: '11px', color: '#ff5555', fontWeight: '800' }}>SIMULATED SECURE PAYMENT GATEWAY</span>
                        <h3 style={{ fontSize: '20px', color: '#fff', marginTop: 4 }}>Complete Your Order</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Selected Plan: <strong style={{ color: '#fff' }}>{selectedPlan}</strong></p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Full Name</label>
                        <input 
                          type="text" 
                          required 
                          value={paymentName}
                          onChange={(e) => setPaymentName(e.target.value)}
                          placeholder="Tarun Kumar" 
                          style={{ background: '#121217', border: '1px solid var(--border-color)', borderRadius: 5, padding: '10px', color: '#fff', fontSize: '14px', outline: 'none' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Email Address</label>
                        <input 
                          type="email" 
                          required 
                          value={paymentEmail}
                          onChange={(e) => setPaymentEmail(e.target.value)}
                          placeholder="tarun@example.com" 
                          style={{ background: '#121217', border: '1px solid var(--border-color)', borderRadius: 5, padding: '10px', color: '#fff', fontSize: '14px', outline: 'none' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Credit Card Details</label>
                        <input 
                          type="text" 
                          required 
                          defaultValue="4111 2222 3333 4444"
                          disabled
                          style={{ background: '#121217', border: '1px solid var(--border-color)', borderRadius: 5, padding: '10px', color: 'var(--text-secondary)', fontSize: '14px', outline: 'none' }}
                        />
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Demo mode: Test credit card automatically loaded.</span>
                      </div>

                      <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
                        <CheckCircle2 size={16} /> Authorize &amp; Generate License
                      </button>
                    </form>
                  ) : (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 15, padding: '10px 0' }}>
                      <div style={{ width: 60, height: 60, borderRadius: 30, background: 'rgba(57, 255, 20, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
                        <CheckCircle2 size={32} color="#39ff14" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '22px', color: '#fff' }}>Payment Authorized</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 4 }}>Thank you {paymentName}, your premium license is active!</p>
                      </div>

                      <div style={{ background: '#121217', border: '1px dashed rgba(255, 26, 26, 0.3)', borderRadius: 6, padding: '15px', position: 'relative' }}>
                        <span style={{ fontSize: '10px', color: '#ff5555', display: 'block', fontWeight: '800' }}>YOUR CLOUD LICENSE KEY</span>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace', letterSpacing: '1px', marginTop: 5 }}>
                          {generatedKey}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 10 }}>
                        <button 
                          onClick={() => {
                            setLicenseInput(generatedKey);
                            setLoginUser(paymentName);
                            setActiveTab('login');
                            setIsCheckingOut(false);
                            setOrderComplete(false);
                          }}
                          className="btn-primary" 
                          style={{ fontSize: '13px', padding: '8px 18px' }}
                        >
                          Access Portal
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(generatedKey);
                          }}
                          className="btn-secondary" 
                          style={{ fontSize: '13px', padding: '8px 18px' }}
                        >
                          Copy Key
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 3. DOWNLOAD PORTAL ==================== */}
        {activeTab === 'download' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40, marginTop: 20 }}>
            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '32px', color: '#fff' }}>Official Download Center</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', marginTop: 6 }}>
                Download the latest stable release containing all active sensitivity and network profiles.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 35, maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
              {/* Windows Desktop Suite download */}
              <div className="glass-card" style={{ padding: '35px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'rgba(255, 26, 26, 0.1)', width: 44, height: 44, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Cpu size={22} color="#ff1a1a" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', color: '#fff' }}>Windows Desktop</h3>
                    <span style={{ fontSize: '12px', color: '#39ff14', fontWeight: '600' }}>v1.0.0 Stable Build</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: 8, fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>File Name:</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>RageOptimizationSetup.exe</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Architecture:</span>
                    <span style={{ color: '#fff' }}>x64 Windows Installer</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>File Size:</span>
                    <span style={{ color: '#fff' }}>394.5 MB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Requirements:</span>
                    <span style={{ color: '#fff' }}>Windows 10/11 (64-bit)</span>
                  </div>
                </div>

                {/* Secure File integrity Info */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>SHA256 CHECKSUM</span>
                  <div style={{ fontFamily: 'monospace', fontSize: '10px', background: '#121217', border: '1px solid var(--border-color)', padding: '8px', borderRadius: 4, color: '#ffaa00', overflowX: 'auto' }}>
                    7c72dbbf8015e171b3e8ad4b59ec21aa
                  </div>
                </div>

                 <a 
                  href={downloadUrl || "/RageOptimizationSetup.exe"}
                  download="RageOptimizationSetup.exe"
                  className="btn-primary" 
                  style={{ justifyContent: 'center', padding: '14px 20px', textDecoration: 'none', marginTop: 'auto' }}
                >
                  <Download size={16} /> Download Setup.exe
                </a>
              </div>


              {/* Right Column: Changelog and integrity rules */}
              <div className="glass-card" style={{ padding: '35px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <h3 style={{ fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={18} color="#ffaa00" /> Release Changelog Notes
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <div style={{ borderLeft: '3px solid var(--primary)', paddingLeft: '15px' }}>
                    <h5 style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>v1.0.0 Release Features (May 2026)</h5>
                    <ul style={{ listStyle: 'square', marginLeft: '15px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <li>Added dedicated BlueStacks process scheduled priority mapping.</li>
                      <li>Optimized mouse polling delays reducing click delays to 1ms.</li>
                      <li>Configured real-time custom user layout with glowing glassmorphism widgets.</li>
                      <li>Added support for custom registry imports.</li>
                    </ul>
                  </div>

                  <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '15px' }}>
                    <h5 style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>Requirements Notice</h5>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                      Please run the setup file as **Administrator**. Registry updates and network priority scheduling overrides require elevated OS privilege levels.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 4. DASHBOARD LOGIN & PORTAL ==================== */}
        {activeTab === 'login' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40, marginTop: 20 }}>
            {!isLoggedIn ? (
              /* User Login Card */
              <div className="glass-card" style={{ maxWidth: '420px', margin: '0 auto', width: '100%', padding: '35px' }}>
                <div style={{ textAlign: 'center', marginBottom: 25 }}>
                  <h3 style={{ fontSize: '24px', color: '#fff' }}>Authorized License Login</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: 5 }}>
                    Enter your unique license key to access the hardware unlock portal.
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Your Name (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: 12, top: 12 }} />
                      <input 
                        type="text" 
                        value={loginUser}
                        onChange={(e) => setLoginUser(e.target.value)}
                        placeholder="GamerPro" 
                        style={{ width: '100%', background: '#121217', border: '1px solid var(--border-color)', borderRadius: 5, padding: '10px 10px 10px 36px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>License Key</label>
                    <div style={{ position: 'relative' }}>
                      <Key size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: 12, top: 12 }} />
                      <input 
                        type="text" 
                        required
                        value={licenseInput}
                        onChange={(e) => setLicenseInput(e.target.value)}
                        placeholder="RAGE-XXXX-XXXX-PREMIUM" 
                        style={{ width: '100%', background: '#121217', border: '1px solid var(--border-color)', borderRadius: 5, padding: '10px 10px 10px 36px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  </div>

                  {loginError && (
                    <div style={{ fontSize: '12px', color: '#ff5555', background: 'rgba(255, 85, 85, 0.1)', border: '1px solid rgba(255, 85, 85, 0.3)', padding: '10px', borderRadius: 4 }}>
                      {loginError}
                    </div>
                  )}

                  <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
                    Verify License Access
                  </button>
                </form>
              </div>
            ) : (
              /* Authorized Dashboard Portal */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
                  <div>
                    <h2 style={{ fontSize: '28px', color: '#fff' }}>Welcome back, {loginUser}!</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                      Manage your premium key bindings and reset device constraints instantly.
                    </p>
                  </div>
                  <button 
                    onClick={() => { setIsLoggedIn(false); setLicenseInput(''); }}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    Logout Portal
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                  {/* Card 1: License Status */}
                  <div className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <h4 style={{ fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Shield size={16} color="#ff1a1a" /> License Authenticated
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                        <span style={{ color: '#39ff14', fontWeight: 'bold' }}>Active / Lifetime</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Key:</span>
                        <span style={{ color: '#fff', fontFamily: 'monospace' }}>{licenseInput}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Device Limit:</span>
                        <span style={{ color: '#fff' }}>1 Active PC</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: HWID Lock Controller */}
                  <div className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <h4 style={{ fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <RefreshCw size={16} color="#ff1a1a" /> Cloud HWID Locking
                    </h4>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Your license key is currently locked to your computer’s hardware fingerprint. If you buy a new computer or upgrade components, click below to clear the lock.
                    </p>
                    <button 
                      onClick={handleResetHwid}
                      disabled={hwidResetting}
                      className="btn-secondary" 
                      style={{ padding: '10px 15px', fontSize: '13px', justifyContent: 'center' }}
                    >
                      {hwidResetting ? 'Resetting Cloud HWID...' : 'Reset HWID Bindings'}
                    </button>
                    {hwidResetMessage && (
                      <span style={{ fontSize: '11px', color: '#39ff14' }}>{hwidResetMessage}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 5. SUPPORT CENTER ==================== */}
        {activeTab === 'support' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40, marginTop: 20 }}>
            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
              <h2 style={{ fontSize: '32px', color: '#fff' }}>Support Center &amp; Help Desk</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', lineHeight: '1.6' }}>
                Read frequently asked questions, open a ticket, or reach out to our team directly through our official channels.
              </p>
              
              {/* Direct Support Channels */}
              <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <a 
                  href="https://discord.gg/qE67Uqnc3N" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    padding: '12px 24px', 
                    background: 'rgba(88, 101, 242, 0.1)', 
                    border: '1px solid rgba(88, 101, 242, 0.3)', 
                    borderRadius: 8, 
                    textDecoration: 'none',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  className="support-channel-card"
                >
                  <MessageSquare size={20} color="#5865F2" />
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '10px', color: '#5865F2', display: 'block', fontWeight: '800', letterSpacing: '0.5px' }}>JOIN DISCORD</span>
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>discord.gg/qE67Uqnc3N</span>
                  </div>
                </a>

                <a 
                  href="mailto:support@ragefps.in" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    padding: '12px 24px', 
                    background: 'rgba(255, 26, 26, 0.1)', 
                    border: '1px solid rgba(255, 26, 26, 0.3)', 
                    borderRadius: 8, 
                    textDecoration: 'none',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  className="support-channel-card"
                >
                  <Mail size={20} color="#ff1a1a" />
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '10px', color: '#ff5555', display: 'block', fontWeight: '800', letterSpacing: '0.5px' }}>EMAIL US</span>
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>support@ragefps.in</span>
                  </div>
                </a>
              </div>
            </div>

            {/* Split Layout: FAQs & Ticket Form */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 30, alignItems: 'flex-start' }}>
              
              {/* Left Column: FAQ Accordion */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: 5 }}>Frequently Asked Questions</h3>
                {faqs.map((faq, idx) => (
                  <div key={idx} className="glass-card" style={{ overflow: 'hidden' }}>
                    <button 
                      onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                      style={{ width: '100%', background: 'none', border: 'none', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span>{faq.q}</span>
                      <ChevronDown size={16} style={{ transform: expandedFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                    </button>
                    {expandedFaq === idx && (
                      <div style={{ padding: '0 20px 15px 20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right Column: Ticket Submission & Live Tickets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Ticket Form */}
                <div className="glass-card" style={{ padding: '30px' }}>
                  <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={18} color="#ff1a1a" /> Open Support Ticket
                  </h3>
                  <form onSubmit={handleTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ticket Subject</label>
                      <input 
                        type="text" 
                        required
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="e.g. License verification issue" 
                        style={{ width: '100%', background: '#121217', border: '1px solid var(--border-color)', borderRadius: 5, padding: '10px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Message Description</label>
                      <textarea 
                        required
                        rows="3"
                        value={ticketMsg}
                        onChange={(e) => setTicketMsg(e.target.value)}
                        placeholder="Write details of your problem..." 
                        style={{ width: '100%', background: '#121217', border: '1px solid var(--border-color)', borderRadius: 5, padding: '10px', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </div>

                    {ticketSuccess && (
                      <div style={{ fontSize: '12px', color: '#39ff14', background: 'rgba(57, 255, 20, 0.1)', border: '1px solid rgba(57, 255, 20, 0.3)', padding: '10px', borderRadius: 4 }}>
                        Ticket created successfully! A developer will contact you shortly.
                      </div>
                    )}

                    <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                      <Send size={14} /> Submit Support Request
                    </button>
                  </form>
                </div>

                {/* Ticket Registry View */}
                <div className="glass-card" style={{ padding: '20px' }}>
                  <h4 style={{ fontSize: '14px', color: '#fff', marginBottom: 10 }}>My Open Tickets ({tickets.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {tickets.map((t, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0e0e13', padding: '10px 15px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{t.subject}</div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID #{t.id} • {t.date}</span>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: 10, background: t.status === 'Resolved' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 170, 0, 0.1)', color: t.status === 'Resolved' ? '#39ff14' : '#ffaa00' }}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </main>

      {/* Footer Branding */}
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '30px 5%',
        background: 'rgba(3, 3, 6, 0.95)',
        textAlign: 'center',
        marginTop: '60px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20, maxWidth: '1200px', margin: '0 auto' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>RAGE TWEAK VAULT</span>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 4 }}>© 2026 Rage Optimization. All rights reserved.</p>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: '13px', color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="https://discord.gg/qE67Uqnc3N" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: 'inherit' }}>
              Discord Community <ExternalLink size={12} />
            </a>
            <span>•</span>
            <a href="mailto:support@ragefps.in" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: 'inherit' }}>
              Email Support <ExternalLink size={12} />
            </a>
            <span>•</span>
            <a href="https://github.com/Tarun7358/Ragefps" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: 'inherit' }}>
              GitHub Source <ExternalLink size={12} />
            </a>
            <span>•</span>
            <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('support'); }} style={{ textDecoration: 'none', color: 'inherit' }}>Help Desk</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
