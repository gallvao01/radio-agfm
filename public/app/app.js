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
  const TITULOS = { hoje: 'Hoje', fontes: 'Fontes', escrever: 'Escrever', atualizar: 'Atualizar', revisar: 'Revisar', publicadas: 'No site' };
  const CHAVE_RASCUNHO = 'rascunhoMateria';
  const POLL_MS = 4000;

  const $ = (id) => document.getElementById(id);
  const estado = { cats: new Set(PADRAO_CATS), qtd: 5, pendentes: [], publicadas: [], editando: null, ultimaExecucao: null, timer: null, rodando: false, noticias: [], fonteFiltro: 'todas', fontesCarregadas: false, categoria: 'interior', fotoEscrita: null };

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
    // Nesses dois caminhos o 401 é senha errada, não sessão terminada.
    if (res.status === 401 && caminho !== '/api/login' && caminho !== '/api/change-password') {
      mostrarLogin();
      throw new Error('Sua sessão terminou. Entre de novo.');
    }
    if (!res.ok) throw new Error(dados.error || `O site respondeu ${res.status}`);
    return dados;
  }

  // ---------- Login ----------
  function mostrarLogin() {
    clearTimeout(estado.timer);
    clearTimeout(estado.timerDia);
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
    if (nome === 'fontes' && !estado.fontesCarregadas) carregarFontes();
    if (nome === 'revisar') carregarPendentes().catch(erroToast);
    if (nome === 'publicadas') carregarPublicadas().catch(erroToast);
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => abrirAba(b.dataset.tab)));

  const erroToast = (e) => toast(e.message);

  // ---------- Hoje: botão Atualizar notícias e lista do dia ----------
  const GRUPOS_DIA = [
    ['pending', 'Prontas em Revisar', 'Aguardando a sua aprovação. Toque para ler antes de mandar.'],
    ['escrever', 'Para escrever', 'O texto dessas fontes tem dono. Toque para abrir, escrever com as suas palavras e publicar.'],
    ['published', 'Já no site', '']
  ];

  function itemDoDia(n) {
    const semFoto = n.foto ? '' : '<span class="is-politica">Sem foto</span>';
    const miolo = `
        <span class="card__meta"><span>${esc(n.fonteNome)}</span><span>${esc(CATEGORIAS[n.categoria] || '')}</span>${semFoto}</span>
        <strong>${esc(n.titulo)}</strong>`;
    if (n.status === 'published') return `<div class="fonte-item">${miolo}</div>`;
    return `<button type="button" class="fonte-item" data-status="${esc(n.status)}" data-url="${esc(n.url)}">${miolo}</button>`;
  }

  function desenharDia(r) {
    if (!r) return;
    const hora = new Date(r.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const novas = r.novas === 1 ? '1 matéria nova foi para Revisar' : `${r.novas} matérias novas foram para Revisar`;
    $('diaResumo').textContent = `Atualizado às ${hora}: ${r.lista.length} notícias de hoje, ${novas}.`;
    estado.dia = r;
    const avisos = [];
    if (r.falhasIA) avisos.push(`A IA não escreveu ${r.falhasIA} matérias agora. Elas ficaram em Para escrever; toque em Atualizar notícias para tentar de novo.`);
    if (r.erros.length) avisos.push(`Sem resposta agora: ${r.erros.join(', ')}. As outras fontes entraram normalmente.`);
    if (r.falhas) avisos.push(`${r.falhas} notícias não abriram. Toque em Atualizar notícias de novo para tentar.`);
    $('diaAviso').textContent = avisos.join(' ');
    $('diaAviso').hidden = !avisos.length;
    $('diaLista').innerHTML = GRUPOS_DIA.map(([status, titulo, dica]) => {
      const itens = r.lista.filter((n) => n.status === status);
      if (!itens.length) return '';
      return `<h2 class="dia-grupo">${esc(titulo)} (${itens.length})</h2>${dica ? `<p class="hint">${esc(dica)}</p>` : ''}<div class="cards cards--justas">${itens.map(itemDoDia).join('')}</div>`;
    }).join('') || '<p class="empty">Nenhuma notícia de hoje apareceu nas fontes ainda.</p>';
  }

  async function acompanharDia() {
    clearTimeout(estado.timerDia);
    const { rodando, erro, progresso, resultado } = await api('/api/admin/atualizar-dia');
    $('btnDia').disabled = rodando;
    $('btnDia').lastChild.textContent = rodando ? (progresso || 'Buscando as notícias de hoje…') : 'Atualizar notícias';
    if (rodando) {
      estado.diaRodando = true;
      estado.timerDia = setTimeout(() => acompanharDia().catch(erroToast), 2000);
      return;
    }
    desenharDia(resultado);
    if (erro) {
      $('diaAviso').textContent = erro;
      $('diaAviso').hidden = false;
    }
    if (estado.diaRodando) {
      estado.diaRodando = false;
      carregarPendentes().catch(erroToast);
    }
  }

  $('btnDia').addEventListener('click', async () => {
    $('btnDia').disabled = true;
    try {
      await api('/api/admin/atualizar-dia', { method: 'POST' });
      estado.diaRodando = true;
      await acompanharDia();
    } catch (err) {
      $('btnDia').disabled = false;
      toast(err.message);
    }
  });

  $('diaLista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-url]');
    if (!b) return;
    if (b.dataset.status === 'pending') abrirAba('revisar');
    else abrirFonte(b);
  });

  // ---------- Fontes ----------
  const NOMES_FONTES = { todas: 'Todas', br104: 'BR104', a24h: 'Alagoas 24 Horas', agal: 'Agência Alagoas', abr: 'Agência Brasil' };

  function semAcento(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function desenharFiltros() {
    $('fonteFiltros').innerHTML = Object.entries(NOMES_FONTES)
      .map(([k, nome]) => `<button type="button" class="chip" data-fonte="${k}" aria-pressed="${estado.fonteFiltro === k}">${esc(nome)}</button>`)
      .join('');
  }

  function desenharFontes() {
    const busca = semAcento($('fonteBusca').value.trim());
    const lista = estado.noticias.filter((n) => (estado.fonteFiltro === 'todas' || n.fonte === estado.fonteFiltro)
      && !(n.politica && $('escondePolitica').checked)
      && (!busca || semAcento(n.titulo).includes(busca)));
    $('fontesLista').innerHTML = lista.length ? lista.map((n) => `
      <button type="button" class="fonte-item" data-url="${esc(n.url)}">
        <span class="card__meta"><span>${esc(n.fonteNome)}</span><span>${esc(CATEGORIAS[n.categoria] || '')}</span>${n.politica ? '<span class="is-politica">Política</span>' : ''}</span>
        <strong>${esc(n.titulo)}</strong>
      </button>`).join('') : '<p class="empty">Nenhuma notícia encontrada.</p>';
  }

  async function carregarFontes() {
    $('fontesLista').innerHTML = '<p class="empty">Buscando as últimas notícias…</p>';
    $('fontesAviso').hidden = true;
    try {
      const { noticias, erros } = await api('/api/admin/fontes');
      estado.noticias = noticias;
      estado.fontesCarregadas = true;
      estado.fontesEm = Date.now();
      if (erros.length) {
        $('fontesAviso').textContent = `Sem resposta agora: ${erros.join(', ')}.`;
        $('fontesAviso').hidden = false;
      }
      desenharFontes();
    } catch (err) {
      $('fontesLista').innerHTML = `<p class="empty">${esc(err.message)}</p>`;
    }
  }

  $('fonteFiltros').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fonte]');
    if (!b) return;
    estado.fonteFiltro = b.dataset.fonte;
    desenharFiltros();
    desenharFontes();
  });
  $('fonteBusca').addEventListener('input', desenharFontes);
  $('escondePolitica').addEventListener('change', desenharFontes);

  $('fontesLista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-url]');
    if (b) abrirFonte(b);
  });

  async function abrirFonte(b) {
    if (temRascunho() && !confirm('Trocar o rascunho atual por esta notícia?')) return;
    b.disabled = true;
    try {
      preencherComFonte(await api(`/api/admin/fontes/materia?url=${encodeURIComponent(b.dataset.url)}`));
      abrirAba('escrever');
    } catch (err) {
      toast(err.message);
    } finally {
      b.disabled = false;
    }
  }

  // ---------- Escrever ----------
  const CAMPOS = { titulo: 'escTitulo', resumo: 'escResumo', texto: 'escTexto', fonte: 'escFonte', credito: 'escCredito', link: 'escImage' };

  function desenharEditorias() {
    $('escCats').innerHTML = Object.entries(CATEGORIAS)
      .map(([k, nome]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${estado.categoria === k}">${esc(nome)}</button>`)
      .join('');
  }

  $('escCats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    estado.categoria = b.dataset.cat;
    desenharEditorias();
    guardarRascunho();
  });

  function mostrarFoto() {
    const src = estado.fotoEscrita || $('escImage').value.trim();
    $('escFoto').hidden = !src;
    if (src) $('escFoto').src = fotoUrl(src);
  }

  function escolherFoto(url, credito) {
    estado.fotoEscrita = null;
    $('escImage').value = url;
    if (credito) $('escCredito').value = credito;
    mostrarFoto();
    guardarRascunho();
    $('escFoto').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function opcaoFoto(url, legenda, credito) {
    return `<button type="button" class="foto-op" data-foto="${esc(url)}" data-credito="${esc(credito)}"><img src="${esc(url)}" alt="" loading="lazy"><span>${esc(legenda)}</span></button>`;
  }

  function preencherComFonte(m) {
    limparEscrita();
    estado.categoria = m.categoria;
    estado.urlFonte = m.url;
    const credito = m.credito ? (m.textoLivre ? m.credito : `${m.credito}/${m.fonteNome}`) : (m.textoLivre ? '' : `Reprodução/${m.fonteNome}`);
    $('escTitulo').value = m.titulo;
    $('escFonte').value = m.fonteNome;
    if (m.textoLivre) {
      $('escResumo').value = m.resumo;
      $('escTexto').value = m.paragrafos.join('\n');
    }
    if (m.fotos[0]) {
      $('escImage').value = m.fotos[0].url;
      $('escCredito').value = credito;
    }
    $('refTitulo').textContent = `Fonte: ${m.fonteNome}`;
    let aviso = 'Texto de agência pública: pode usar citando a fonte. Revise antes de publicar.';
    if (!m.textoLivre) aviso = 'Esse texto tem dono. Use só os fatos e escreva com as suas palavras.';
    if (m.fotoProibida) aviso += ' A foto dessa matéria é de agência paga e não pode ser usada: busque outra.';
    $('refAviso').textContent = aviso;
    $('refTexto').innerHTML = m.paragrafos.map((p) => `<p>${esc(p)}</p>`).join('');
    $('refLink').href = m.url;
    $('referencia').hidden = false;
    $('fotosFonte').innerHTML = m.fotos.length > 1 ? m.fotos.map((f) => opcaoFoto(f.url, f.legenda || 'Foto da fonte', credito)).join('') : '';
    $('fotosFonte').hidden = m.fotos.length < 2;
    desenharEditorias();
    mostrarFoto();
    guardarRascunho();
  }

  function limparEscrita() {
    Object.values(CAMPOS).forEach((id) => { $(id).value = ''; });
    estado.fotoEscrita = null;
    estado.urlFonte = null;
    estado.categoria = 'interior';
    $('referencia').hidden = true;
    $('fotosFonte').hidden = true;
    $('fotosFonte').innerHTML = '';
    $('fotosCommons').innerHTML = '';
    $('buscaFoto').hidden = true;
    $('escErro').hidden = true;
    desenharEditorias();
    mostrarFoto();
  }

  function temRascunho() {
    return ['escTitulo', 'escTexto', 'escResumo'].some((id) => $(id).value.trim());
  }

  // Guarda o que está sendo escrito para não perder se o telefone fechar o app.
  function guardarRascunho() {
    const dados = { categoria: estado.categoria, fotoEscrita: estado.fotoEscrita, urlFonte: estado.urlFonte };
    Object.entries(CAMPOS).forEach(([k, id]) => { dados[k] = $(id).value; });
    try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados)); } catch { /* sem armazenamento, segue sem rascunho */ }
  }

  function apagarRascunho() {
    try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* nada a apagar */ }
  }

  function lerRascunho() {
    let dados = null;
    try { dados = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO)); } catch { /* rascunho ilegível é ignorado */ }
    if (!dados) return;
    Object.entries(CAMPOS).forEach(([k, id]) => { $(id).value = dados[k] || ''; });
    estado.categoria = CATEGORIAS[dados.categoria] ? dados.categoria : 'interior';
    estado.fotoEscrita = dados.fotoEscrita || null;
    estado.urlFonte = dados.urlFonte || null;
  }

  $('escreverForm').addEventListener('input', (e) => {
    if (e.target.id === 'escImage') {
      estado.fotoEscrita = null;
      mostrarFoto();
    }
    if (e.target.id !== 'fotoTermo') guardarRascunho();
  });
  $('escreverForm').addEventListener('submit', (e) => e.preventDefault());

  $('btnAbrirBusca').addEventListener('click', () => {
    $('buscaFoto').hidden = !$('buscaFoto').hidden;
    if (!$('buscaFoto').hidden) $('fotoTermo').focus();
  });

  async function buscarFoto() {
    const termo = $('fotoTermo').value.trim();
    if (!termo) return;
    const botao = $('btnBuscarFoto');
    botao.disabled = true;
    $('fotosCommons').innerHTML = '<p class="hint">Procurando…</p>';
    try {
      const fotos = await api(`/api/admin/fotos?q=${encodeURIComponent(termo)}`);
      $('fotosCommons').innerHTML = fotos.length
        ? fotos.map((f) => opcaoFoto(f.url, `${f.autor || 'Autor não informado'} · ${f.licenca}`, `${f.autor || 'Autor não informado'}/Wikimedia Commons (${f.licenca})`)).join('')
        : '<p class="hint">Nada encontrado. Tente outras palavras, de preferência em inglês.</p>';
    } catch (err) {
      $('fotosCommons').innerHTML = `<p class="error">${esc(err.message)}</p>`;
    } finally {
      botao.disabled = false;
    }
  }
  $('btnBuscarFoto').addEventListener('click', buscarFoto);
  $('fotoTermo').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    buscarFoto();
  });

  const aoEscolherFoto = (e) => {
    const b = e.target.closest('[data-foto]');
    if (b) escolherFoto(b.dataset.foto, b.dataset.credito);
  };
  $('fotosFonte').addEventListener('click', aoEscolherFoto);
  $('fotosCommons').addEventListener('click', aoEscolherFoto);

  $('escArquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    $('btnPublicar').disabled = true;
    $('btnPublicarDestaque').disabled = true;
    toast('Enviando a foto…');
    try {
      estado.fotoEscrita = await enviarFoto(arquivo);
      $('escImage').value = '';
      $('escCredito').value = '';
      mostrarFoto();
      guardarRascunho();
      $('escCredito').focus();
      toast('Foto pronta. Agora coloque o crédito.');
    } catch (err) {
      toast(err.message);
    } finally {
      $('btnPublicar').disabled = false;
      $('btnPublicarDestaque').disabled = false;
    }
  });

  function montarConteudo() {
    const linhas = $('escTexto').value.split('\n').map((l) => l.trim()).filter(Boolean);
    const fonte = $('escFonte').value.trim().replace(/\.$/, '');
    if (fonte) linhas.push(`Com informações de ${fonte}.`);
    linhas.push(`Foto: ${$('escCredito').value.trim()}`);
    return linhas.join('\n');
  }

  async function publicarEscrita(destaque) {
    const image = estado.fotoEscrita || $('escImage').value.trim();
    const faltando = [
      [image, 'a foto'], [$('escCredito').value.trim(), 'o crédito da foto'], [$('escTitulo').value.trim(), 'o título'],
      [$('escResumo').value.trim(), 'o resumo'], [$('escTexto').value.trim(), 'o texto']
    ].filter(([v]) => !v).map(([, nome]) => nome);
    $('escErro').hidden = !faltando.length;
    if (faltando.length) {
      $('escErro').textContent = `Falta ${faltando.join(', ')}.`;
      return;
    }
    if (!confirm(destaque ? 'Publicar no site como notícia de destaque?' : 'Publicar esta matéria no site?')) return;
    $('btnPublicar').disabled = true;
    $('btnPublicarDestaque').disabled = true;
    try {
      const { id } = await api('/api/news', {
        method: 'POST',
        body: { title: $('escTitulo').value.trim(), summary: $('escResumo').value.trim(), content: montarConteudo(), image, category: estado.categoria, featured: false, source_url: estado.urlFonte, source_name: $('escFonte').value.trim() }
      });
      if (destaque) await api(`/api/news/${id}/feature`, { method: 'POST' });
      limparEscrita();
      apagarRascunho();
      abrirAba('publicadas');
      toast(destaque ? 'Publicada como destaque' : 'Publicada no site');
    } catch (err) {
      $('escErro').textContent = err.message;
      $('escErro').hidden = false;
    } finally {
      $('btnPublicar').disabled = false;
      $('btnPublicarDestaque').disabled = false;
    }
  }
  $('btnPublicar').addEventListener('click', () => publicarEscrita(false));
  $('btnPublicarDestaque').addEventListener('click', () => publicarEscrita(true));
  $('btnLimpar').addEventListener('click', () => {
    if (!confirm('Apagar tudo o que está nesta tela?')) return;
    limparEscrita();
    apagarRascunho();
  });

  // ---------- Senha ----------
  $('btnSenha').addEventListener('click', () => {
    $('senhaForm').reset();
    $('senhaErro').hidden = true;
    $('senha').showModal();
  });
  $('btnSenhaFechar').addEventListener('click', () => $('senha').close());
  $('btnSenhaSalvar').addEventListener('click', async () => {
    const nova = $('senhaNova').value;
    const erro = (texto) => {
      $('senhaErro').textContent = texto;
      $('senhaErro').hidden = false;
    };
    if (nova.length < 8) return erro('A senha nova precisa ter pelo menos 8 caracteres.');
    if (nova !== $('senhaConfirma').value) return erro('As duas senhas novas não são iguais.');
    try {
      await api('/api/change-password', { method: 'POST', body: { currentPassword: $('senhaAtual').value, newPassword: nova } });
      $('senha').close();
      toast('Senha trocada');
    } catch (err) {
      erro(err.message);
    }
  });

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
    document.querySelector('.tabs [data-tab="atualizar"]').hidden = !s.configurado;
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
    $('btnEnviar').hidden = !n;
    $('btnEnviar').textContent = `Mandar para o site (${n})`;
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

  // Publica uma por uma: se alguma falhar, as outras seguem e continuam marcadas certo.
  async function publicarTodas(e) {
    const botao = e.currentTarget;
    await carregarPendentes().catch(erroToast);
    const n = estado.pendentes.length;
    if (!n || !confirm(`Mandar as ${n} matérias para o site? Elas ficam públicas agora.`)) return;
    botao.disabled = true;
    let feitas = 0;
    let erro = '';
    for (const m of [...estado.pendentes]) {
      try {
        await api(`/api/news/${m.id}/approve`, { method: 'POST' });
        feitas += 1;
        await aposPublicar(m.id);
        const noDia = estado.dia && estado.dia.lista.find((x) => x.url === m.source_url);
        if (noDia) noDia.status = 'published';
      } catch (err) {
        erro = err.message;
      }
    }
    botao.disabled = false;
    if (estado.dia) desenharDia(estado.dia);
    toast(erro ? `${feitas} de ${n} foram para o site. ${erro}` : `${feitas} matérias no site`);
  }
  $('btnPublicarTodas').addEventListener('click', publicarTodas);
  $('btnEnviar').addEventListener('click', publicarTodas);

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
    const doTelefone = /^(data:|\/fotos\/)/i.test(n.image);
    $('editImage').value = doTelefone ? '' : n.image;
    $('editImage').placeholder = doTelefone ? 'Foto enviada pelo telefone' : 'https://...';
    $('editCredito').value = '';
    $('editCreditoCampo').hidden = true;
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

  async function enviarFoto(arquivo) {
    try {
      return await window.fotoDoTelefone.enviar(arquivo);
    } catch (err) {
      if (err.status === 401) {
        mostrarLogin();
        throw new Error('Sua sessão terminou. Entre de novo e envie a foto.');
      }
      throw err;
    }
  }

  $('editArquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    $('btnEditSave').disabled = true;
    $('fotoAviso').textContent = 'Enviando a foto…';
    $('fotoAviso').hidden = false;
    try {
      estado.fotoNova = await enviarFoto(arquivo);
      $('editImage').value = '';
      $('editImage').placeholder = 'Foto enviada pelo telefone';
      $('editFoto').src = estado.fotoNova;
      $('editCreditoCampo').hidden = false;
      $('fotoAviso').textContent = 'Foto pronta. Coloque o crédito dela.';
      $('editCredito').focus();
    } catch (err) {
      $('fotoAviso').textContent = err.message;
    } finally {
      $('btnEditSave').disabled = false;
    }
  });

  $('btnEditSave').addEventListener('click', async () => {
    const n = estado.editando;
    const link = $('editImage').value.trim();
    const credito = $('editCredito').value.trim();
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
    if (estado.fotoNova) {
      if (!credito) {
        $('editError').textContent = 'Falta o crédito da foto nova.';
        $('editError').hidden = false;
        return;
      }
      // O crédito antigo era da foto que saiu: fica um só, o da foto nova.
      const linhas = body.content.split('\n').filter((l) => !/^\s*foto:/i.test(l));
      body.content = [...linhas, `Foto: ${credito}`].join('\n');
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
    acompanharDia().catch(erroToast);
    carregarPendentes().catch(erroToast);
    if (Date.now() - (estado.fontesEm || 0) > 5 * 60 * 1000) carregarFontes();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !$('shell').hidden) atualizarTudo();
  });

  desenharCats();
  desenharFiltros();
  lerRascunho();
  desenharEditorias();
  mostrarFoto();
  api('/api/session')
    .then((s) => (s.loggedIn ? mostrarApp() : mostrarLogin()))
    .catch(mostrarLogin);
})();
