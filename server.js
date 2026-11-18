const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Appointment Schema
const appointmentSchema = new mongoose.Schema({
  patientName: { type: String, required: true, trim: true },
  patientEmail: { type: String, required: true, trim: true },
  department: { type: String, required: true },
  appointmentDate: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

// FEATURE 2A: Retrieve all appointments
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ appointmentDate: 1 });
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve appointments.' });
  }
});

// FEATURE 1: Book a new appointment
app.post('/api/appointments', async (req, res) => {
  try {
    const { patientName, patientEmail, department, appointmentDate } = req.body;
    if (!patientName || !patientEmail || !department || !appointmentDate) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const newAppointment = new Appointment({
      patientName,
      patientEmail,
      department,
      appointmentDate
    });
    const saved = await newAppointment.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Failed to book appointment.' });
  }
});

// FEATURE 2B: Cancel an existing appointment
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const deleted = await Appointment.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    res.status(200).json({ message: 'Appointment cancelled successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel appointment.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
