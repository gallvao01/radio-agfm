const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Menu mobile (painel deslizante + overlay, padrão BR104)
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
const closeMenu = document.getElementById('closeMenu');
const overlay = document.getElementById('overlay');

function openMobileMenu() {
  mobileMenu.classList.add('open');
  overlay.classList.add('active');
}
function closeMobileMenu() {
  mobileMenu.classList.remove('open');
  overlay.classList.remove('active');
}

if (menuToggle && mobileMenu && overlay) {
  menuToggle.addEventListener('click', openMobileMenu);
  closeMenu.addEventListener('click', closeMobileMenu);
  overlay.addEventListener('click', () => {
    closeMobileMenu();
    closeSearchOverlay();
  });
}

// Busca (overlay em tela cheia, padrão BR104)
const searchToggle = document.getElementById('searchToggle');
const searchOverlay = document.getElementById('searchOverlay');
const closeSearch = document.getElementById('closeSearch');

function openSearchOverlay() {
  searchOverlay.classList.add('active');
  const input = searchOverlay.querySelector('input[type="text"]');
  if (input) setTimeout(() => input.focus(), 100);
}
function closeSearchOverlay() {
  if (searchOverlay) searchOverlay.classList.remove('active');
}

if (searchToggle && searchOverlay) {
  searchToggle.addEventListener('click', openSearchOverlay);
  closeSearch.addEventListener('click', closeSearchOverlay);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMobileMenu();
    closeSearchOverlay();
  }
});

// Aviso de cookies
const cookieNotice = document.getElementById('cookieNotice');
const acceptCookies = document.getElementById('acceptCookies');
if (cookieNotice) {
  if (!localStorage.getItem('agfmCookiesAccepted')) {
    cookieNotice.classList.remove('hidden');
  }
  if (acceptCookies) {
    acceptCookies.addEventListener('click', () => {
      localStorage.setItem('agfmCookiesAccepted', '1');
      cookieNotice.classList.add('hidden');
    });
  }
}

// Player ao vivo
const audio = document.getElementById('radioAudio');
const playBtn = document.getElementById('playBtn');
const iconPlay = document.getElementById('iconPlay');
const iconPause = document.getElementById('iconPause');
const volumeRange = document.getElementById('volumeRange');

const radioPlayHint = document.getElementById('radioPlayHint');

if (playBtn && audio) {
  function showPlayingIcon() {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'inline';
  }
  function showPausedIcon() {
    iconPlay.style.display = 'inline';
    iconPause.style.display = 'none';
  }
  function showPlayHint() {
    if (radioPlayHint) radioPlayHint.hidden = false;
  }
  function hidePlayHint() {
    if (radioPlayHint) radioPlayHint.hidden = true;
  }

  let starting = false;

  // Tenta tocar mudo — navegadores quase sempre permitem autoplay sem som,
  // então isso deixa o stream carregado e pronto. O som de verdade só liga
  // no primeiro toque da pessoa na página (abaixo), que conta como interação
  // real e libera o autoplay com áudio nos navegadores que bloqueiam.
  function tryMutedFallback() {
    audio.muted = true;
    audio.play()
      .catch(() => {})
      .finally(() => {
        showPausedIcon();
        showPlayHint();
      });
  }

  function startPlayback() {
    if (starting || (!audio.paused && !audio.muted)) return;
    starting = true;
    audio.muted = false;
    audio.play()
      .then(() => { showPlayingIcon(); hidePlayHint(); })
      .catch(() => {
        // Autoplay com som bloqueado pelo navegador (comum no Safari/iOS e em
        // Chrome sem interação prévia) — cai no fallback mudo acima.
        tryMutedFallback();
      })
      .finally(() => { starting = false; });
  }

  function unmuteAndPlay() {
    audio.muted = false;
    if (audio.paused) {
      audio.play().then(showPlayingIcon).catch(() => {});
    } else {
      showPlayingIcon();
    }
    hidePlayHint();
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused || audio.muted) {
      unmuteAndPlay();
    } else {
      audio.pause();
      showPausedIcon();
    }
  });

  if (radioPlayHint) radioPlayHint.addEventListener('click', unmuteAndPlay);

  volumeRange.addEventListener('input', (e) => {
    audio.volume = e.target.value / 100;
  });
  audio.volume = volumeRange.value / 100;

  // Início automático da rádio ao carregar a página, sem precisar apertar Play.
  startPlayback();

  // Primeiro toque/clique/scroll da pessoa em qualquer lugar da página libera
  // o som de verdade, caso o autoplay direto acima tenha sido bloqueado — sem
  // isso, quem não notasse o aviso flutuante nunca ligaria o som manualmente.
  ['click', 'touchstart', 'keydown', 'scroll'].forEach((evt) => {
    document.addEventListener(evt, unmuteAndPlay, { once: true, passive: true });
  });
}

