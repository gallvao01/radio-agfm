document.getElementById('year').textContent = new Date().getFullYear();

// Menu mobile
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
  });
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
