const API_BASE = '/api/appointments';
let allAppointments = [];

const bookingForm = document.getElementById('bookingForm');
const appointmentsList = document.getElementById('appointmentsList');
const searchInput = document.getElementById('searchInput');
const statusMessage = document.getElementById('statusMessage');

// Reusable DRY helper for all API requests
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Server request failed');
  }
  return data;
}

function showStatus(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  setTimeout(() => statusMessage.classList.add('hidden'), 3500);
}

// Feature 2A: Load and render appointments
async function loadAppointments() {
  try {
    allAppointments = await apiRequest(API_BASE);
    renderAppointments(allAppointments);
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

function renderAppointments(items) {
  if (items.length === 0) {
    appointmentsList.innerHTML = '<p>No scheduled appointments found.</p>';
    return;
  }
  appointmentsList.innerHTML = items.map((appt) => `
    <div class="item">
      <div>
        <h3>${appt.patientName} — ${appt.department}</h3>
        <p>${new Date(appt.appointmentDate).toLocaleString()} | ${appt.patientEmail}</p>
      </div>
      <button class="btn-danger" onclick="cancelAppointment('${appt._id}')">Cancel</button>
    </div>
  `).join('');
}

// Feature 1: Submit booking
bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    patientName: document.getElementById('patientName').value.trim(),
    patientEmail: document.getElementById('patientEmail').value.trim(),
    department: document.getElementById('department').value,
    appointmentDate: document.getElementById('appointmentDate').value
  };

  try {
    await apiRequest(API_BASE, { method: 'POST', body: JSON.stringify(payload) });
    showStatus('Appointment booked successfully!', 'success');
    bookingForm.reset();
    loadAppointments();
  } catch (err) {
    showStatus(err.message, 'error');
  }
});

// Feature 2B: Cancel booking
async function cancelAppointment(id) {
  try {
    await apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });
    showStatus('Appointment cancelled.', 'success');
    loadAppointments();
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

// Filter appointments in real time
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allAppointments.filter((a) =>
    a.patientName.toLowerCase().includes(query) ||
    a.department.toLowerCase().includes(query)
  );
  renderAppointments(filtered);
});

loadAppointments();