// A esteira de notícias do cabeçalho (faixa contínua com as notícias reais, cards
// grandes com foto/categoria/título) é montada inteiramente por news.js — a
// rolagem em si é só CSS (animação header-slider-scroll em style.css). Substituiu
// a esteira antiga, menor, que ficava logo abaixo do topo do cabeçalho.

// ==================== Botão "No Estúdio" (live do YouTube) ====================
// Canal oficial da Rádio AG FM no YouTube (@radioagfm6489). A URL /live do
// canal redireciona sozinha pra transmissão ao vivo quando ele estiver ao
// vivo, e mostra a live/vídeo mais recente quando não estiver — dispensa
// atualização manual daqui pra frente. Uma única constante alimenta o botão
// em todas as páginas e também o botão "ao vivo" da página de Programação.
const YOUTUBE_LIVE_URL = 'https://www.youtube.com/@radioagfm6489/live';

const studioBtn = document.getElementById('studioBtn');
if (studioBtn) studioBtn.href = YOUTUBE_LIVE_URL;

// ==================== Programação (dados + "no ar agora") ====================
const SCHEDULE = [
  // Segunda a sexta
  { day: 'weekday', start: '05:00', end: '07:00', program: 'No Terreiro da Fazenda', presenters: ['João Pires'] },
  { day: 'weekday', start: '07:00', end: '07:30', program: 'Tambores de Angola', presenters: ['Antônio Bahiano'] },
  { day: 'weekday', start: '07:30', end: '09:00', program: 'AG Notícias', presenters: ['Mário Sérgio'] },
  { day: 'weekday', start: '09:00', end: '11:30', program: 'Sintonia Total', presenters: ['Célio Martins', 'Tássia Carla', 'Ricardo Valério'], photo: 'assets/img/presenters/trio-manha-real.jpg?v=2026081203' },
  { day: 'weekday', start: '11:30', end: '13:00', program: 'União Notícias', presenters: ['Célio Martins', 'Tássia Carla'], photo: 'assets/img/presenters/uniao-noticias-dupla.jpg?v=2026081203' },
  { day: 'weekday', start: '13:00', end: '14:00', program: 'Sintonia Direta', presenters: ['Hermes Marques'] },
  { day: 'weekday', start: '14:00', end: '16:00', program: 'Ritmo da 99', presenters: ['Célio Martins', 'Tássia Carla', 'Ricardo Valério'], photo: 'assets/img/presenters/trio-manha-real.jpg?v=2026081203' },
  { day: 'weekday', start: '16:00', end: '18:00', program: 'Feedback Digital', presenters: ['Kleber Marques'] },
  { day: 'weekday', start: '18:00', end: '19:00', program: 'Batendo Bola', presenters: ['Jackson Valery'] },
  { day: 'weekday', start: '19:00', end: '20:00', program: 'Voz do Brasil', presenters: [] },
  { day: 'weekday', start: '20:00', end: '00:00', program: 'Love Songs', presenters: ['Carlinhos Laje'] },
  { day: 'weekday', start: '00:00', end: '00:30', program: 'Tambores de Angola', presenters: ['Antônio Bahiano'] },
  { day: 'weekday', start: '00:30', end: '05:00', program: 'Programação gravada', presenters: [] },
  // Sábado
  { day: 'saturday', start: '05:00', end: '08:00', program: 'No Terreiro da Fazenda', presenters: ['João Pires'] },
  { day: 'saturday', start: '08:00', end: '12:00', program: 'Sabadão da AG', presenters: ['Tássia Carla'] },
  { day: 'saturday', start: '12:00', end: '14:00', program: 'Especial AG FM', presenters: [] },
  { day: 'saturday', start: '14:00', end: '19:00', program: 'Ritmo da 99', presenters: ['Célio Martins', 'Carlinhos Laje', 'Ricardo Valério'] },
  { day: 'saturday', start: '19:00', end: '21:00', program: 'Batendo Bola', presenters: ['Jackson Valery'] },
  { day: 'saturday', start: '21:00', end: '23:00', program: 'Momentos Para Recordar', presenters: ['Nicanos Filho'] },
  { day: 'saturday', start: '23:00', end: '05:00', program: 'Programação gravada', presenters: [] },
  // Domingo
  { day: 'sunday', start: '08:00', end: '12:00', program: 'Domingão Especial', presenters: ['Célio Martins', 'Carlinhos Laje', 'Ricardo Valério'] },
  { day: 'sunday', start: '12:00', end: '16:00', program: 'Domingão Especial', presenters: ['Célio Martins', 'Carlinhos Laje', 'Ricardo Valério'] },
  { day: 'sunday', start: '16:00', end: '19:00', program: 'Batendo Bola', presenters: ['Jackson Valery'] },
  { day: 'sunday', start: '19:00', end: '21:00', program: 'Programação gravada', presenters: [] },
  { day: 'sunday', start: '21:00', end: '23:00', program: 'Momentos Para Recordar', presenters: ['Nicanos Filho'] },
  { day: 'sunday', start: '23:00', end: '05:00', program: 'Programação gravada', presenters: [] }
];

