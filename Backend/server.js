require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ─── FIREBASE ADMIN INIT ──────────────────────────────────────────────────────
// Set env var FIREBASE_SERVICE_ACCOUNT to the full JSON string of your service account key.
// Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key
let db = null;

const initFirebase = () => {
  try {
    if (admin.apps.length > 0) {
      db = admin.firestore();
      return true;
    }

    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = admin.credential.applicationDefault();
    } else {
      console.warn('[Firebase] No service account configured. Running in local JSON file mode.');
      return false;
    }

    admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || 'rage-optimization'
    });

    db = admin.firestore();
    console.log('[Firebase] Firestore connected successfully.');
    return true;
  } catch (err) {
    console.error('[Firebase] Initialization failed:', err.message);
    return false;
  }
};

const firebaseReady = initFirebase();

// ─── SSE REAL-TIME CLIENTS ────────────────────────────────────────────────────
const sseClients = { licenses: [], tickets: [] };

const pushSSE = (channel, data) => {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients[channel] = sseClients[channel].filter(res => {
    try { res.write(payload); return true; }
    catch { return false; }
  });
};

// SSE endpoint — admin panel subscribes here for real-time updates
app.get('/api/sse/:channel', (req, res) => {
  const { channel } = req.params;
  if (!sseClients[channel]) return res.status(404).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current snapshot immediately on connect
  if (channel === 'licenses') {
    readLicenses().then(data => res.write(`data: ${JSON.stringify(data)}\n\n`));
  } else if (channel === 'tickets') {
    readTickets().then(data => res.write(`data: ${JSON.stringify(data)}\n\n`));
  }

  sseClients[channel].push(res);
  req.on('close', () => {
    sseClients[channel] = sseClients[channel].filter(c => c !== res);
  });
});

// ─── EMAIL HELPER ─────────────────────────────────────────────────────────────
const sendEmail = async (to, subject, html) => {
  const smtpHost = process.env.SMTP_HOST || 'smtp.ragefps.in';
  const smtpPort = parseInt(process.env.SMTP_PORT) || 465;
  const smtpSecure = process.env.SMTP_SECURE !== 'false';
  const smtpUser = process.env.SMTP_USER || 'support@ragefps.in';
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpPass || smtpPass === 'your-smtp-password') {
    console.log(`\n[EMAIL SIMULATOR] To: ${to} | Subject: ${subject}`);
    const emailLogPath = path.join(__dirname, 'simulated_emails.json');
    let logs = [];
    try { if (fs.existsSync(emailLogPath)) logs = JSON.parse(fs.readFileSync(emailLogPath, 'utf8') || '[]'); } catch { }
    logs.push({ to, subject, html, timestamp: new Date().toISOString() });
    fs.writeFileSync(emailLogPath, JSON.stringify(logs, null, 2));
    return true;
  }

  const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user: smtpUser, pass: smtpPass } });
  await transporter.sendMail({ from: `"Rage Support" <${smtpUser}>`, to, subject, html });
  return true;
};

// ─── TICKETS (Firestore → fallback JSON) ─────────────────────────────────────
const TICKETS_FILE = path.join(__dirname, 'tickets.json');
const DEFAULT_TICKETS = [
  { id: 'TICKET-1042', subject: 'HWID Reset after CPU upgrade', message: 'My motherboard was upgraded and HWID mismatches. Please reset.', status: 'Resolved', date: '2 hours ago', licenseKey: 'RAGE-DEMO-EXPRESS' },
  { id: 'TICKET-2281', subject: 'Blue Screen during FPS tweak', message: 'Registry tweak causes BSOD. How to undo?', status: 'Pending Review', date: '3 hours ago', licenseKey: 'RAGE-ALPHA-9921' }
];

const readTickets = async () => {
  if (firebaseReady && db) {
    try {
      const snap = await db.collection('tickets').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) { console.error('[Firestore] readTickets error:', err.message); }
  }
  // fallback to local JSON
  try {
    if (!fs.existsSync(TICKETS_FILE)) { fs.writeFileSync(TICKETS_FILE, JSON.stringify(DEFAULT_TICKETS, null, 2)); return DEFAULT_TICKETS; }
    return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8') || '[]');
  } catch { return DEFAULT_TICKETS; }
};

