require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 5000;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'rage-optimization';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

app.use(cors());
app.use(express.json());

// ─── FIREBASE: 3-TIER CONNECTION ──────────────────────────────────────────────
// Tier 1: Firebase Admin SDK (service account → full bypass of security rules)
// Tier 2: Firestore REST API (web API key → works with open security rules)
// Tier 3: Local JSON file fallback
let db = null;
let useRestApi = false;

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const initFirebase = () => {
  try {
    const keyPath = path.join(__dirname, 'firebase-key.json');
    if (fs.existsSync(keyPath)) {
      const serviceAccount = require(keyPath);
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: FIREBASE_PROJECT_ID });
      }
      db = admin.firestore();
      console.log('[Firebase] ✅ Admin SDK connected to Firestore using firebase-key.json (full access).');
      return 'admin';
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim() && !process.env.FIREBASE_SERVICE_ACCOUNT.includes('require')) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: FIREBASE_PROJECT_ID });
      }
      db = admin.firestore();
      console.log('[Firebase] ✅ Admin SDK connected to Firestore using ENV var (full access).');
      return 'admin';
    }
  } catch (err) {
    console.error('[Firebase] Admin SDK init failed:', err.message);
  }

  if (FIREBASE_API_KEY && FIREBASE_PROJECT_ID) {
    useRestApi = true;
    console.log('[Firebase] ✅ Firestore REST API mode active (project: ' + FIREBASE_PROJECT_ID + ').');
    return 'rest';
  }

  console.warn('[Firebase] ⚠️  No credentials configured. Running in local JSON file mode.');
  return 'local';
};

const firebaseMode = initFirebase();

// ─── FIRESTORE REST API HELPERS ───────────────────────────────────────────────
const firestoreGet = async (collection) => {
  const url = `${FIRESTORE_BASE}/${collection}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore GET failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.documents) return [];
  return data.documents.map(doc => {
    const id = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const obj = { id };
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = v.stringValue ?? v.booleanValue ?? v.integerValue ?? v.doubleValue ?? v.nullValue ?? null;
    }
    return obj;
  });
};

const firestoreSet = async (collection, docId, data) => {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') fields[k] = { doubleValue: v };
    else if (v === null || v === undefined) fields[k] = { nullValue: null };
    else fields[k] = { stringValue: String(v) };
  }
  const url = `${FIRESTORE_BASE}/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore SET failed: ${res.status} ${await res.text()}`);
};

const firestoreDelete = async (collection, docId) => {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Firestore DELETE failed: ${res.status} ${await res.text()}`);
};

const firestorePatch = async (collection, docId, updates) => {
  const fields = {};
  const updateMask = [];
  for (const [k, v] of Object.entries(updates)) {
    updateMask.push(k);
    if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') fields[k] = { doubleValue: v };
    else if (v === null || v === undefined) fields[k] = { nullValue: null };
    else fields[k] = { stringValue: String(v) };
  }
  const maskStr = updateMask.map(f => `updateMask.fieldPaths=${f}`).join('&');
  const url = `${FIRESTORE_BASE}/${collection}/${docId}?key=${FIREBASE_API_KEY}&${maskStr}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore PATCH failed: ${res.status} ${await res.text()}`);
};

// ─── SSE REAL-TIME CLIENTS ────────────────────────────────────────────────────
const sseClients = { licenses: [], tickets: [] };

const pushSSE = (channel, data) => {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients[channel] = sseClients[channel].filter(res => {
    try { res.write(payload); return true; } catch { return false; }
  });
};

