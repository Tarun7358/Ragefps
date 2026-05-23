const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'tickets.json');

app.use(cors());
app.use(express.json());

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
app.post('/api/tickets', (req, res) => {
  const newTicket = req.body;
  if (!newTicket.id || !newTicket.subject) {
    return res.status(400).json({ error: "Invalid ticket data" });
  }
  let tickets = readTickets();
  // If it already exists, update it, otherwise prepend
  const index = tickets.findIndex(t => t.id === newTicket.id);
  if (index !== -1) {
    tickets[index] = { ...tickets[index], ...newTicket };
  } else {
    tickets = [newTicket, ...tickets];
  }
  writeTickets(tickets);
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
