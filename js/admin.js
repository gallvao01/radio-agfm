const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loggedUser = document.getElementById('loggedUser');
const newsTableBody = document.getElementById('newsTableBody');
const filterCategory = document.getElementById('filterCategory');

const CATEGORY_LABELS = {
  alagoas: 'Alagoas', interior: 'União dos Palmares', brasil: 'Brasil',
  entretenimento: 'Entretenimento', saude: 'Saúde', esportes: 'Esportes'
};

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}
function hideError(el) {
  el.hidden = true;
}

async function checkSession() {
  const res = await fetch('/api/session');
  const data = await res.json();
  if (data.loggedIn) {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    loggedUser.textContent = data.username;
    loadNews();
  } else {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(loginError);
  const fd = new FormData(loginForm);
  const res = await fetch('/api/login', {
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
  await fetch('/api/logout', { method: 'POST' });
  checkSession();
});

async function loadNews() {
  const category = filterCategory.value;
  const qs = category ? '?category=' + encodeURIComponent(category) : '';
  const res = await fetch('/api/news' + qs);
  const items = await res.json();
  newsTableBody.innerHTML = items.map((n) => `
    <tr>
      <td>${n.featured ? '<span class="badge-featured">Destaque</span>' : ''}</td>
      <td>${escapeHtml(n.title)}</td>
      <td>${CATEGORY_LABELS[n.category] || n.category}</td>
      <td>${new Date(n.created_at).toLocaleDateString('pt-BR')}</td>
      <td class="actions">
        <button class="btn-admin btn-admin--outline btn-sm" data-edit="${n.id}">Editar</button>
        <button class="btn-admin btn-admin--danger btn-sm" data-delete="${n.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Nenhuma notícia cadastrada.</td></tr>';

  newsTableBody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openNewsModal(items.find((n) => n.id === Number(btn.dataset.edit))));
  });
  newsTableBody.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteNews(Number(btn.dataset.delete)));
  });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

filterCategory.addEventListener('change', loadNews);

// ---- Modal notícia ----
const newsModal = document.getElementById('newsModal');
const newsForm = document.getElementById('newsForm');
const newsModalTitle = document.getElementById('newsModalTitle');
const newsFormError = document.getElementById('newsFormError');

function openNewsModal(news) {
  hideError(newsFormError);
  newsForm.reset();
  if (news) {
    newsModalTitle.textContent = 'Editar notícia';
    newsForm.id.value = news.id;
    newsForm.title.value = news.title;
    newsForm.category.value = news.category;
    newsForm.summary.value = news.summary;
    newsForm.content.value = news.content;
    newsForm.image.value = news.image && /^https?:\/\//.test(news.image) ? news.image : '';
    newsForm.featured.checked = !!news.featured;
  } else {
    newsModalTitle.textContent = 'Nova notícia';
    newsForm.id.value = '';
  }
  newsModal.hidden = false;
}

document.getElementById('btnNewNews').addEventListener('click', () => openNewsModal(null));
document.getElementById('btnCancelNews').addEventListener('click', () => { newsModal.hidden = true; });

newsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(newsFormError);
  const fd = new FormData(newsForm);
  const id = fd.get('id');
  const payload = {
    title: fd.get('title'),
    category: fd.get('category'),
    summary: fd.get('summary'),
    content: fd.get('content'),
    image: fd.get('image') || undefined,
    featured: fd.get('featured') === 'on'
  };
  const res = await fetch(id ? `/api/news/${id}` : '/api/news', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    showError(newsFormError, data.error || 'Erro ao salvar notícia');
    return;
  }
  newsModal.hidden = true;
  loadNews();
});

async function deleteNews(id) {
  if (!confirm('Tem certeza que deseja excluir esta notícia?')) return;
  await fetch(`/api/news/${id}`, { method: 'DELETE' });
  loadNews();
}

// ---- Modal troca de senha ----
const passwordModal = document.getElementById('passwordModal');
const passwordForm = document.getElementById('passwordForm');
const passwordFormError = document.getElementById('passwordFormError');

document.getElementById('btnChangePassword').addEventListener('click', () => {
  hideError(passwordFormError);
  passwordForm.reset();
  passwordModal.hidden = false;
});
document.getElementById('btnCancelPassword').addEventListener('click', () => { passwordModal.hidden = true; });

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(passwordFormError);
  const fd = new FormData(passwordForm);
  const res = await fetch('/api/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword') })
  });
  const data = await res.json();
  if (!res.ok) {
    showError(passwordFormError, data.error || 'Erro ao trocar senha');
    return;
  }
  passwordModal.hidden = true;
  alert('Senha alterada com sucesso!');
});

checkSession();
