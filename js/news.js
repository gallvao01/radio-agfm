const CATEGORY_LABELS = {
  alagoas: 'Alagoas',
  interior: 'Interior',
  brasil: 'Brasil',
  mundo: 'Mundo',
  entretenimento: 'Entretenimento',
  saude: 'Saúde',
  esportes: 'Esportes'
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchNews(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch('/api/news' + (qs ? '?' + qs : ''));
  if (!res.ok) return [];
  return res.json();
}

function cardBig(n) {
  return `<a class="card-link" href="noticia.html?id=${n.id}"><article class="card card--big">
    <img src="${n.image}" alt="${escapeHtml(n.title)}">
    <div class="card__body">
      <span class="card__tag">${CATEGORY_LABELS[n.category] || n.category}</span>
      <h3>${escapeHtml(n.title)}</h3>
      <p>${escapeHtml(n.summary)}</p>
    </div>
  </article></a>`;
}

function cardSmall(n) {
  return `<a class="card-link" href="noticia.html?id=${n.id}"><article class="card card--small">
    <img src="${n.image}" alt="${escapeHtml(n.title)}">
    <div class="card__body">
      <span class="card__tag">${CATEGORY_LABELS[n.category] || n.category}</span>
      <h3>${escapeHtml(n.title)}</h3>
    </div>
  </article></a>`;
}

function cardRow(n) {
  return `<a class="card-link" href="noticia.html?id=${n.id}"><article class="card card--row">
    <img src="${n.image}" alt="${escapeHtml(n.title)}">
    <div class="card__body">
      <span class="card__tag">${CATEGORY_LABELS[n.category] || n.category}</span>
      <h3>${escapeHtml(n.title)}</h3>
    </div>
  </article></a>`;
}

function rankingItem(n, index) {
  return `<li><span>${index + 1}</span><a href="noticia.html?id=${n.id}">${escapeHtml(n.title)}</a></li>`;
}

function emptyState(message) {
  return `<p style="color:#6b7280;font-size:14px;">${escapeHtml(message)}</p>`;
}

async function renderHome() {
  const featuredBig = document.getElementById('featuredBig');
  const featuredSmall = document.getElementById('featuredSmall');
  const latestList = document.getElementById('latestList');
  const rankingList = document.getElementById('rankingList');
  const entretenimentoGrid = document.getElementById('entretenimentoGrid');

  if (featuredBig) {
    const featured = await fetchNews({ featured: '1', limit: 1 });
    const all = await fetchNews({ limit: 30 });
    if (featured[0]) {
      featuredBig.innerHTML = cardBig(featured[0]);
    } else if (all[0]) {
      featuredBig.innerHTML = cardBig(all[0]);
    } else {
      featuredBig.innerHTML = emptyState('Nenhuma notícia cadastrada ainda.');
    }

    const rest = all.filter((n) => n.id !== (featured[0] ? featured[0].id : -1)).slice(0, 3);
    if (featuredSmall) {
      featuredSmall.innerHTML = rest.length ? rest.map(cardSmall).join('') : '';
    }

    if (latestList) {
      const latest = all.slice(0, 4);
      latestList.innerHTML = latest.length ? latest.map(cardRow).join('') : emptyState('Nenhuma notícia cadastrada ainda.');
    }

    if (rankingList) {
      const ranking = all.slice(0, 5);
      rankingList.innerHTML = ranking.length ? ranking.map(rankingItem).join('') : '';
    }
  }

  if (entretenimentoGrid) {
    const items = await fetchNews({ category: 'entretenimento', limit: 4 });
    entretenimentoGrid.innerHTML = items.length
      ? items.map((n) => `<a class="card-link" href="noticia.html?id=${n.id}"><article class="card"><img src="${n.image}" alt="${escapeHtml(n.title)}"><div class="card__body"><span class="card__tag">Entretenimento</span><h3>${escapeHtml(n.title)}</h3></div></article></a>`).join('')
      : emptyState('Nenhuma notícia de entretenimento cadastrada ainda.');
  }
}

async function renderArticle() {
  const container = document.getElementById('articleContent');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    container.innerHTML = emptyState('Notícia não encontrada.');
    return;
  }

  const res = await fetch(`/api/news/${id}`);
  if (!res.ok) {
    container.innerHTML = emptyState('Notícia não encontrada ou removida.');
    return;
  }
  const n = await res.json();
  document.title = n.title + ' - AG FM 99,9';

  const date = new Date(n.created_at.replace(' ', 'T'));
  const dateLabel = isNaN(date) ? '' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  container.innerHTML = `
    <span class="card__tag">${CATEGORY_LABELS[n.category] || n.category}</span>
    <h1>${escapeHtml(n.title)}</h1>
    <p class="article__meta">${dateLabel}</p>
    <img class="article__image" src="${n.image}" alt="${escapeHtml(n.title)}">
    <p class="article__summary">${escapeHtml(n.summary)}</p>
    <div class="article__body">${escapeHtml(n.content).split('\n').map((p) => `<p>${p}</p>`).join('')}</div>
    <a href="categoria.html?c=${encodeURIComponent(n.category)}" class="btn btn--back">&larr; Voltar para ${CATEGORY_LABELS[n.category] || n.category}</a>
  `;
}

async function renderCategory() {
  const catList = document.getElementById('catList');
  if (!catList) return;

  const params = new URLSearchParams(window.location.search);
  const catKey = params.get('c') || '';
  const catLabel = CATEGORY_LABELS[catKey] || 'Categoria';

  const titleEl = document.getElementById('catTitle');
  if (titleEl) titleEl.textContent = catLabel;
  document.title = catLabel + ' - AG FM 99,9';

  const items = await fetchNews(catKey ? { category: catKey } : {});
  catList.innerHTML = items.length
    ? items.map(cardRow).join('')
    : emptyState('Nenhuma notícia cadastrada nesta categoria ainda.');
}

document.addEventListener('DOMContentLoaded', () => {
  renderHome();
  renderCategory();
  renderArticle();
});
