const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'tickets.json');

app.use(cors());
app.use(express.json());

// Transporter email helper
const sendEmail = async (to, subject, html) => {
  const smtpHost = process.env.SMTP_HOST || 'smtp.ragefps.in';
  const smtpPort = parseInt(process.env.SMTP_PORT) || 465;
  const smtpSecure = process.env.SMTP_SECURE !== 'false';
  const smtpUser = process.env.SMTP_USER || 'support@ragefps.in';
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpPass || smtpPass === 'your-smtp-password') {
    console.log(`\n==========================================`);
    console.log(`[EMAIL SIMULATOR - NO SMTP PASSWORD CONFIGURED]`);
    console.log(`To: ${to}`);
    console.log(`From: support@ragefps.in`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML Body:`);
    console.log(html);
    console.log(`==========================================\n`);
    
    const emailLogPath = path.join(__dirname, 'simulated_emails.json');
    let emailLogs = [];
    try {
      if (fs.existsSync(emailLogPath)) {
        emailLogs = JSON.parse(fs.readFileSync(emailLogPath, 'utf8') || '[]');
      }
    } catch (e) {
      emailLogs = [];
    }
    emailLogs.push({ to, subject, html, timestamp: new Date().toISOString() });
    fs.writeFileSync(emailLogPath, JSON.stringify(emailLogs, null, 2));
    return true;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const mailOptions = {
    from: `"Rage Support" <${smtpUser}>`,
    to,
    subject,
    html
  };

  await transporter.sendMail(mailOptions);
  return true;
};

// Send email notification for new support tickets
const sendTicketNotificationEmail = async (ticket) => {
  const subject = `[NEW SUPPORT TICKET] ${ticket.id}: ${ticket.subject}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #0c0d12; color: #ffffff; border-radius: 8px;">
      <h2 style="color: #ff1a1a;">New Support Ticket Created</h2>
      <p><strong>Ticket ID:</strong> ${ticket.id}</p>
      <p><strong>Subject:</strong> ${ticket.subject}</p>
      <p><strong>License Key:</strong> ${ticket.licenseKey || 'N/A'}</p>
      <p><strong>Status:</strong> ${ticket.status}</p>
      <p><strong>Date:</strong> ${ticket.date || new Date().toISOString()}</p>
      <hr style="border-color: #222;" />
      <h3>Message:</h3>
      <p style="white-space: pre-wrap; background-color: #16171f; padding: 15px; border-radius: 5px; color: #b5b5be;">${ticket.message}</p>
    </div>
  `;
  try {
    await sendEmail('support@ragefps.in', subject, html);
  } catch (err) {
    console.error("Failed to send ticket email notification:", err);
  }
};

// Helper to read tickets
const readTickets = () => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initialMock = [
        { id: 'TICKET-1042', subject: 'HWID Reset requested after CPU upgrade', message: 'I recently upgraded my Intel processor and motherboard, now the loader says HWID mismatch. Please reset.', status: 'Resolved', date: '2 hours ago', licenseKey: 'RAGE-DEMO-EXPRESS' },
        { id: 'TICKET-2281', subject: 'Blue Screen during FPS boost Registry tweak application', message: 'When I apply the registry tweak, my PC blue screens with PAGE_FAULT_IN_NONPAGED_AREA. How can I undo it?', status: 'Pending Review', date: '3 hours ago', licenseKey: 'RAGE-ALPHA-9921' }
      ];
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialMock, null, 2));
      return initialMock;
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error("Error reading tickets file:", error);
    return [];
  }
};

// Helper to write tickets
const writeTickets = (tickets) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(tickets, null, 2));
  } catch (error) {
    console.error("Error writing tickets file:", error);
  }
};

// Get all tickets
app.get('/api/tickets', (req, res) => {
  const tickets = readTickets();
  res.json(tickets);
});

// Create/Update a ticket
app.post('/api/tickets', async (req, res) => {
  const newTicket = req.body;
  if (!newTicket.id || !newTicket.subject) {
    return res.status(400).json({ error: "Invalid ticket data" });
  }
  let tickets = readTickets();
  const index = tickets.findIndex(t => t.id === newTicket.id);
  const isNew = index === -1;
  if (!isNew) {
    tickets[index] = { ...tickets[index], ...newTicket };
  } else {
    tickets = [newTicket, ...tickets];
  }
  writeTickets(tickets);
  
  if (isNew) {
    await sendTicketNotificationEmail(newTicket);
  }
  
  res.status(201).json(newTicket);
});

// Update ticket status
app.patch('/api/tickets/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }
  const tickets = readTickets();
  const index = tickets.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  tickets[index].status = status;
  writeTickets(tickets);
  res.json(tickets[index]);
});

// Delete ticket
app.delete('/api/tickets/:id', (req, res) => {
  const { id } = req.params;
  let tickets = readTickets();
  const index = tickets.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  tickets = tickets.filter(t => t.id !== id);
  writeTickets(tickets);
  res.json({ message: "Ticket deleted successfully", id });
});

// Request password reset email (sent from support@ragefps.in)
app.post('/api/auth/reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // Generate simulated reset token and link
  const resetLink = `https://ragefps.in/reset-password?email=${encodeURIComponent(email)}&token=${Math.random().toString(36).substring(2, 15)}`;
  const subject = "Rage Optimization - Reset Your Password";
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 30px; background-color: #0c0d12; color: #ffffff; text-align: center; border-radius: 8px;">
      <h2 style="color: #ff1a1a; margin-top: 0;">Password Reset Request</h2>
      <p style="color: #b5b5be; font-size: 14.5px; line-height: 1.6;">
        We received a request to reset the password associated with your account. Click the button below to secure a new password.
      </p>
      <div style="margin: 30px 0;">
        <a href="${resetLink}" target="_blank" style="background-color: #ff1a1a; color: #ffffff; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 15px; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #555; font-size: 12px;">
        If you did not request a password reset, please ignore this email.
      </p>
      <hr style="border-color: #222; margin: 25px 0;" />
      <p style="color: #888; font-size: 11px;">Rage Tweak Vault • support@ragefps.in</p>
    </div>
  `;

  try {
    await sendEmail(email, subject, html);
    res.json({ message: "Password reset instructions dispatched from support@ragefps.in" });
  } catch (err) {
    console.error("Error sending reset password email:", err);
    res.status(500).json({ error: "Failed to dispatch password reset email" });
  }
});
// Serve static assets from Website/dist at root
app.use(express.static(path.join(__dirname, '../Website/dist')));

// Serve static assets from AdminPanel/dist at /admin
app.use('/admin', express.static(path.join(__dirname, '../AdminPanel/dist')));

// Fallback all non-API paths to Website's index.html or AdminPanel's index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  if (req.path.startsWith('/admin')) {
    res.sendFile(path.join(__dirname, '../AdminPanel/dist/index.html'));
  } else {
    res.sendFile(path.join(__dirname, '../Website/dist/index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`RAGE support backend listening on http://localhost:${PORT}`);
});
