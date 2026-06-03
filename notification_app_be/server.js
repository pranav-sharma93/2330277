const express = require('express');
const cors = require('cors');
const path = require('path');
const customLogger = require('logging-middleware');
const { readDb, writeDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and parsing of JSON payloads
app.use(cors());
app.use(express.json());

// Enable custom request logging middleware (logs to console & app.log)
app.use(customLogger({
  logFilePath: path.join(__dirname, 'app.log')
}));

// SSE active clients
let clients = [];

/**
 * Broadcast an SSE event to all connected clients
 * @param {string} type - Event type (e.g., 'NEW_NOTIFICATION', 'UPDATE_NOTIFICATION')
 * @param {Object} data - Payload data
 */
function broadcast(type, data) {
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  });
}

// Keep-alive connection ping interval (every 20 seconds)
setInterval(() => {
  clients.forEach(client => {
    client.res.write(': keep-alive\n\n');
  });
}, 20000);

// --- SSE Endpoint ---
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const clientId = Date.now().toString();
  clients.push({ id: clientId, res });

  // Initial connection ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', id: clientId })}\n\n`);

  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
  });
});

// --- REST Endpoints ---

// Get all notifications
app.get('/api/notifications', (req, res) => {
  const db = readDb();
  // Return sorted by creation date descending
  const sorted = [...db.notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(sorted);
});

// Create/Send a new notification
app.post('/api/notifications', (req, res) => {
  const { title, message, channel } = req.body;

  if (!title || !message || !channel) {
    return res.status(400).json({ error: 'Title, message, and channel are required' });
  }

  const validChannels = ['email', 'sms', 'in_app'];
  if (!validChannels.includes(channel)) {
    return res.status(400).json({ error: 'Invalid channel. Must be one of email, sms, or in_app' });
  }

  const newNotification = {
    id: Math.random().toString(36).substring(2, 10).toUpperCase(),
    title,
    message,
    channel,
    status: channel === 'in_app' ? 'delivered' : 'sending',
    read: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    failure_reason: null
  };

  const db = readDb();
  db.notifications.push(newNotification);
  writeDb(db);

  // Return the created notification immediately to the caller
  res.status(201).json(newNotification);

  // Broadcast to all clients immediately
  broadcast('NEW_NOTIFICATION', newNotification);

  // If SMS or Email, simulate background worker processing with random success/failure
  if (channel === 'email' || channel === 'sms') {
    const delay = channel === 'email' ? 3000 : 2000; // Email takes slightly longer
    setTimeout(() => {
      const currentDb = readDb();
      const notificationIndex = currentDb.notifications.findIndex(n => n.id === newNotification.id);

      if (notificationIndex !== -1) {
        // 90% success rate, 10% failure rate
        const isSuccess = Math.random() > 0.1;
        const updatedNotification = {
          ...currentDb.notifications[notificationIndex],
          status: isSuccess ? 'delivered' : 'failed',
          updated_at: new Date().toISOString()
        };

        if (!isSuccess) {
          const failureReasons = {
            email: ['SMTP Connection Refused', 'Recipient Inbox Full', 'Spam Filter Rejected'],
            sms: ['Carrier Network Timeout', 'Invalid Phone Number Format', 'Rate Limit Exceeded on Twilio']
          };
          const reasons = failureReasons[channel];
          updatedNotification.failure_reason = reasons[Math.floor(Math.random() * reasons.length)];
        }

        currentDb.notifications[notificationIndex] = updatedNotification;
        writeDb(currentDb);

        // Broadcast status update to all connected dashboard pages
        broadcast('UPDATE_NOTIFICATION', updatedNotification);
      }
    }, delay);
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const index = db.notifications.findIndex(n => n.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  db.notifications[index].read = true;
  db.notifications[index].updated_at = new Date().toISOString();
  writeDb(db);

  res.json(db.notifications[index]);

  // Broadcast update to sync frontend clients
  broadcast('UPDATE_NOTIFICATION', db.notifications[index]);
});

// Clear all notifications (useful helper)
app.delete('/api/notifications', (req, res) => {
  const db = { notifications: [] };
  writeDb(db);
  res.json({ message: 'All notifications cleared' });
  broadcast('CLEARED_ALL', null);
});

// Get delivery and channel stats
app.get('/api/notifications/stats', (req, res) => {
  const db = readDb();
  const total = db.notifications.length;

  const stats = {
    total,
    delivered: 0,
    failed: 0,
    sending: 0,
    read: 0,
    unread: 0,
    channels: {
      email: 0,
      sms: 0,
      in_app: 0
    }
  };

  db.notifications.forEach(n => {
    // Status
    if (n.status === 'delivered') stats.delivered++;
    else if (n.status === 'failed') stats.failed++;
    else if (n.status === 'sending') stats.sending++;

    // Read status
    if (n.read) stats.read++;
    else stats.unread++;

    // Channels
    if (stats.channels[n.channel] !== undefined) {
      stats.channels[n.channel]++;
    }
  });

  res.json(stats);
});

// Start listening
app.listen(PORT, () => {
  console.log(`\n\x1b[32m[SERVER RUNNING]\x1b[0m Notification App BE is online at http://localhost:${PORT}\n`);
});
