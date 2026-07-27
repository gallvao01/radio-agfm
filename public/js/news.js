const CATEGORY_LABELS = {
  alagoas: 'Alagoas',
  interior: 'União dos Palmares',
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

function aiBadge(n) {
  return isAiImage(n.image) ? '<span class="ai-badge" title="Imagem ilustrativa gerada por IA">IA</span>' : '';
}

function dateLabel(n) {
  const date = new Date((n.created_at || '').replace(' ', 'T'));
  return isNaN(date) ? '' : 'Publicado em ' + date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function cardBig(n) {
  return `<a class="hero__main" href="noticia.html?id=${n.id}">
    <div class="hero__main-media card__media">${aiBadge(n)}<img src="${escapeHtml(n.image)}" alt="${escapeHtml(n.title)}"></div>
    <div class="hero__main-content">
      <p class="hero__cat">${CATEGORY_LABELS[n.category] || n.category}</p>
      <h2 class="hero__title">${escapeHtml(n.title)}</h2>
      <p class="hero__date">${dateLabel(n)}</p>
      <p class="hero__summary">${escapeHtml(n.summary)}</p>
    </div>
  </a>`;
}

function cardSmall(n) {
  return `<a class="hero__side-item" href="noticia.html?id=${n.id}">
    <div class="hero__side-media card__media">${aiBadge(n)}<img src="${escapeHtml(n.image)}" alt="${escapeHtml(n.title)}"></div>
    <div class="hero__side-content">
      <p class="hero__side-cat">${CATEGORY_LABELS[n.category] || n.category}</p>
      <h3 class="hero__side-title">${escapeHtml(n.title)}</h3>
    </div>
  </a>`;
}

function cardRow(n) {
  return `<a class="card-link" href="noticia.html?id=${n.id}"><article class="card card--row">
    <div class="card__media">${aiBadge(n)}<img src="${escapeHtml(n.image)}" alt="${escapeHtml(n.title)}"></div>
    <div class="card__body">
      <span class="card__tag">${CATEGORY_LABELS[n.category] || n.category}</span>
      <h3>${escapeHtml(n.title)}</h3>
    </div>
  </article></a>`;
}

function rankingItem(n, index) {
  return `<li><span class="rank-number">${index + 1}</span><a href="noticia.html?id=${n.id}">${escapeHtml(n.title)}</a></li>`;
}

function emptyState(message) {
  return `<p style="color:#6b7280;font-size:14px;">${escapeHtml(message)}</p>`;
}

function isAiImage(imagePath) {
  return /-ia\.(jpg|jpeg|png|webp)$/i.test(imagePath || '');
}

function fourUpCard(n, tagLabel) {
  return `<a class="card-link" href="noticia.html?id=${n.id}"><article class="card"><div class="card__media">${aiBadge(n)}<img src="${escapeHtml(n.image)}" alt="${escapeHtml(n.title)}"></div><div class="card__body"><span class="card__tag">${tagLabel}</span><h3>${escapeHtml(n.title)}</h3></div></article></a>`;
}

const AUTORIDADES = ['Júnior Menezes', 'Paulo Dantas', 'Renan Filho'];

async function renderAutoridades() {
  const grid = document.getElementById('autoridadesGrid');
  if (!grid) return;

  const all = await fetchNews({ limit: 50 });
  const cards = AUTORIDADES
    .map((nome) => all.find((n) => n.title.includes(nome) || n.content.includes(nome)))
    .filter(Boolean)
    .map((n) => fourUpCard(n, AUTORIDADES.find((nome) => n.title.includes(nome) || n.content.includes(nome))));

  grid.innerHTML = cards.length ? cards.join('') : emptyState('Nenhuma notícia de autoridades cadastrada ainda.');
}

async function renderHome() {
  const featuredBig = document.getElementById('featuredBig');
  const featuredSmall = document.getElementById('featuredSmall');
  const latestList = document.getElementById('latestList');
  const rankingList = document.getElementById('rankingList');
  const interiorGrid = document.getElementById('interiorGrid');
  const alagoasGrid = document.getElementById('alagoasGrid');

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

    const rest = all.filter((n) => n.id !== (featured[0] ? featured[0].id : -1)).slice(0, 2);
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

  if (interiorGrid) {
    const items = await fetchNews({ category: 'interior', limit: 4 });
    interiorGrid.innerHTML = items.length
      ? items.map((n) => fourUpCard(n, 'União dos Palmares')).join('')
      : emptyState('Nenhuma notícia de União dos Palmares cadastrada ainda.');
  }

  if (alagoasGrid) {
    const items = await fetchNews({ category: 'alagoas', limit: 4 });
    alagoasGrid.innerHTML = items.length
      ? items.map((n) => fourUpCard(n, 'Alagoas')).join('')
      : emptyState('Nenhuma notícia de Alagoas cadastrada ainda.');
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
  fetch(`/api/news/${id}/view`, { method: 'POST' }).catch(() => {});

  container.innerHTML = `
    <span class="card__tag">${CATEGORY_LABELS[n.category] || n.category}</span>
    <h1>${escapeHtml(n.title)}</h1>
    <p class="article__meta">${dateLabel(n)}</p>
    ${n.video ? `<video class="article__video" src="${escapeHtml(n.video)}" poster="${escapeHtml(n.image)}" controls playsinline></video>` : `<img class="article__image" src="${escapeHtml(n.image)}" alt="${escapeHtml(n.title)}">`}
    ${!n.video && isAiImage(n.image) ? '<p class="article__image-caption">Imagem ilustrativa gerada por IA — não retrata o local ou os envolvidos reais.</p>' : ''}
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

function trackClick(id) {
  const url = `/api/news/${id}/click`;
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url);
  } else {
    fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
  }
}

// Rastreia cliques em qualquer link de notícia da página (home, categoria, destaque, mais ouvidas etc.)
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href*="noticia.html?id="]');
  if (!link) return;
  const id = new URL(link.href, window.location.origin).searchParams.get('id');
  if (id) trackClick(id);
});

document.addEventListener('DOMContentLoaded', () => {
  renderHome();
  renderAutoridades();
  renderCategory();
  renderArticle();
});
