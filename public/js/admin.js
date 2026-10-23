const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loggedUser = document.getElementById('loggedUser');
const newsTableBody = document.getElementById('newsTableBody');
const filterCategory = document.getElementById('filterCategory');
const searchNews = document.getElementById('searchNews');

const CATEGORY_LABELS = {
  alagoas: 'Alagoas', interior: 'União dos Palmares',
  entretenimento: 'Entretenimento', saude: 'Saúde', esportes: 'Esportes',
  brasil: 'Brasil', mundo: 'Mundo'
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
    loadPending();
    loadContributors();
    loadComprovantes();
    loadPauta();
  } else {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }
}

// ---- Abas ----
document.querySelectorAll('.admin-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('admin-tab--active'));
    tab.classList.add('admin-tab--active');
    document.getElementById('tabNews').hidden = tab.dataset.tab !== 'news';
    document.getElementById('tabPauta').hidden = tab.dataset.tab !== 'pauta';
    document.getElementById('tabPending').hidden = tab.dataset.tab !== 'pending';
    document.getElementById('tabContributors').hidden = tab.dataset.tab !== 'contributors';
    document.getElementById('tabComprovantes').hidden = tab.dataset.tab !== 'comprovantes';
  });
});

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
  let items = await res.json();
  const search = searchNews.value.trim().toLowerCase();
  if (search) items = items.filter((n) => n.title.toLowerCase().includes(search));
  newsTableBody.innerHTML = items.map((n) => `
    <tr>
      <td>${n.featured ? '<span class="badge-featured">Destaque</span>' : ''}</td>
      <td>${escapeHtml(n.title)}</td>
      <td>${CATEGORY_LABELS[n.category] || n.category}</td>
      <td>${new Date(n.created_at).toLocaleDateString('pt-BR')}</td>
      <td>${n.views || 0}</td>
      <td>${n.clicks || 0}</td>
      <td class="actions">
        <button class="btn-admin btn-admin--outline btn-sm" data-edit="${n.id}">Editar</button>
        <button class="btn-admin btn-admin--outline btn-sm" data-link="${n.id}">Copiar link</button>
        <button class="btn-admin btn-admin--danger btn-sm" data-delete="${n.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7">Nenhuma notícia cadastrada.</td></tr>';

  newsTableBody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openNewsModal(items.find((n) => n.id === Number(btn.dataset.edit))));
  });
  newsTableBody.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteNews(Number(btn.dataset.delete)));
  });
  newsTableBody.querySelectorAll('[data-link]').forEach((btn) => {
    btn.addEventListener('click', () => copyNewsLink(Number(btn.dataset.link), btn));
  });
}

function copyNewsLink(id, btn) {
  const url = `${window.location.origin}/noticia.html?id=${id}`;
  const done = () => {
    const original = btn.textContent;
    btn.textContent = 'Copiado!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(done).catch(() => {
      window.prompt('Copie o link da matéria:', url);
    });
  } else {
    window.prompt('Copie o link da matéria:', url);
  }
}

// Mesma regra do servidor: a antiga imagem padrão (SVG verde "AG FM") não conta como foto.
function hasPhoto(image) {
  const img = String(image || '').trim();
  return !!img && !img.startsWith('data:image/svg');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

filterCategory.addEventListener('change', loadNews);
searchNews.addEventListener('input', loadNews);

// ---- Colaboradores (somente leitura) ----
const contributorsGrid = document.getElementById('contributorsGrid');

async function loadContributors() {
  const res = await fetch('/api/admin/contributors');
  if (!res.ok) return;
  const items = await res.json();
  contributorsGrid.innerHTML = items.length ? items.map((c) => `
    <div class="contributor-card">
      <img class="contributor-card__photo" src="${escapeHtml(c.photo || 'assets/img/logo-ag-news.png?v=2026081202')}" alt="">
      <div>
        <p class="contributor-card__name">${escapeHtml(c.name)}</p>
        <p class="contributor-card__username">usuário: ${escapeHtml(c.username)}</p>
      </div>
    </div>
  `).join('') : '<p class="admin-hint">Nenhum colaborador cadastrado.</p>';
}

// ---- Fila de revisão (ingestão automática) ----
const pendingList = document.getElementById('pendingList');
const pendingCount = document.getElementById('pendingCount');

async function loadPending() {
  const res = await fetch('/api/admin/news/pending');
  if (!res.ok) return;
  const items = await res.json();

  if (items.length) {
    pendingCount.textContent = items.length;
    pendingCount.hidden = false;
  } else {
    pendingCount.hidden = true;
  }

  pendingList.innerHTML = items.length ? items.map((n) => `
    <article class="pending-card">
      ${hasPhoto(n.image)
        ? `<img src="${escapeHtml(n.image)}" alt="" class="pending-card__img">`
        : '<div class="pending-card__img pending-card__nophoto">Sem foto</div>'}
      <div class="pending-card__body">
        <span class="card__tag">${CATEGORY_LABELS[n.category] || n.category}</span>
        <h3>${escapeHtml(n.title)}</h3>
        <p class="pending-card__summary">${escapeHtml(n.summary)}</p>
        ${n.source_url
          ? `<a href="${escapeHtml(n.source_url)}" target="_blank" rel="noopener" class="pending-card__source">Fonte: ${escapeHtml(n.source_name || n.source_url)}</a>`
          : n.source_name
            ? `<span class="pending-card__source">Enviado por: ${escapeHtml(n.source_name)}</span>`
            : ''}
        ${hasPhoto(n.image) ? '' : '<p class="admin-error">Sem foto: use "Editar antes de aprovar" e coloque o link de uma foto do fato.</p>'}
        <div class="admin-dashboard__actions">
          <button class="btn-admin btn-admin--outline btn-sm" data-edit-pending="${n.id}">Editar antes de aprovar</button>
          <button class="btn-admin btn-sm" data-approve="${n.id}" ${hasPhoto(n.image) ? '' : 'disabled'}>Aprovar e publicar</button>
          <button class="btn-admin btn-admin--danger btn-sm" data-reject="${n.id}">Rejeitar</button>
        </div>
      </div>
    </article>
  `).join('') : '<p class="admin-hint">Nenhuma pauta pendente no momento.</p>';

  pendingList.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const res = await fetch(`/api/news/${btn.dataset.approve}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Não foi possível aprovar.');
      }
      loadPending();
      loadNews();
    });
  });
  pendingList.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Rejeitar esta pauta? Ela não será publicada.')) return;
      await fetch(`/api/news/${btn.dataset.reject}/reject`, { method: 'POST' });
      loadPending();
    });
  });
  pendingList.querySelectorAll('[data-edit-pending]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = items.find((item) => item.id === Number(btn.dataset.editPending));
      openNewsModal(n, { approveOnSave: true });
    });
  });
}