const writeTicket = async (ticket) => {
  if (firebaseReady && db) {
    try { await db.collection('tickets').doc(ticket.id).set(ticket, { merge: true }); return; } catch (err) { console.error('[Firestore] writeTicket error:', err.message); }
  }
  const tickets = await readTickets();
  const idx = tickets.findIndex(t => t.id === ticket.id);
  if (idx !== -1) tickets[idx] = { ...tickets[idx], ...ticket }; else tickets.unshift(ticket);
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
};

const deleteTicketById = async (id) => {
  if (firebaseReady && db) {
    try { await db.collection('tickets').doc(id).delete(); return; } catch (err) { console.error('[Firestore] deleteTicket error:', err.message); }
  }
  const tickets = (await readTickets()).filter(t => t.id !== id);
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
};

// Set up Firestore real-time listener for tickets
if (firebaseReady && db) {
  db.collection('tickets').onSnapshot(snap => {
    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pushSSE('tickets', tickets);
  }, err => console.error('[Firestore] tickets listener error:', err.message));
}

app.get('/api/tickets', async (req, res) => res.json(await readTickets()));

app.post('/api/tickets', async (req, res) => {
  const ticket = req.body;
  if (!ticket.id || !ticket.subject) return res.status(400).json({ error: 'Invalid ticket data' });
  const existing = (await readTickets()).find(t => t.id === ticket.id);
  await writeTicket(ticket);
  if (!existing) {
    try {
      const subject = `[NEW TICKET] ${ticket.id}: ${ticket.subject}`;
      const html = `<div style="font-family:Arial;padding:20px;background:#0c0d12;color:#fff"><h2 style="color:#ff1a1a">New Support Ticket</h2><p><b>ID:</b> ${ticket.id}</p><p><b>Subject:</b> ${ticket.subject}</p><p><b>License:</b> ${ticket.licenseKey||'N/A'}</p><p><b>Message:</b></p><p style="background:#16171f;padding:12px;border-radius:4px;color:#b5b5be">${ticket.message}</p></div>`;
      await sendEmail('support@ragefps.in', subject, html);
    } catch (err) { console.error('Ticket email failed:', err.message); }
  }
  if (!firebaseReady) pushSSE('tickets', await readTickets()); // push manually when no listener
  res.status(201).json(ticket);
});

app.patch('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const tickets = await readTickets();
  const ticket = tickets.find(t => t.id === id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const updated = { ...ticket, ...updates };
  await writeTicket(updated);
  if (!firebaseReady) pushSSE('tickets', await readTickets());
  res.json(updated);
});

app.delete('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  await deleteTicketById(id);
  if (!firebaseReady) pushSSE('tickets', await readTickets());
  res.json({ message: 'Ticket deleted', id });
});

// ─── LICENSES (Firestore → fallback JSON) ────────────────────────────────────
const LICENSES_FILE = path.join(__dirname, 'licenses.json');
const DEFAULT_LICENSES = [
  { id: 'RAGE-DEMO-EXPRESS', username: 'Clasher', email: 'clasher@gmail.com', key: 'RAGE-DEMO-EXPRESS', expiry: '2027-05-22', hwid: 'd1a39d9e4b0d47bcb556ffc76bd488e8', status: 'active', isAdmin: false },
  { id: 'RAGE-ALPHA-9921', username: 'eSportsPlayer', email: 'esports@gmail.com', key: 'RAGE-ALPHA-9921', expiry: '2026-08-15', hwid: 'a93bd1059f1349f2832bc9318b76c8c1', status: 'active', isAdmin: false },
  { id: 'RAGE-PRO-7729', username: 'HackerKid', email: 'hacker@gmail.com', key: 'RAGE-PRO-7729', expiry: '2026-06-01', hwid: '229ab81c002f483c18b7f8c05763901b', status: 'banned', isAdmin: false },
  { id: 'admin', username: 'RageDeveloper', email: 'dev@rage.gg', key: 'admin', expiry: '2030-12-31', hwid: '', status: 'active', isAdmin: true }
];

