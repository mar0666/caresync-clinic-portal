require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'caresync_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 }
}));

// Built-in JSON Database File (Zero external setup required)
const DB_FILE = path.join(__dirname, 'database.json');

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], appointments: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Auth Guard
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }
  next();
}

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role, staffCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    let assignedRole = 'patient';
    if (role === 'staff') {
      if (staffCode !== 'CLINIC2026') {
        return res.status(403).json({ error: 'Invalid Staff Access Code. Use CLINIC2026 or register as a Patient.' });
      }
      assignedRole = 'staff';
    }

    const db = readDB();
    const cleanEmail = email.toLowerCase().trim();
    if (db.users.find(u => u.email === cleanEmail)) {
      return res.status(400).json({ error: 'This email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      _id: crypto.randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: assignedRole
    };

    db.users.push(newUser);
    writeDB(db);

    req.session.userId = newUser._id;
    req.session.userName = newUser.name;
    req.session.userEmail = newUser.email;
    req.session.userRole = newUser.role;

    res.status(201).json({ name: newUser.name, email: newUser.email, role: newUser.role });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.email === (email || '').toLowerCase().trim());

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user._id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;

    res.json({ name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully.' });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ authenticated: false });
  res.json({
    authenticated: true,
    name: req.session.userName,
    email: req.session.userEmail,
    role: req.session.userRole
  });
});

// --- APPOINTMENT ROUTES ---
app.get('/api/appointments', requireAuth, (req, res) => {
  const db = readDB();
  const list = req.session.userRole === 'staff'
    ? db.appointments
    : db.appointments.filter(a => a.userId === req.session.userId);

  list.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  res.json(list);
});

app.post('/api/appointments', requireAuth, (req, res) => {
  const { patientName, email, department, dateTime } = req.body;
  if (!patientName || !email || !department || !dateTime) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const db = readDB();
  const conflict = db.appointments.find(
    a => a.department === department && a.dateTime === dateTime && a.status !== 'Cancelled'
  );
  if (conflict) {
    return res.status(409).json({ error: 'That time slot is already booked in this department.' });
  }

  const newAppt = {
    _id: crypto.randomUUID(),
    userId: req.session.userId,
    patientName: patientName.trim(),
    email: email.trim(),
    department,
    dateTime,
    status: 'Scheduled'
  };

  db.appointments.push(newAppt);
  writeDB(db);
  res.status(201).json(newAppt);
});

app.put('/api/appointments/:id/reschedule', requireAuth, (req, res) => {
  const { dateTime } = req.body;
  const db = readDB();
  const appt = db.appointments.find(a =>
    a._id === req.params.id && (req.session.userRole === 'staff' || a.userId === req.session.userId)
  );

  if (!appt) return res.status(404).json({ error: 'Appointment not found or access denied.' });

  const conflict = db.appointments.find(a =>
    a._id !== appt._id && a.department === appt.department && a.dateTime === dateTime && a.status !== 'Cancelled'
  );
  if (conflict) {
    return res.status(409).json({ error: 'New time slot is already occupied.' });
  }

  appt.dateTime = dateTime;
  appt.status = 'Rescheduled';
  writeDB(db);
  res.json(appt);
});

app.put('/api/appointments/:id/cancel', requireAuth, (req, res) => {
  const db = readDB();
  const appt = db.appointments.find(a =>
    a._id === req.params.id && (req.session.userRole === 'staff' || a.userId === req.session.userId)
  );

  if (!appt) return res.status(404).json({ error: 'Appointment not found or access denied.' });

  appt.status = 'Cancelled';
  writeDB(db);
  res.json(appt);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CareSync Clinic Portal running on http://localhost:${PORT}`));
