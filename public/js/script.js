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

if (playBtn && audio) {
  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().catch(() => {
        alert('Não foi possível iniciar a transmissão. Verifique se a URL do stream foi configurada em index.html.');
      });
      iconPlay.style.display = 'none';
      iconPause.style.display = 'inline';
    } else {
      audio.pause();
      iconPlay.style.display = 'inline';
      iconPause.style.display = 'none';
    }
  });

  volumeRange.addEventListener('input', (e) => {
    audio.volume = e.target.value / 100;
  });
  audio.volume = volumeRange.value / 100;
}
