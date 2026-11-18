let allAppointments = [];

function showMessage(msg, isSuccess = false) {
  const el = document.getElementById('statusMessage');
  el.textContent = msg;
  el.className = isSuccess ? 'alert success' : 'alert';
  setTimeout(() => el.classList.add('hidden'), 4500);
}

function showAuthMode(mode) {
  document.getElementById('loginForm').classList.toggle('hidden', mode !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', mode !== 'register');
  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabRegister').classList.toggle('active', mode === 'register');
}

function toggleStaffCode() {
  const role = document.getElementById('regRole').value;
  document.getElementById('staffCodeGroup').classList.toggle('hidden', role !== 'staff');
}

function togglePrivacyModal(show) {
  document.getElementById('privacyModal').classList.toggle('hidden', !show);
}

async function checkSession() {
  const res = await fetch('/api/me');
  if (res.ok) {
    const user = await res.json();
    enterPortal(user);
  } else {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('portalSection').classList.add('hidden');
    document.getElementById('userControls').classList.add('hidden');
  }
}

function enterPortal(user) {
  document.getElementById('authSection').classList.add('hidden');
  document.getElementById('portalSection').classList.remove('hidden');
  document.getElementById('userControls').classList.remove('hidden');

  const roleLabel = user.role === 'staff' ? 'Staff Admin' : 'Patient';
  document.getElementById('userGreeting').textContent = `${user.name} (${roleLabel})`;
  document.getElementById('privacyScopeBadge').textContent =
    user.role === 'staff' ? 'Clinic-Wide Staff View' : 'Private Patient View';

  if (user.role === 'patient') {
    document.getElementById('patientName').value = user.name;
    document.getElementById('patientEmail').value = user.email;
  } else {
    document.getElementById('patientName').value = '';
    document.getElementById('patientEmail').value = '';
  }

  fetchAppointments();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) {
    enterPortal(data);
  } else {
    showMessage(data.error);
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;
  const staffCode = document.getElementById('staffCode').value;

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role, staffCode })
  });
  const data = await res.json();
  if (res.ok) {
    showMessage('Account created! Welcome to CareSync.', true);
    enterPortal(data);
  } else {
    showMessage(data.error);
  }
});

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  allAppointments = [];
  checkSession();
}

async function fetchAppointments() {
  const res = await fetch('/api/appointments');
  if (!res.ok) return;
  allAppointments = await res.json();
  updateReminderBanner();
  renderAppointments();
}

function updateReminderBanner() {
  const banner = document.getElementById('reminderBar');
  const text = document.getElementById('reminderText');
  const nextAppt = allAppointments.find(a => a.status !== 'Cancelled');

  if (nextAppt) {
    const formatted = new Date(nextAppt.dateTime).toLocaleString();
    text.textContent = `${nextAppt.patientName} (${nextAppt.department}) on ${formatted}.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function renderAppointments() {
  const container = document.getElementById('appointmentsContainer');
  const query = document.getElementById('searchFilter').value.toLowerCase();

  const filtered = allAppointments.filter(a =>
    a.patientName.toLowerCase().includes(query) ||
    a.department.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:#64748b;">No appointments found.</p>';
    return;
  }

  container.innerHTML = filtered.map(appt => {
    const formattedDate = new Date(appt.dateTime).toLocaleString();
    return `
      <div class="appt-card">
        <div class="appt-title">
          <span>${appt.patientName} — ${appt.department}</span>
          <span class="status-pill ${appt.status}">${appt.status}</span>
        </div>
        <div class="appt-meta">${formattedDate} | ${appt.email}</div>
        ${appt.status !== 'Cancelled' ? `
          <div class="action-row">
            <button class="btn-action" onclick="openReschedule('${appt._id}', '${appt.dateTime}')">Reschedule</button>
            <button class="btn-action danger" onclick="cancelAppointment('${appt._id}')">Cancel</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

document.getElementById('bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const patientName = document.getElementById('patientName').value;
  const email = document.getElementById('patientEmail').value;
  const department = document.getElementById('department').value;
  const dateTime = document.getElementById('dateTime').value;

  const res = await fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientName, email, department, dateTime })
  });
  const data = await res.json();

  if (res.ok) {
    showMessage('Appointment confirmed!', true);
    document.getElementById('dateTime').value = '';
    fetchAppointments();
  } else {
    showMessage(data.error);
  }
});

function openReschedule(id, currentDateTime) {
  document.getElementById('rescheduleId').value = id;
  document.getElementById('newDateTime').value = currentDateTime;
  document.getElementById('rescheduleModal').classList.remove('hidden');
}

function closeReschedule() {
  document.getElementById('rescheduleModal').classList.add('hidden');
}

document.getElementById('rescheduleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('rescheduleId').value;
  const dateTime = document.getElementById('newDateTime').value;

  const res = await fetch(`/api/appointments/${id}/reschedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateTime })
  });
  const data = await res.json();

  if (res.ok) {
    closeReschedule();
    showMessage('Appointment rescheduled!', true);
    fetchAppointments();
  } else {
    showMessage(data.error);
  }
});

async function cancelAppointment(id) {
  if (!confirm('Cancel this appointment?')) return;
  const res = await fetch(`/api/appointments/${id}/cancel`, { method: 'PUT' });
  if (res.ok) {
    showMessage('Appointment cancelled.', true);
    fetchAppointments();
  }
}

checkSession();
