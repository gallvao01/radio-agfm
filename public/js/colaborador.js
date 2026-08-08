const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const profileName = document.getElementById('profileName');
const profilePhoto = document.getElementById('profilePhoto');
const submissionsList = document.getElementById('submissionsList');

const CATEGORY_LABELS = {
  alagoas: 'Alagoas', interior: 'União dos Palmares',
  entretenimento: 'Entretenimento', saude: 'Saúde', esportes: 'Esportes'
};
const STATUS_LABELS = {
  pending: { text: 'Pendente', className: 'status-pending' },
  published: { text: 'Publicado', className: 'status-published' },
  rejected: { text: 'Rejeitado', className: 'status-rejected' }
};

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}
function hideError(el) {
  el.hidden = true;
}
function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function checkSession() {
  const res = await fetch('/api/contributor/session');
  const data = await res.json();
  if (data.loggedIn) {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    profileName.textContent = data.name;
    loadProfile();
    loadSubmissions();
  } else {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }
}

async function loadProfile() {
  const res = await fetch('/api/contributor/profile');
  if (!res.ok) return;
  const data = await res.json();
  if (data.photo) profilePhoto.src = data.photo;
}

async function loadSubmissions() {
  const res = await fetch('/api/contributor/submissions');
  if (!res.ok) return;
  const items = await res.json();
  submissionsList.innerHTML = items.length ? items.map((n) => {
    const status = STATUS_LABELS[n.status] || STATUS_LABELS.pending;
    return `
      <div class="submission-row">
        <span class="submission-row__title">${escapeHtml(n.title)}</span>
        <span class="submission-row__cat">${CATEGORY_LABELS[n.category] || n.category}</span>
        <span class="submission-status ${status.className}">${status.text}</span>
      </div>
    `;
  }).join('') : '<p class="admin-hint">Você ainda não enviou nenhuma pauta.</p>';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(loginError);
  const fd = new FormData(loginForm);
  const res = await fetch('/api/contributor/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') })
  });
  const data = await res.json();
  if (!res.ok) {
    showError(loginError, data.error || 'Erro ao entrar');
    return;
  }
  loginForm.reset();
  checkSession();
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await fetch('/api/contributor/logout', { method: 'POST' });
  checkSession();
});

const submitForm = document.getElementById('submitForm');
const submitError = document.getElementById('submitError');
const submitSuccess = document.getElementById('submitSuccess');

submitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(submitError);
  submitSuccess.hidden = true;
  const fd = new FormData(submitForm);
  const payload = {
    title: fd.get('title'),
    category: fd.get('category'),
    summary: fd.get('summary'),
    content: fd.get('content'),
    image: fd.get('image') || undefined
  };
  const res = await fetch('/api/contributor/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    showError(submitError, data.error || 'Erro ao enviar pauta');
    return;
  }
  submitForm.reset();
  submitSuccess.hidden = false;
  loadSubmissions();
});

checkSession();