// ---- Pauta automática (pesquisa com o Claude) ----
const pautaAviso = document.getElementById('pautaAviso');
const pautaCats = document.getElementById('pautaCats');
const pautaQtd = document.getElementById('pautaQtd');
const pautaFoco = document.getElementById('pautaFoco');
const pautaRunForm = document.getElementById('pautaRunForm');
const btnPautaRun = document.getElementById('btnPautaRun');
const pautaRodando = document.getElementById('pautaRodando');
const pautaConfigForm = document.getElementById('pautaConfigForm');
const pautaAtivo = document.getElementById('pautaAtivo');
const pautaAutopublicar = document.getElementById('pautaAutopublicar');
const pautaHorarios = document.getElementById('pautaHorarios');
const pautaConfigMsg = document.getElementById('pautaConfigMsg');
const pautaHistorico = document.getElementById('pautaHistorico');
let pautaPoll = null;
let pautaCatsRendered = false;

const PAUTA_STATUS = { rodando: 'Em andamento', concluida: 'Concluída', erro: 'Erro' };
const PAUTA_ORIGEM = { manual: 'Manual', agendada: 'Programada' };

function addHorarioRow(value = '') {
  const row = document.createElement('div');
  row.className = 'insercao-row';
  row.innerHTML = `
    <input type="time" class="pauta-horario" value="${escapeHtml(value)}" required>
    <button type="button" class="btn-admin btn-admin--danger btn-sm">Remover</button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  pautaHorarios.appendChild(row);
}

function selectedPautaCats() {
  return [...pautaCats.querySelectorAll('input[type="checkbox"]:checked')].map((i) => i.value);
}

function formatDateTimeBR(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T'));
  return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function loadPauta() {
  const res = await fetch('/api/admin/pauta');
  if (!res.ok) return;
  const data = await res.json();

  if (!data.configurado) {
    showError(pautaAviso, 'A pauta automática ainda não está ligada: falta configurar a chave ANTHROPIC_API_KEY nas variáveis de ambiente do site na Hostinger.');
  } else {
    hideError(pautaAviso);
  }

  if (!pautaCatsRendered) {
    pautaCatsRendered = true;
    pautaCats.insertAdjacentHTML('beforeend', data.categoriasDisponiveis.map((k) => `
      <label class="admin-checkbox"><input type="checkbox" value="${k}" ${data.config.categorias.includes(k) ? 'checked' : ''}> ${CATEGORY_LABELS[k] || k}</label>
    `).join(''));
    pautaQtd.value = String(data.config.quantidade);
    pautaAtivo.checked = !!data.config.ativo;
    pautaAutopublicar.checked = !!data.config.autopublicar;
    pautaHorarios.innerHTML = '';
    data.config.horarios.forEach((h) => addHorarioRow(h));
  }

  const rodando = !!data.rodando;
  pautaRodando.hidden = !rodando;
  btnPautaRun.disabled = rodando || !data.configurado;

  pautaHistorico.innerHTML = data.execucoes.length ? data.execucoes.map((r) => `
    <div class="pauta-run pauta-run--${escapeHtml(r.status)}">
      <div class="pauta-run__top">
        <strong>${PAUTA_STATUS[r.status] || escapeHtml(r.status)}</strong>
        <span>${formatDateTimeBR(r.started_at)} · ${PAUTA_ORIGEM[r.origem] || escapeHtml(r.origem)}</span>
      </div>
      <div class="pauta-run__cats">${r.categorias.split(',').map((k) => CATEGORY_LABELS[k] || k).join(', ')}</div>
      ${r.mensagem ? `<div class="pauta-run__msg">${escapeHtml(r.mensagem)}</div>` : ''}
    </div>
  `).join('') : '<p class="admin-hint">Nenhuma busca feita ainda.</p>';

  clearTimeout(pautaPoll);
  if (rodando) {
    pautaPoll = setTimeout(() => { loadPauta(); loadPending(); }, 10000);
  }
}

pautaRunForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(pautaAviso);
  const categorias = selectedPautaCats();
  if (!categorias.length) {
    showError(pautaAviso, 'Escolha pelo menos uma categoria.');
    return;
  }
  btnPautaRun.disabled = true;
  const res = await fetch('/api/admin/pauta/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categorias, quantidade: Number(pautaQtd.value), foco: pautaFoco.value.trim() })
  });
  const data = await res.json();
  if (!res.ok) {
    showError(pautaAviso, data.error || 'Não foi possível iniciar a busca.');
    btnPautaRun.disabled = false;
    return;
  }
  pautaFoco.value = '';
  loadPauta();
});

document.getElementById('btnAddHorario').addEventListener('click', () => {
  if (pautaHorarios.children.length < 6) addHorarioRow('12:00');
});

pautaConfigForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const horarios = [...pautaHorarios.querySelectorAll('.pauta-horario')].map((i) => i.value).filter(Boolean);
  const res = await fetch('/api/admin/pauta/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ativo: pautaAtivo.checked,
      autopublicar: pautaAutopublicar.checked,
      horarios,
      categorias: selectedPautaCats(),
      quantidade: Number(pautaQtd.value)
    })
  });
  const data = await res.json();
  pautaConfigMsg.hidden = false;
  if (!res.ok) {
    pautaConfigMsg.textContent = data.error || 'Erro ao salvar a programação.';
    return;
  }
  pautaConfigMsg.textContent = data.config.ativo
    ? `Programação salva: busca automática às ${data.config.horarios.join(', ')}.`
    : 'Programação salva. A busca automática está desligada.';
});

// ---- Modal notícia ----
const newsModal = document.getElementById('newsModal');
const newsForm = document.getElementById('newsForm');
const newsModalTitle = document.getElementById('newsModalTitle');
const newsFormError = document.getElementById('newsFormError');

let newsModalApproveOnSave = false;

function openNewsModal(news, opts = {}) {
  hideError(newsFormError);
  newsForm.reset();
  newsModalApproveOnSave = !!opts.approveOnSave;
  if (news) {
    newsModalTitle.textContent = newsModalApproveOnSave ? 'Revisar pauta pendente' : 'Editar notícia';
    newsForm.id.value = news.id;
    newsForm.title.value = news.title;
    newsForm.category.value = news.category;
    newsForm.summary.value = news.summary;
    newsForm.content.value = news.content;
    newsForm.image.value = news.image && /^https?:\/\//.test(news.image) ? news.image : '';
    newsForm.image.required = !hasPhoto(news.image);
    newsForm.video.value = news.video || '';
    newsForm.featured.checked = !!news.featured;
  } else {
    newsModalTitle.textContent = 'Nova notícia';
    newsForm.id.value = '';
    newsForm.image.required = true;
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
    video: fd.get('video') || undefined,
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
  if (newsModalApproveOnSave && id) {
    const approveRes = await fetch(`/api/news/${id}/approve`, { method: 'POST' });
    loadPending();
    if (!approveRes.ok) {
      const approveData = await approveRes.json().catch(() => ({}));
      showError(newsFormError, approveData.error || 'Salvei, mas não foi possível aprovar.');
      return;
    }
  }
  newsModal.hidden = true;
  loadNews();
});

async function deleteNews(id) {
  if (!confirm('Tem certeza que deseja excluir esta notícia?')) return;
  await fetch(`/api/news/${id}`, { method: 'DELETE' });
  loadNews();
}

// ---- Modal novo administrador ----
const adminUserModal = document.getElementById('adminUserModal');
const adminUserForm = document.getElementById('adminUserForm');
const adminUserFormError = document.getElementById('adminUserFormError');
const adminUserList = document.getElementById('adminUserList');

document.getElementById('btnNewAdmin').addEventListener('click', async () => {
  hideError(adminUserFormError);
  adminUserForm.reset();
  adminUserList.textContent = 'Carregando...';
  adminUserModal.hidden = false;
  const res = await fetch('/api/admin/users');
  const users = res.ok ? await res.json() : [];
  adminUserList.textContent = users.length
    ? `Administradores atuais: ${users.map((u) => u.username).join(', ')}`
    : '';
});
document.getElementById('btnCancelAdminUser').addEventListener('click', () => { adminUserModal.hidden = true; });

adminUserForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(adminUserFormError);
  const fd = new FormData(adminUserForm);
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') })
  });
  const data = await res.json();
  if (!res.ok) {
    showError(adminUserFormError, data.error || 'Erro ao criar administrador');
    return;
  }
  adminUserModal.hidden = true;
  alert('Administrador criado com sucesso!');
});

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

// ---- Comprovantes de irradiação ----
const comprovantesTableBody = document.getElementById('comprovantesTableBody');
const comprovanteModal = document.getElementById('comprovanteModal');
const comprovanteForm = document.getElementById('comprovanteForm');
const comprovanteFormError = document.getElementById('comprovanteFormError');
const insercoesList = document.getElementById('insercoesList');

function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

async function loadComprovantes() {
  const res = await fetch('/api/comprovantes');
  if (!res.ok) return;
  const items = await res.json();
  comprovantesTableBody.innerHTML = items.map((c) => `
    <tr>
      <td>${escapeHtml(c.anunciante)}</td>
      <td>${escapeHtml(c.comercial)}</td>
      <td>${formatDateBR(c.data_inicio)} a ${formatDateBR(c.data_fim)}</td>
      <td>${c.insercoes.length}</td>
      <td>${new Date(c.created_at.replace(' ', 'T')).toLocaleDateString('pt-BR')}</td>
      <td class="actions">
        <a class="btn-admin btn-admin--outline btn-sm" href="comprovante.html?id=${c.id}" target="_blank">Ver / Imprimir</a>
        <button class="btn-admin btn-admin--danger btn-sm" data-delete-comprovante="${c.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6">Nenhum comprovante emitido ainda.</td></tr>';

  comprovantesTableBody.querySelectorAll('[data-delete-comprovante]').forEach((btn) => {
    btn.addEventListener('click', () => deleteComprovante(Number(btn.dataset.deleteComprovante)));
  });
}

