(() => {
  'use strict';

  const CATEGORIAS = {
    interior: 'União e região',
    alagoas: 'Alagoas',
    brasil: 'Brasil',
    mundo: 'Mundo',
    esportes: 'Esportes',
    saude: 'Saúde',
    entretenimento: 'Entretenimento'
  };
  const PADRAO_CATS = ['interior', 'alagoas', 'brasil', 'mundo'];
  const TITULOS = { atualizar: 'Atualizar', revisar: 'Revisar', publicadas: 'No site' };
  // A coluna da foto no banco guarda até 64 KB; a foto enviada pelo telefone precisa caber nisso.
  const LIMITE_FOTO = 60000;
  const POLL_MS = 4000;

  const $ = (id) => document.getElementById(id);
  const estado = { cats: new Set(PADRAO_CATS), qtd: 5, pendentes: [], publicadas: [], editando: null, ultimaExecucao: null, timer: null, rodando: false };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fotoUrl = (img) => {
    const s = String(img || '').trim();
    return /^(https?:|data:image\/)/i.test(s) ? s : `/${s.replace(/^\/+/, '')}`;
  };
  const dataCurta = (d) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const linkSeguro = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

  function toast(texto) {
    const t = $('toast');
    t.textContent = texto;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  async function api(caminho, opcoes = {}) {
    const res = await fetch(caminho, {
      method: opcoes.method || 'GET',
      credentials: 'same-origin',
      headers: opcoes.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
    });
    const dados = await res.json().catch(() => ({}));
    if (res.status === 401 && caminho !== '/api/login') {
      mostrarLogin();
      throw new Error('Sua sessão terminou. Entre de novo.');
    }
    if (!res.ok) throw new Error(dados.error || `O site respondeu ${res.status}`);
    return dados;
  }

  // ---------- Login ----------
  function mostrarLogin() {
    clearTimeout(estado.timer);
    $('shell').hidden = true;
    $('login').hidden = false;
  }

  function mostrarApp() {
    $('login').hidden = true;
    $('shell').hidden = false;
    atualizarTudo();
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    $('loginError').hidden = true;
    try {
      await api('/api/login', { method: 'POST', body: { username: dados.get('username').trim(), password: dados.get('password') } });
      e.target.reset();
      mostrarApp();
    } catch (err) {
      $('loginError').textContent = err.message;
      $('loginError').hidden = false;
    }
  });

  $('btnSair').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    mostrarLogin();
  });

  // ---------- Abas ----------
  function abrirAba(nome) {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === nome));
    document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== `tab-${nome}`; });
    $('topTitle').textContent = TITULOS[nome];
    window.scrollTo(0, 0);
    if (nome === 'revisar') carregarPendentes().catch(erroToast);
    if (nome === 'publicadas') carregarPublicadas().catch(erroToast);
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => abrirAba(b.dataset.tab)));

  const erroToast = (e) => toast(e.message);

  // ---------- Pedido ----------
  function desenharCats() {
    $('cats').innerHTML = Object.entries(CATEGORIAS)
      .map(([k, nome]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${estado.cats.has(k)}">${esc(nome)}</button>`)
      .join('');
    $('qtd').textContent = estado.qtd;
    const total = estado.cats.size * estado.qtd;
    $('total').textContent = total ? `Até ${total} matérias, que chegam em Revisar antes de ir para o site.` : 'Escolha pelo menos uma editoria.';
  }

  $('cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    if (estado.cats.has(b.dataset.cat)) estado.cats.delete(b.dataset.cat);
    else estado.cats.add(b.dataset.cat);
    desenharCats();
  });
  $('qtdMenos').addEventListener('click', () => { estado.qtd = Math.max(1, estado.qtd - 1); desenharCats(); });
  $('qtdMais').addEventListener('click', () => { estado.qtd = Math.min(5, estado.qtd + 1); desenharCats(); });

  $('runForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('runError').hidden = true;
    if (!estado.cats.size) return;
    $('btnRun').disabled = true;
    try {
      await api('/api/admin/pauta/run', {
        method: 'POST',
        body: { categorias: [...estado.cats], quantidade: estado.qtd, foco: $('foco').value.trim(), semPolitica: $('semPolitica').checked }
      });
      $('foco').value = '';
      $('resultado').hidden = true;
      await acompanhar();
    } catch (err) {
      $('runError').textContent = err.message;
      $('runError').hidden = false;
    } finally {
      $('btnRun').disabled = false;
    }
  });

  async function acompanhar() {
    clearTimeout(estado.timer);
    const s = await api('/api/admin/pauta');
    const rodando = !!s.rodando;
    $('semChave').hidden = s.configurado;
    $('runForm').hidden = rodando;
    $('rodando').hidden = !rodando;
    $('btnRun').disabled = !s.configurado;
    if (rodando) {
      $('passos').innerHTML = (s.progresso || []).slice(-6).map((p) => `<li>${esc(p)}</li>`).join('');
      estado.rodando = true;
      estado.timer = setTimeout(() => acompanhar().catch(erroToast), POLL_MS);
      return;
    }
    const terminouAgora = estado.rodando;
    estado.rodando = false;
    desenharResultado(s.execucoes?.[0], terminouAgora);
    if (terminouAgora) await carregarPendentes();
  }

  function desenharResultado(exec, mostrar) {
    const box = $('resultado');
    if (!exec || !mostrar) return;
    const erro = exec.status === 'erro';
    box.className = `result${erro ? ' result--erro' : ''}`;
    box.innerHTML = `
      <strong>${erro ? 'A busca não terminou' : 'Busca concluída'}</strong>
      <p>${esc(exec.mensagem)}</p>
      ${exec.criadas ? '<button class="btn btn--main" type="button" id="btnVerRevisar">Revisar matérias</button>' : ''}
      ${exec.log ? `<details><summary>Ver detalhes</summary><pre>${esc(exec.log)}</pre></details>` : ''}`;
    box.hidden = false;
    const ver = $('btnVerRevisar');
    if (ver) ver.addEventListener('click', () => abrirAba('revisar'));
  }

  // ---------- Revisar ----------
  function atualizarBadge() {
    const n = estado.pendentes.length;
    $('badge').textContent = n;
    $('badge').hidden = !n;
  }

  async function carregarPendentes() {
    estado.pendentes = await api('/api/admin/news/pending');
    atualizarBadge();
    desenharPendentes();
  }

  function paragrafos(texto) {
    return String(texto || '').split('\n').filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
  }

  function desenharPendentes() {
    const lista = estado.pendentes;
    $('revisarTopo').hidden = lista.length < 2;
    $('btnPublicarTodas').textContent = `Publicar todas (${lista.length})`;
    $('pendentes').innerHTML = lista.length ? lista.map((n) => `
      <article class="card" data-id="${n.id}">
        <img src="${esc(fotoUrl(n.image))}" alt="" loading="lazy">
        <div class="card__body">
          <div class="card__meta"><span>${esc(CATEGORIAS[n.category] || n.category)}</span>${n.source_name ? `<span>${esc(n.source_name)}</span>` : ''}</div>
          <h3>${esc(n.title)}</h3>
          <p>${esc(n.summary)}</p>
          <details><summary>Ler a matéria</summary>${paragrafos(n.content)}${linkSeguro(n.source_url) ? `<p><a href="${esc(n.source_url)}" target="_blank" rel="noopener">Abrir a fonte</a></p>` : ''}</details>
        </div>
        <div class="card__actions">
          <button class="btn btn--main" type="button" data-acao="publicar">Publicar</button>
          <button class="btn btn--small btn--line" type="button" data-acao="destaque"><svg class="icon"><use href="#i-star"/></svg>Com destaque</button>
          <button class="btn btn--small btn--line" type="button" data-acao="editar"><svg class="icon"><use href="#i-edit"/></svg>Editar</button>
          <button class="btn btn--small btn--plain" type="button" data-acao="descartar" style="grid-column:1/-1">Descartar</button>
        </div>
      </article>`).join('') : '<p class="empty">Nada para revisar agora.</p>';
  }

  async function aposPublicar(id) {
    estado.pendentes = estado.pendentes.filter((n) => n.id !== id);
    atualizarBadge();
    desenharPendentes();
  }

  $('pendentes').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const id = Number(b.closest('.card').dataset.id);
    const n = estado.pendentes.find((x) => x.id === id);
    b.disabled = true;
    try {
      if (b.dataset.acao === 'publicar') {
        await api(`/api/news/${id}/approve`, { method: 'POST' });
        await aposPublicar(id);
        toast('Publicada no site');
      } else if (b.dataset.acao === 'destaque') {
        await api(`/api/news/${id}/approve`, { method: 'POST' });
        await api(`/api/news/${id}/feature`, { method: 'POST' });
        await aposPublicar(id);
        toast('Publicada como destaque');
      } else if (b.dataset.acao === 'editar') {
        abrirEditor(n);
      } else if (b.dataset.acao === 'descartar' && confirm('Descartar esta matéria? Ela não vai para o site.')) {
        await api(`/api/news/${id}/reject`, { method: 'POST' });
        await aposPublicar(id);
        toast('Matéria descartada');
      }
    } catch (err) {
      toast(err.message);
    } finally {
      b.disabled = false;
    }
  });

  $('btnPublicarTodas').addEventListener('click', async (e) => {
    const n = estado.pendentes.length;
    if (!confirm(`Publicar as ${n} matérias no site?`)) return;
    const botao = e.currentTarget;
    botao.disabled = true;
    let feitas = 0;
    let erro = '';
    for (const m of [...estado.pendentes]) {
      try {
        await api(`/api/news/${m.id}/approve`, { method: 'POST' });
        feitas += 1;
        await aposPublicar(m.id);
      } catch (err) {
        erro = err.message;
      }
    }
    botao.disabled = false;
    toast(erro ? `${feitas} de ${n} publicadas. ${erro}` : `${feitas} matérias publicadas`);
  });

  // ---------- No site ----------
  async function carregarPublicadas() {
    estado.publicadas = await api('/api/news?limit=40');
    $('publicadas').innerHTML = estado.publicadas.map((n) => `
      <article class="card card--mini" data-id="${n.id}">
        <img src="${esc(fotoUrl(n.image))}" alt="" loading="lazy">
        <div class="card__body">
          <div class="card__meta"><span>${esc(CATEGORIAS[n.category] || n.category)}</span>${n.featured ? '<span class="is-star">Destaque</span>' : ''}</div>
          <h3>${esc(n.title)}</h3>
          <p>${esc(dataCurta(n.created_at))}</p>
        </div>
        <div class="card__actions">
          <button class="btn btn--small btn--line" type="button" data-acao="destacar" ${n.featured ? 'disabled' : ''}><svg class="icon"><use href="#i-star"/></svg>Destacar</button>
          <button class="btn btn--small btn--line" type="button" data-acao="editar"><svg class="icon"><use href="#i-edit"/></svg>Editar</button>
        </div>
      </article>`).join('');
  }

  $('publicadas').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const id = Number(b.closest('.card').dataset.id);
    const n = estado.publicadas.find((x) => x.id === id);
    if (b.dataset.acao === 'editar') return abrirEditor(n);
    try {
      await api(`/api/news/${id}/feature`, { method: 'POST' });
      await carregarPublicadas();
      toast('Destaque trocado');
    } catch (err) {
      toast(err.message);
    }
  });

  // ---------- Editor ----------
  function abrirEditor(n) {
    estado.editando = n;
    $('editImage').value = /^data:/i.test(n.image) ? '' : n.image;
    $('editImage').placeholder = /^data:/i.test(n.image) ? 'Foto enviada pelo telefone' : 'https://...';
    $('editFoto').src = fotoUrl(n.image);
    $('editTitle').value = n.title;
    $('editSummary').value = n.summary;
    $('editContent').value = n.content;
    $('editError').hidden = true;
    $('fotoAviso').hidden = true;
    estado.fotoNova = null;
    $('editor').showModal();
  }

  $('btnEditClose').addEventListener('click', () => $('editor').close());
  $('editImage').addEventListener('input', () => {
    estado.fotoNova = null;
    if (/^https?:\/\//i.test($('editImage').value.trim())) $('editFoto').src = $('editImage').value.trim();
  });

  function lerArquivo(arquivo) {
    return new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => falha(new Error('Não consegui ler a foto.'));
      r.readAsDataURL(arquivo);
    });
  }

  function carregarImagem(src) {
    return new Promise((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('Esse arquivo não abriu como foto.'));
      i.src = src;
    });
  }

  // Reduz a foto até caber no banco, preservando o máximo de qualidade possível.
  function comprimirFoto(img) {
    for (const largura of [1000, 900, 800, 700, 600, 480]) {
      const escala = Math.min(1, largura / img.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * escala);
      canvas.height = Math.round(img.naturalHeight * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const qualidade of [0.72, 0.6, 0.5, 0.4]) {
        const dados = canvas.toDataURL('image/jpeg', qualidade);
        if (dados.length <= LIMITE_FOTO) return { dados, largura: canvas.width };
      }
    }
    throw new Error('Essa foto não coube mesmo reduzida. Tente outra.');
  }

  $('editArquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      const { dados, largura } = comprimirFoto(await carregarImagem(await lerArquivo(arquivo)));
      estado.fotoNova = dados;
      $('editImage').value = '';
      $('editImage').placeholder = 'Foto enviada pelo telefone';
      $('editFoto').src = dados;
      $('fotoAviso').textContent = `Foto ajustada para ${largura}px. Coloque o crédito no fim do texto.`;
      $('fotoAviso').hidden = false;
    } catch (err) {
      toast(err.message);
    }
  });

  $('btnEditSave').addEventListener('click', async () => {
    const n = estado.editando;
    const link = $('editImage').value.trim();
    const body = {
      title: $('editTitle').value.trim(),
      summary: $('editSummary').value.trim(),
      content: $('editContent').value.trim(),
      image: estado.fotoNova || link || n.image
    };
    $('editError').hidden = true;
    if (!body.title || !body.summary || !body.content) {
      $('editError').textContent = 'Preencha título, resumo e texto.';
      $('editError').hidden = false;
      return;
    }
    try {
      await api(`/api/news/${n.id}`, { method: 'PUT', body });
      Object.assign(n, body);
      $('editor').close();
      desenharPendentes();
      if (estado.publicadas.includes(n)) await carregarPublicadas();
      toast('Alterações salvas');
    } catch (err) {
      $('editError').textContent = err.message;
      $('editError').hidden = false;
    }
  });

  $('btnEditDelete').addEventListener('click', async () => {
    const n = estado.editando;
    if (!confirm('Apagar esta matéria de vez? Não dá para desfazer.')) return;
    try {
      await api(`/api/news/${n.id}`, { method: 'DELETE' });
      $('editor').close();
      await carregarPendentes();
      await carregarPublicadas();
      toast('Matéria apagada');
    } catch (err) {
      $('editError').textContent = err.message;
      $('editError').hidden = false;
    }
  });

  // ---------- Instalar no telefone ----------
  let pedidoInstalar = null;
  const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const lerDispensa = () => { try { return localStorage.getItem('installDispensado'); } catch { return null; } };

  function mostrarInstalar(texto, comBotao) {
    if (instalado || lerDispensa()) return;
    $('installText').textContent = texto;
    $('btnInstall').hidden = !comBotao;
    $('install').hidden = false;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoInstalar = e;
    mostrarInstalar('Instale o app para abrir direto pela tela inicial do telefone.', true);
  });
  $('btnInstall').addEventListener('click', async () => {
    if (!pedidoInstalar) return;
    pedidoInstalar.prompt();
    await pedidoInstalar.userChoice;
    pedidoInstalar = null;
    $('install').hidden = true;
  });
  $('btnInstallClose').addEventListener('click', () => {
    try { localStorage.setItem('installDispensado', '1'); } catch { /* sem armazenamento, só fecha */ }
    $('install').hidden = true;
  });
  if (/iphone|ipad/i.test(navigator.userAgent)) {
    mostrarInstalar('No iPhone: toque em Compartilhar e depois em Adicionar à Tela de Início.', false);
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // ---------- Início ----------
  function atualizarTudo() {
    acompanhar().catch(erroToast);
    carregarPendentes().catch(erroToast);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !$('shell').hidden) atualizarTudo();
  });

  desenharCats();
  api('/api/session')
    .then((s) => (s.loggedIn ? mostrarApp() : mostrarLogin()))
    .catch(mostrarLogin);
})();