app.get('/api/sse/:channel', async (req, res) => {
  const { channel } = req.params;
  if (!sseClients[channel]) return res.status(404).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current snapshot immediately on connect
  try {
    const data = channel === 'licenses' ? await readLicenses() : await readTickets();
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (err) { console.error('SSE initial send error:', err.message); }

  sseClients[channel].push(res);
  req.on('close', () => { sseClients[channel] = sseClients[channel].filter(c => c !== res); });
});

// Firestore Admin SDK real-time listeners (only when using Admin SDK)
if (firebaseMode === 'admin' && db) {
  db.collection('licenses').onSnapshot(snap => {
    const licenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pushSSE('licenses', licenses);
  }, err => console.error('[Firestore] licenses listener:', err.message));

  db.collection('tickets').onSnapshot(snap => {
    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pushSSE('tickets', tickets);
  }, err => console.error('[Firestore] tickets listener:', err.message));
}

// ─── EMAIL ────────────────────────────────────────────────────────────────────
const sendEmail = async (to, subject, html) => {
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpPass || smtpPass === 'your-smtp-password-here') {
    console.log(`[EMAIL SIMULATOR] To: ${to} | Subject: ${subject}`);
    const logPath = path.join(__dirname, 'simulated_emails.json');
    let logs = [];
    try { if (fs.existsSync(logPath)) logs = JSON.parse(fs.readFileSync(logPath, 'utf8') || '[]'); } catch { }
    logs.push({ to, subject, html, timestamp: new Date().toISOString() });
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ragefps.in',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: process.env.SMTP_USER || 'support@ragefps.in', pass: smtpPass }
  });
  await transporter.sendMail({ from: `"Rage Support" <${process.env.SMTP_USER || 'support@ragefps.in'}>`, to, subject, html });
};

// ─── LICENSES ─────────────────────────────────────────────────────────────────
const LICENSES_FILE = path.join(__dirname, 'licenses.json');
const DEFAULT_LICENSES = [
  { id: 'RAGE-DEMO-EXPRESS', username: 'Clasher', email: 'clasher@gmail.com', key: 'RAGE-DEMO-EXPRESS', expiry: '2027-05-22', hwid: '', status: 'active', isAdmin: false },
  { id: 'RAGE-ALPHA-9921', username: 'eSportsPlayer', email: 'esports@gmail.com', key: 'RAGE-ALPHA-9921', expiry: '2026-08-15', hwid: '', status: 'active', isAdmin: false },
  { id: 'admin', username: 'RageDeveloper', email: 'dev@rage.gg', key: 'admin', expiry: '2030-12-31', hwid: '', status: 'active', isAdmin: true }
];

const readLicenses = async () => {
  let raw = [];
  if (firebaseMode === 'admin' && db) {
    try {
      const snap = await db.collection('licenses').get();
      raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) { console.error('[Firebase Admin] readLicenses error:', err.message); }
  } else if (firebaseMode === 'rest') {
    try { raw = await firestoreGet('licenses'); }
    catch (err) { console.error('[Firestore REST] readLicenses error:', err.message); }
  } else {
    try {
      if (!fs.existsSync(LICENSES_FILE)) { fs.writeFileSync(LICENSES_FILE, JSON.stringify(DEFAULT_LICENSES, null, 2)); raw = DEFAULT_LICENSES; }
      else { raw = JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf8') || '[]'); }
    } catch { raw = DEFAULT_LICENSES; }
  }

  return raw.map(doc => ({
    id: doc.id,
    key: doc.key || doc.id,
    username: doc.username || '',
    email: doc.email || '',
    expiry: doc.expiry || (doc.expiryDate ? doc.expiryDate.split('T')[0] : ''),
    hwid: doc.hwid || '',
    status: doc.status || 'active',
    isAdmin: !!doc.isAdmin
  }));
};

const saveLicense = async (license) => {
  const { id, ...data } = license;
  const key = license.key || id;
  if (firebaseMode === 'admin' && db) {
    try { await db.collection('licenses').doc(key).set(license, { merge: true }); pushSSE('licenses', await readLicenses()); return; } catch (err) { console.error('[Firebase Admin] saveLicense error:', err.message); }
  }
  if (firebaseMode === 'rest') {
    try { await firestoreSet('licenses', key, license); pushSSE('licenses', await readLicenses()); return; } catch (err) { console.error('[Firestore REST] saveLicense error:', err.message); }
  }
  const licenses = await readLicenses();
  const idx = licenses.findIndex(l => l.key === key);
  if (idx !== -1) licenses[idx] = { ...licenses[idx], ...license }; else licenses.unshift(license);
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
  pushSSE('licenses', licenses);
};

const patchLicense = async (key, updates) => {
  if (firebaseMode === 'admin' && db) {
    try { await db.collection('licenses').doc(key).update(updates); pushSSE('licenses', await readLicenses()); return; } catch (err) { console.error('[Firebase Admin] patchLicense error:', err.message); }
  }
  if (firebaseMode === 'rest') {
    try { await firestorePatch('licenses', key, updates); pushSSE('licenses', await readLicenses()); return; } catch (err) { console.error('[Firestore REST] patchLicense error:', err.message); }
  }
  const licenses = await readLicenses();
  const idx = licenses.findIndex(l => l.key === key);
  if (idx !== -1) { licenses[idx] = { ...licenses[idx], ...updates }; fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2)); pushSSE('licenses', licenses); }
};