// Paleta de acento por apresentador — variações das cores da marca (verde/laranja),
// nunca cores fora da identidade visual atual.
const ACCENT_COLORS = ['#2fa84f', '#1f7a3a', '#f7941e', '#e07b00', '#4caf7d', '#c9781f', '#3d8b52', '#d98c1f'];

function accentColorFor(name) {
  if (!name) return null;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function dayKeyFor(date) {
  const d = date.getDay(); // 0 = domingo ... 6 = sábado
  if (d === 0) return 'sunday';
  if (d === 6) return 'saturday';
  return 'weekday';
}

function findInDay(dayKey, minutesFromMidnight) {
  return SCHEDULE.find((item) => {
    if (item.day !== dayKey) return false;
    const start = timeToMinutes(item.start);
    let end = timeToMinutes(item.end);
    if (end <= start) end += 24 * 60; // cruza a meia-noite (ex: 20h–00h, 23h–05h)
    return minutesFromMidnight >= start && minutesFromMidnight < end;
  });
}

// Calcula o programa no ar agora, considerando também programas da véspera
// que cruzam a meia-noite (ex: sábado 23h–05h ainda vale de madrugada no domingo).
function getCurrentProgram(date = new Date()) {
  const nowMin = date.getHours() * 60 + date.getMinutes();
  const todayKey = dayKeyFor(date);
  const found = findInDay(todayKey, nowMin);
  if (found) return found;
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return findInDay(dayKeyFor(yesterday), nowMin + 24 * 60) || null;
}

// Fotos reais dos apresentadores — quem não está aqui usa a logo como placeholder.
const PRESENTER_PHOTOS = {
  'Carlinhos Laje': 'assets/img/presenters/carlinhos-laje.jpg',
  'Célio Martins': 'assets/img/presenters/celio-martins.jpg',
  'Ricardo Valério': 'assets/img/presenters/ricardo-valerio.jpg',
  'Tássia Carla': 'assets/img/presenters/tassia-carla.jpg',
  'Kleber Marques': 'assets/img/presenters/kleber-marques.jpg'
};

function presenterPhotoFor(presenters) {
  const found = presenters.find((p) => PRESENTER_PHOTOS[p]);
  return found ? PRESENTER_PHOTOS[found] : 'assets/img/logo-ag-news.png?v=2026081202';
}

function scheduleCard(item, isLive) {
  const names = item.presenters.length ? item.presenters.join(', ') : 'Programação gravada';
  const accent = accentColorFor(item.presenters[0]) || 'var(--green)';
  const photo = item.photo || presenterPhotoFor(item.presenters);
  const liveMarkup = isLive
    ? `<span class="schedule-card__live">AO VIVO</span><a href="${YOUTUBE_LIVE_URL}" target="_blank" rel="noopener" class="schedule-card__live-btn">ASSISTIR AO VIVO</a>`
    : '';
  return `<div class="schedule-card${isLive ? ' schedule-card--live' : ''}" style="--accent:${accent}">
    <img class="schedule-card__photo" src="${photo}" alt="${names}">
    <div class="schedule-card__body">
      <h3 class="schedule-card__program">${item.program}</h3>
      <p class="schedule-card__presenters">${names}</p>
      <p class="schedule-card__time">${item.start} às ${item.end}</p>
      ${liveMarkup}
    </div>
  </div>`;
}

function renderSchedule() {
  const containers = {
    weekday: document.getElementById('scheduleWeekday'),
    saturday: document.getElementById('scheduleSaturday'),
    sunday: document.getElementById('scheduleSunday')
  };
  if (!containers.weekday && !containers.saturday && !containers.sunday) return;
  const current = getCurrentProgram();
  Object.keys(containers).forEach((dayKey) => {
    const el = containers[dayKey];
    if (!el) return;
    const items = SCHEDULE.filter((i) => i.day === dayKey);
    el.innerHTML = items.map((item) => scheduleCard(item, current === item)).join('');
  });
}
renderSchedule();

// Programação do dia na home — mesma grade, cards compactos empilhados à esquerda.
function homeScheduleCard(item, isLive) {
  const names = item.presenters.length ? item.presenters.join(', ') : 'Programação gravada';
  const accent = accentColorFor(item.presenters[0]) || 'var(--green)';
  const photo = item.photo || presenterPhotoFor(item.presenters);
  return `<div class="home-schedule-card${isLive ? ' home-schedule-card--live' : ''}" style="--accent:${accent}">
    <img class="home-schedule-card__photo" src="${photo}" alt="">
    <div class="home-schedule-card__body">
      <p class="home-schedule-card__program">${item.program}</p>
      <p class="home-schedule-card__presenters">${names}</p>
      <p class="home-schedule-card__time">${item.start} às ${item.end}</p>
      ${isLive ? `<span class="home-schedule-card__live">AO VIVO</span><a href="${YOUTUBE_LIVE_URL}" target="_blank" rel="noopener" class="home-schedule-card__live-btn">ASSISTIR AO VIVO</a>` : ''}
    </div>
  </div>`;
}

function renderHomeSchedule() {
  const container = document.getElementById('homeScheduleList');
  if (!container) return;
  const todayKey = dayKeyFor(new Date());
  const current = getCurrentProgram();
  const items = SCHEDULE.filter((i) => i.day === todayKey);
  container.innerHTML = items.map((item) => homeScheduleCard(item, current === item)).join('');
}
renderHomeSchedule();

// Destaque "No ar agora" da home — usa o mesmo cálculo de programa atual da
// página de Programação, com foto do apresentador em cartaz.
const onairPresenter = document.getElementById('onairPresenter');
if (onairPresenter) {
  const current = getCurrentProgram();
  if (current) {
    onairPresenter.textContent = current.presenters.length
      ? current.presenters.join(', ') + ' — ' + current.start + ' às ' + current.end
      : 'Confira a grade completa na página de Programação.';
  }
}