function addInsercaoRow(data = '', horario = '') {
  const row = document.createElement('div');
  row.className = 'insercao-row';
  row.innerHTML = `
    <input type="date" class="insercao-data" value="${data}" required>
    <input type="time" class="insercao-horario" value="${horario}" required>
    <button type="button" class="btn-admin btn-admin--danger btn-sm insercao-remove">Remover</button>
  `;
  row.querySelector('.insercao-remove').addEventListener('click', () => row.remove());
  insercoesList.appendChild(row);
}

document.getElementById('btnAddInsercao').addEventListener('click', () => addInsercaoRow());

document.getElementById('btnNewComprovante').addEventListener('click', () => {
  hideError(comprovanteFormError);
  comprovanteForm.reset();
  insercoesList.innerHTML = '';
  addInsercaoRow();
  comprovanteModal.hidden = false;
});
document.getElementById('btnCancelComprovante').addEventListener('click', () => { comprovanteModal.hidden = true; });

comprovanteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(comprovanteFormError);
  const fd = new FormData(comprovanteForm);

  const insercoes = [...insercoesList.querySelectorAll('.insercao-row')].map((row) => ({
    data: row.querySelector('.insercao-data').value,
    horario: row.querySelector('.insercao-horario').value
  })).filter((i) => i.data && i.horario);

  if (!insercoes.length) {
    showError(comprovanteFormError, 'Adicione ao menos uma inserção com data e horário');
    return;
  }

  const payload = {
    anunciante: fd.get('anunciante'),
    comercial: fd.get('comercial'),
    dataInicio: fd.get('dataInicio'),
    dataFim: fd.get('dataFim'),
    insercoes,
    responsavelNome: fd.get('responsavelNome'),
    responsavelCargo: fd.get('responsavelCargo')
  };

  const res = await fetch('/api/comprovantes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    showError(comprovanteFormError, data.error || 'Erro ao salvar comprovante');
    return;
  }
  comprovanteModal.hidden = true;
  loadComprovantes();
  window.open(`comprovante.html?id=${data.id}`, '_blank');
});

async function deleteComprovante(id) {
  if (!confirm('Tem certeza que deseja excluir este comprovante?')) return;
  await fetch(`/api/comprovantes/${id}`, { method: 'DELETE' });
  loadComprovantes();
}

checkSession();