const deleteLicense = async (key) => {
  if (firebaseMode === 'admin' && db) {
    try { await db.collection('licenses').doc(key).delete(); pushSSE('licenses', await readLicenses()); return; } catch (err) { console.error('[Firebase Admin] deleteLicense error:', err.message); }
  }
  if (firebaseMode === 'rest') {
    try { await firestoreDelete('licenses', key); pushSSE('licenses', await readLicenses()); return; } catch (err) { console.error('[Firestore REST] deleteLicense error:', err.message); }
  }
  const licenses = (await readLicenses()).filter(l => l.key !== key);
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
  pushSSE('licenses', licenses);
};

app.get('/api/licenses', async (req, res) => {
  try { res.json(await readLicenses()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/licenses/:key', async (req, res) => {
  const { key } = req.params;
  const license = { ...req.body, id: key, key };
  try { await saveLicense(license); res.status(200).json(license); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/licenses/:key', async (req, res) => {
  const { key } = req.params;
  try {
    await patchLicense(key, req.body);
    const licenses = await readLicenses();
    res.json(licenses.find(l => l.key === key) || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/licenses/:key', async (req, res) => {
  const { key } = req.params;
  try { await deleteLicense(key); res.json({ message: 'License deleted', key }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── TICKETS ──────────────────────────────────────────────────────────────────
const TICKETS_FILE = path.join(__dirname, 'tickets.json');
const DEFAULT_TICKETS = [
  { id: 'TICKET-1042', subject: 'HWID Reset after CPU upgrade', message: 'I recently upgraded my processor and HWID mismatches. Please reset.', status: 'Resolved', date: '2 hours ago', licenseKey: 'RAGE-DEMO-EXPRESS' },
  { id: 'TICKET-2281', subject: 'Blue Screen during FPS tweak', message: 'Registry tweak causes BSOD. How to undo?', status: 'Pending Review', date: '3 hours ago', licenseKey: 'RAGE-ALPHA-9921' }
];

const readTickets = async () => {
  if (firebaseMode === 'admin' && db) {
    try { const snap = await db.collection('tickets').get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch (err) { console.error('[Firebase Admin] readTickets error:', err.message); }
  }
  if (firebaseMode === 'rest') {
    try { return await firestoreGet('tickets'); } catch (err) { console.error('[Firestore REST] readTickets error:', err.message); }
  }
  try {
    if (!fs.existsSync(TICKETS_FILE)) { fs.writeFileSync(TICKETS_FILE, JSON.stringify(DEFAULT_TICKETS, null, 2)); return DEFAULT_TICKETS; }
    return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8') || '[]');
  } catch { return DEFAULT_TICKETS; }
};

const saveTicket = async (ticket) => {
  if (firebaseMode === 'admin' && db) {
    try { await db.collection('tickets').doc(ticket.id).set(ticket, { merge: true }); pushSSE('tickets', await readTickets()); return; } catch (err) { console.error('[Firebase Admin] saveTicket error:', err.message); }
  }
  if (firebaseMode === 'rest') {
    try { await firestoreSet('tickets', ticket.id, ticket); pushSSE('tickets', await readTickets()); return; } catch (err) { console.error('[Firestore REST] saveTicket error:', err.message); }
  }
  const tickets = await readTickets();
  const idx = tickets.findIndex(t => t.id === ticket.id);
  if (idx !== -1) tickets[idx] = { ...tickets[idx], ...ticket }; else tickets.unshift(ticket);
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
  pushSSE('tickets', tickets);
};

const deleteTicket = async (id) => {
  if (firebaseMode === 'admin' && db) {
    try { await db.collection('tickets').doc(id).delete(); pushSSE('tickets', await readTickets()); return; } catch (err) { console.error('[Firebase Admin] deleteTicket error:', err.message); }
  }
  if (firebaseMode === 'rest') {
    try { await firestoreDelete('tickets', id); pushSSE('tickets', await readTickets()); return; } catch (err) { console.error('[Firestore REST] deleteTicket error:', err.message); }
  }
  const tickets = (await readTickets()).filter(t => t.id !== id);
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
  pushSSE('tickets', tickets);
};

app.get('/api/tickets', async (req, res) => {
  try { res.json(await readTickets()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tickets', async (req, res) => {
  const ticket = req.body;
  if (!ticket.id || !ticket.subject) return res.status(400).json({ error: 'Invalid ticket data' });
  const existing = (await readTickets()).find(t => t.id === ticket.id);
  await saveTicket(ticket);
  if (!existing) {
    try {
      const html = `<div style="font-family:Arial;padding:20px;background:#0c0d12;color:#fff"><h2 style="color:#ff1a1a">New Support Ticket</h2><p><b>ID:</b> ${ticket.id}</p><p><b>Subject:</b> ${ticket.subject}</p><p><b>License:</b> ${ticket.licenseKey || 'N/A'}</p><p style="background:#16171f;padding:12px;border-radius:4px;color:#b5b5be">${ticket.message}</p></div>`;
      await sendEmail('support@ragefps.in', `[NEW TICKET] ${ticket.id}: ${ticket.subject}`, html);
    } catch (err) { console.error('Ticket email failed:', err.message); }
  }
  res.status(201).json(ticket);
});

app.patch('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const tickets = await readTickets();
  const ticket = tickets.find(t => t.id === id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const updated = { ...ticket, ...req.body };
  await saveTicket(updated);
  res.json(updated);
});

app.delete('/api/tickets/:id', async (req, res) => {
  try { await deleteTicket(req.params.id); res.json({ message: 'Ticket deleted', id: req.params.id }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AUTH — Password Reset ────────────────────────────────────────────────────
app.post('/api/auth/reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const resetLink = `https://ragefps.in/reset-password?email=${encodeURIComponent(email)}&token=${Math.random().toString(36).substring(2, 15)}`;
  const html = `<div style="font-family:Arial;padding:30px;background:#0c0d12;color:#fff;text-align:center"><h2 style="color:#ff1a1a">Password Reset Request</h2><p style="color:#b5b5be">Click below to reset your Rage Optimization password.</p><div style="margin:30px 0"><a href="${resetLink}" style="background:#ff1a1a;color:#fff;padding:12px 30px;text-decoration:none;font-weight:bold;border-radius:5px">Reset Password</a></div><p style="color:#555;font-size:12px">If you didn't request this, ignore this email.</p><hr style="border-color:#222;margin:25px 0"><p style="color:#888;font-size:11px">Rage Tweak Vault • support@ragefps.in</p></div>`;
  try {
    await sendEmail(email, 'Rage Optimization — Reset Your Password', html);
    res.json({ message: 'Password reset email dispatched from support@ragefps.in' });
  } catch (err) {
    console.error('Reset email failed:', err.message);
    res.status(500).json({ error: 'Failed to dispatch password reset email' });
  }
});

// Firebase connection status endpoint
app.get('/api/status', (req, res) => {
  res.json({ mode: firebaseMode, project: FIREBASE_PROJECT_ID, status: 'online' });
});

// ─── STATIC SERVING ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../Website/dist')));
app.use('/admin', express.static(path.join(__dirname, '../AdminPanel/dist')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.path.startsWith('/admin')) res.sendFile(path.join(__dirname, '../AdminPanel/dist/index.html'));
  else res.sendFile(path.join(__dirname, '../Website/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🔥 RAGE Backend running on http://localhost:${PORT}`);
  console.log(`📦 Firebase mode: ${firebaseMode.toUpperCase()}`);
  console.log(`📁 Data stored in: ${firebaseMode === 'local' ? 'local JSON files' : `Firestore (${FIREBASE_PROJECT_ID})`}\n`);
});