const readLicenses = async () => {
  if (firebaseReady && db) {
    try {
      const snap = await db.collection('licenses').get();
      if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) { console.error('[Firestore] readLicenses error:', err.message); }
  }
  try {
    if (!fs.existsSync(LICENSES_FILE)) { fs.writeFileSync(LICENSES_FILE, JSON.stringify(DEFAULT_LICENSES, null, 2)); return DEFAULT_LICENSES; }
    return JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf8') || '[]');
  } catch { return DEFAULT_LICENSES; }
};

const writeLicense = async (license) => {
  if (firebaseReady && db) {
    try { await db.collection('licenses').doc(license.key).set(license, { merge: true }); return; } catch (err) { console.error('[Firestore] writeLicense error:', err.message); }
  }
  const licenses = await readLicenses();
  const idx = licenses.findIndex(l => l.key === license.key);
  if (idx !== -1) licenses[idx] = { ...licenses[idx], ...license }; else licenses.unshift(license);
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
};

const deleteLicenseByKey = async (key) => {
  if (firebaseReady && db) {
    try { await db.collection('licenses').doc(key).delete(); return; } catch (err) { console.error('[Firestore] deleteLicense error:', err.message); }
  }
  const licenses = (await readLicenses()).filter(l => l.key !== key);
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
};

// Firestore real-time listener for licenses
if (firebaseReady && db) {
  db.collection('licenses').onSnapshot(snap => {
    const licenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pushSSE('licenses', licenses);
  }, err => console.error('[Firestore] licenses listener error:', err.message));
}

app.get('/api/licenses', async (req, res) => res.json(await readLicenses()));

app.put('/api/licenses/:key', async (req, res) => {
  const { key } = req.params;
  const license = { ...req.body, id: key, key };
  await writeLicense(license);
  if (!firebaseReady) pushSSE('licenses', await readLicenses());
  res.status(200).json(license);
});

app.patch('/api/licenses/:key', async (req, res) => {
  const { key } = req.params;
  const licenses = await readLicenses();
  const existing = licenses.find(l => l.key === key);
  if (!existing) return res.status(404).json({ error: 'License not found' });
  const updated = { ...existing, ...req.body };
  await writeLicense(updated);
  if (!firebaseReady) pushSSE('licenses', await readLicenses());
  res.json(updated);
});

app.delete('/api/licenses/:key', async (req, res) => {
  const { key } = req.params;
  await deleteLicenseByKey(key);
  if (!firebaseReady) pushSSE('licenses', await readLicenses());
  res.json({ message: 'License deleted', key });
});

// ─── AUTH — Password Reset ────────────────────────────────────────────────────
app.post('/api/auth/reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const resetLink = `https://ragefps.in/reset-password?email=${encodeURIComponent(email)}&token=${Math.random().toString(36).substring(2, 15)}`;
  const html = `<div style="font-family:Arial;padding:30px;background:#0c0d12;color:#fff;text-align:center"><h2 style="color:#ff1a1a">Password Reset Request</h2><p style="color:#b5b5be;font-size:14.5px">Click below to reset your Rage Optimization account password.</p><div style="margin:30px 0"><a href="${resetLink}" style="background:#ff1a1a;color:#fff;padding:12px 30px;text-decoration:none;font-weight:bold;border-radius:5px">Reset Password</a></div><p style="color:#555;font-size:12px">If you didn't request this, ignore this email.</p><hr style="border-color:#222;margin:25px 0"><p style="color:#888;font-size:11px">Rage Tweak Vault • support@ragefps.in</p></div>`;
  try {
    await sendEmail(email, 'Rage Optimization — Reset Your Password', html);
    res.json({ message: 'Password reset email dispatched from support@ragefps.in' });
  } catch (err) {
    console.error('Reset email failed:', err.message);
    res.status(500).json({ error: 'Failed to dispatch password reset email' });
  }
});

// ─── STATIC SERVING ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../Website/dist')));
app.use('/admin', express.static(path.join(__dirname, '../AdminPanel/dist')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.path.startsWith('/admin')) {
    res.sendFile(path.join(__dirname, '../AdminPanel/dist/index.html'));
  } else {
    res.sendFile(path.join(__dirname, '../Website/dist/index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`RAGE backend listening on http://localhost:${PORT}`);
  console.log(`Firebase: ${firebaseReady ? '✅ Connected to Firestore' : '⚠️  Local JSON mode (set FIREBASE_SERVICE_ACCOUNT env var)'}`);
});
