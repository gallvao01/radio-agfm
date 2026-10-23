// Pauta automática: pesquisa notícias na web com o Claude (API da Anthropic),
// escreve matérias ORIGINAIS da AG FM News, escolhe uma foto livre do Wikimedia
// Commons com crédito e grava tudo na fila "Pendentes de revisão" do painel.
// Precisa da variável de ambiente ANTHROPIC_API_KEY no servidor.
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const MODEL = 'claude-opus-5-5';
const TZ = 'America/Maceio';
const COMMONS_UA = 'AGFMNewsPauta/1.0 (https://radioagfmnews.com.br)';

// Só tiramos fotos de páginas de órgãos públicos e agências que liberam o uso com
// crédito (prefeituras, governos, polícias, tribunais, Câmara, Senado, Agência
// Brasil). Fotos de portais de notícia têm direito autoral e não entram aqui.
const OFFICIAL_PAGE_HOSTS = /(^|\.)(gov\.br|leg\.br|jus\.br|mp\.br|def\.br|ebc\.com\.br)$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const CATEGORIES = {
  interior: 'União dos Palmares e cidades vizinhas (Zona da Mata alagoana: Branquinha, São José da Laje, Murici, Santana do Mundaú, Ibateguara, Joaquim Gomes)',
  alagoas: 'Alagoas (Maceió, Arapiraca, governo do estado, polícia, serviços)',
  brasil: 'Brasil (política nacional, economia, Congresso, serviços públicos)',
  mundo: 'Mundo (principais fatos internacionais)',
  esportes: 'Esportes (CRB, CSA, futebol alagoano e brasileiro)',
  saude: 'Saúde (campanhas, serviços e alertas de saúde, com foco em Alagoas)',
  entretenimento: 'Entretenimento (cultura, música, eventos, com foco no Nordeste)'
};

const DEFAULT_CONFIG = {
  ativo: false,
  horarios: ['07:00', '17:00'],
  categorias: ['interior', 'alagoas', 'brasil', 'mundo'],
  quantidade: 2,
  autopublicar: false
};

// Mesmos termos sensíveis da ingestão: com autopublicação ligada, pautas sobre
// política/eleição continuam indo para a fila de revisão.
const SENSITIVE_TERMS = [
  'júnior menezes', 'junior menezes', 'ricardo praxedes', 'renan calheiros', 'renan filho',
  'alexandre de moraes',
  'eleição', 'eleições', 'eleitoral', 'candidato', 'candidata', 'candidatura', 'campanha eleitoral'
];

let currentRunId = null;

// ---------- Banco ----------
async function init() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS pauta_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      origem VARCHAR(20) NOT NULL,
      categorias VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL,
      criadas INT NOT NULL DEFAULT 0,
      mensagem TEXT,
      log LONGTEXT,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS pauta_config (
      id INT PRIMARY KEY,
      config TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Execuções que estavam rodando quando o servidor reiniciou nunca vão terminar.
  await db.run("UPDATE pauta_runs SET status = 'erro', mensagem = 'Interrompida porque o servidor reiniciou', finished_at = NOW() WHERE status = 'rodando'");
}

async function getConfig() {
  const row = await db.get('SELECT config FROM pauta_config WHERE id = 1');
  if (!row) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(row.config) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function sanitizeConfig(input) {
  const c = { ...DEFAULT_CONFIG };
  if (typeof input.ativo === 'boolean') c.ativo = input.ativo;
  if (typeof input.autopublicar === 'boolean') c.autopublicar = input.autopublicar;
  if (Array.isArray(input.horarios)) {
    c.horarios = [...new Set(input.horarios.filter((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)))].sort().slice(0, 6);
  }
  if (Array.isArray(input.categorias)) {
    const cats = input.categorias.filter((k) => CATEGORIES[k]);
    if (cats.length) c.categorias = [...new Set(cats)];
  }
  const q = Number(input.quantidade);
  if (Number.isInteger(q) && q >= 1 && q <= 5) c.quantidade = q;
  return c;
}

async function saveConfig(input) {
  const c = sanitizeConfig(input);
  await db.run(
    'INSERT INTO pauta_config (id, config) VALUES (1, ?) ON DUPLICATE KEY UPDATE config = VALUES(config)',
    [JSON.stringify(c)]
  );
  return c;
}

async function status() {
  const runs = await db.all('SELECT id, origem, categorias, status, criadas, mensagem, started_at, finished_at FROM pauta_runs ORDER BY id DESC LIMIT 10');
  return {
    configurado: !!process.env.ANTHROPIC_API_KEY,
    rodando: currentRunId,
    config: await getConfig(),
    categoriasDisponiveis: Object.keys(CATEGORIES),
    execucoes: runs
  };
}

// ---------- Wikimedia Commons ----------
async function searchCommons(term) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '8',
    gsrsearch: term, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '960'
  });
  const res = await fetch('https://commons.wikimedia.org/w/api.php?' + params, { headers: { 'User-Agent': COMMONS_UA } });
  if (!res.ok) throw new Error(`Commons respondeu ${res.status}`);
  const data = await res.json();
  const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return Object.values(data.query?.pages || {})
    .filter((p) => /\.(jpe?g|png|webp)$/i.test(p.title) && p.imageinfo?.[0]?.width >= 500)
    .map((p) => {
      const i = p.imageinfo[0];
      const m = i.extmetadata || {};
      return {
        arquivo: p.title.replace(/^File:/, ''),
        descricao: strip(m.ImageDescription?.value).slice(0, 300),
        autor: strip(m.Artist?.value).slice(0, 120),
        licenca: strip(m.LicenseShortName?.value),
        data: strip(m.DateTimeOriginal?.value).slice(0, 20),
        url: String(i.thumburl || '').split('?')[0].replace('https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/')
      };
    })
    .filter((x) => x.url && x.licenca && !/fair use|non-free/i.test(x.licenca));
}

// ---------- Fotos de páginas oficiais ----------
function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function fetchLimited(url, accept) {
  const res = await fetch(url, {
    headers: { 'User-Agent': COMMONS_UA, Accept: accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`a página respondeu ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES * 2) throw new Error('arquivo grande demais');
  return { res, buf };
}

async function photosFromOfficialPage(pageUrl) {
  let u;
  try { u = new URL(pageUrl); } catch { throw new Error('URL inválida'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('URL inválida');
  if (!OFFICIAL_PAGE_HOSTS.test(u.hostname)) {
    throw new Error('Só é permitido tirar fotos de páginas oficiais (.gov.br, .leg.br, .jus.br, .mp.br, .def.br) ou da Agência Brasil. Para outros casos use buscar_foto (Wikimedia Commons).');
  }
  const { res, buf } = await fetchLimited(u.href, 'text/html');
  const html = buf.toString('utf8');
  const base = res.url || u.href;
  const abs = (src) => { try { return new URL(decodeEntities(src), base).href; } catch { return null; } };
  const found = new Map();
  const add = (src, alt, origem) => {
    const url = abs(src);
    if (!url || !/^https:\/\//.test(url) || /\.(svg|gif)(\?|$)/i.test(url) || /(logo|icon|brasao|banner|avatar|sprite|loading|placeholder|spacer|blank)/i.test(url)) return;
    if (!found.has(url)) found.set(url, { url, alt: decodeEntities(alt || '').trim().slice(0, 200), origem });
  };
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/gi)) {
    const c = m[0].match(/content=["']([^"']+)["']/i);
    if (c) add(c[1], '', 'imagem principal da página');
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    // Sites com carregamento preguiçoso guardam a foto real em data-src/data-original.
    const attr = (name) => (tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, 'i')) || [])[1];
    const src = attr('data-src') || attr('data-original') || attr('data-lazy-src') || attr('src');
    const alt = (tag.match(/\salt=["']([^"']*)["']/i) || [])[1];
    const w = Number((tag.match(/\swidth=["']?(\d+)/i) || [])[1] || 0);
    if (src && (!w || w >= 300)) add(src, alt, 'imagem no texto');
    if (found.size >= 10) break;
  }
  const creditos = [...new Set([...html.replace(/<[^>]+>/g, ' ').matchAll(/Fotos?\s*:\s*([^\n|]{3,80}?)(?=\s{2,}|$|\.|\n)/gim)].map((m) => decodeEntities(m[1]).trim()))].slice(0, 6);
  return { pagina: base, creditos_encontrados_na_pagina: creditos, fotos: [...found.values()].slice(0, 8) };
}

// Baixa a foto no servidor e devolve para o Claude ver de verdade o que ela mostra.
async function loadImageForReview(url) {
  const { res, buf } = await fetchLimited(url, 'image/*');
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) throw new Error(`não é uma imagem (${type || 'tipo desconhecido'})`);
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('imagem grande demais para conferir');
  return { media_type: type, data: buf.toString('base64') };
}

async function imageIsReachable(url) {
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': COMMONS_UA, Range: 'bytes=0-2047' }, signal: AbortSignal.timeout(15000) });
    const type = res.headers.get('content-type') || '';
    return (res.ok || res.status === 206) && /^image\//i.test(type);
  } catch {
    return false;
  }
}

// ---------- Ferramentas do Claude ----------
const CATEGORY_KEYS = Object.keys(CATEGORIES);

const TOOLS = [
  {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: 20,
    user_location: { type: 'approximate', city: 'União dos Palmares', region: 'Alagoas', country: 'BR', timezone: TZ }
  },
  {
    name: 'fotos_da_pagina',
    description: 'Lista as fotos publicadas numa página oficial (prefeituras, governos, polícias, tribunais, Câmara, Senado: domínios .gov.br, .leg.br, .jus.br, .mp.br, .def.br) ou da Agência Brasil, com o texto alternativo e os créditos ("Foto: ...") encontrados na página. É a melhor fonte de foto do próprio fato.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'URL da página oficial da notícia' } },
      required: ['url'],
      additionalProperties: false
    }
  },
  {
    name: 'ver_foto',
    description: 'Mostra a foto para você conferir o que ela realmente mostra. Só aceita URLs devolvidas por fotos_da_pagina ou buscar_foto nesta busca. Confira toda foto antes de entregá-la.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'URL da foto' } },
      required: ['url'],
      additionalProperties: false
    }
  },
  {
    name: 'buscar_foto',
    description: 'Busca fotos de licença livre no Wikimedia Commons, com descrição, autor e licença. Use quando não houver foto oficial do fato. Termos curtos com o nome do lugar, da instituição ou da pessoa (ex.: "Hospital Regional da Mata", "Assembleia Legislativa de Alagoas").',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { termo: { type: 'string', description: 'Termo de busca no Wikimedia Commons' } },
      required: ['termo'],
      additionalProperties: false
    }
  },
  {
    name: 'entregar_materias',
    description: 'Entrega as matérias prontas para a redação revisar. Chame uma única vez, no final, com todas as matérias.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        materias: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              categoria: { type: 'string', enum: CATEGORY_KEYS },
              titulo: { type: 'string', description: 'Título jornalístico, até 110 caracteres' },
              resumo: { type: 'string', description: 'Linha fina de uma frase, até 200 caracteres' },
              conteudo: { type: 'string', description: 'Texto da matéria em parágrafos separados por \\n, terminando com "Com informações de ..."' },
              fonte_url: { type: 'string', description: 'URL da reportagem ou fonte oficial principal' },
              fonte_nome: { type: 'string', description: 'Nome do veículo ou órgão da fonte principal' },
              foto_url: { type: 'string', description: 'URL exata de uma foto devolvida por fotos_da_pagina ou buscar_foto e conferida com ver_foto' },
              foto_credito: { type: 'string', description: 'Legenda e crédito. Ex.: "Mutirão de saúde no Centro de União dos Palmares. Foto: Maria Silva/Prefeitura de União dos Palmares"' }
            },
            required: ['categoria', 'titulo', 'resumo', 'conteudo', 'fonte_url', 'fonte_nome', 'foto_url', 'foto_credito'],
            additionalProperties: false
          }
        }
      },
      required: ['materias'],
      additionalProperties: false
    }
  }
];

const SYSTEM = `Você é o editor de pauta da AG FM News, rádio e portal de notícias de União dos Palmares, Alagoas. Sua tarefa é encontrar notícias recentes, confirmar os fatos e escrever matérias originais para o site.

Como apurar:
- Use web_search para achar fatos das últimas 24 a 36 horas. Prefira fontes confiáveis: órgãos oficiais (prefeituras, Governo de Alagoas, Agência Alagoas, tribunais, polícias), portais alagoanos (BR104, Alagoas 24 Horas, Gazetaweb, TNH1, Cada Minuto) e veículos nacionais e internacionais reconhecidos (g1, Agência Brasil, Folha, Estadão, Poder360, CNN Brasil, Reuters, AFP, BBC).
- Só escreva o que a fonte confirma. Não invente nomes, números, datas nem falas. Se uma informação não estiver clara, deixe de fora.
- Não repita assuntos que já estão na lista de matérias publicadas recentemente.
- Notícias de política e eleição: tom neutro, sem opinião, atribuindo cada afirmação a quem disse.

Como escrever:
- Texto próprio, em português do Brasil, claro e direto, como um bom jornal regional. Nunca copie frases das fontes.
- 3 a 6 parágrafos curtos, separados por \\n, sem títulos internos, sem markdown, sem emojis.
- O primeiro parágrafo responde o quê, quem, quando e onde.
- Última linha: "Com informações de <fonte>." citando os veículos usados.

Fotos (obrigatórias):
- Toda matéria precisa de uma foto que combine com ela: o próprio fato, ou a pessoa, o lugar ou a instituição de que a notícia trata. Foto genérica ou de outro lugar não serve.
- Primeiro procure a foto oficial do fato: ache a página do órgão público envolvido (prefeitura, governo, polícia, tribunal, Câmara, Senado) ou da Agência Brasil e use fotos_da_pagina. Se não houver, use buscar_foto no Wikimedia Commons para a pessoa, o lugar ou a instituição da notícia.
- Antes de entregar, confira cada foto com ver_foto. Se ela não mostrar o que a notícia trata, procure outra.
- Nunca use fotos de portais de notícia (BR104, TNH1, g1 e outros): elas têm direito autoral.
- Se não encontrar uma foto adequada, não entregue essa matéria: troque por outra notícia que tenha foto.
- Em foto_credito escreva uma legenda curta e o crédito. Foto oficial: "<legenda>. Foto: <fotógrafo>/<órgão>" (ou "Foto: <órgão>" se a página não disser o fotógrafo). Commons: "<legenda> (arquivo). Foto: <autor>/Wikimedia Commons (<licença>)".

Quando terminar, chame entregar_materias uma única vez com todas as matérias.`;

function todayLabel() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
}

// ---------- Execução ----------
async function insertMaterias(materias, autopublicar, fotosPermitidas, log) {
  let criadas = 0;
  for (const m of materias) {
    if (!CATEGORIES[m.categoria] || !m.titulo || !m.resumo || !m.conteudo || !/^https?:\/\//.test(m.fonte_url)) {
      log.push(`Descartada (campos incompletos): ${m.titulo || '(sem título)'}`);
      continue;
    }
    const dup = await db.get('SELECT id FROM news WHERE source_url = ? OR title = ?', [m.fonte_url, m.titulo]);
    if (dup) {
      log.push(`Descartada (já existe, nº ${dup.id}): ${m.titulo}`);
      continue;
    }
    // Regra da redação: nenhuma matéria entra sem foto. A foto precisa ter vindo de
    // uma página oficial ou do Commons nesta busca, ter sido conferida e estar no ar.
    const foto = fotosPermitidas.get(m.foto_url);
    if (!foto || !m.foto_credito || !m.foto_credito.trim()) {
      log.push(`Descartada (sem foto adequada ou sem crédito): ${m.titulo}`);
      continue;
    }
    if (!foto.conferida) {
      log.push(`Descartada (a foto não foi conferida): ${m.titulo}`);
      continue;
    }
    if (!(await imageIsReachable(m.foto_url))) {
      log.push(`Descartada (a foto não abre): ${m.titulo}`);
      continue;
    }
    const content = `${m.conteudo.trim()}\n${m.foto_credito.trim()}`;
    const haystack = `${m.titulo} ${m.resumo} ${m.conteudo}`.toLowerCase();
    const sensivel = SENSITIVE_TERMS.some((t) => haystack.includes(t));
    const status = autopublicar && !sensivel ? 'published' : 'pending';
    const info = await db.run(
      'INSERT INTO news (title, summary, content, image, category, featured, source_url, source_name, status, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NOW())',
      [m.titulo.trim().slice(0, 300), m.resumo.trim(), content, m.foto_url, m.categoria, m.fonte_url, (m.fonte_nome || '').slice(0, 250), status]
    );
    criadas += 1;
    log.push(`${status === 'published' ? 'Publicada' : 'Na fila de revisão'} (nº ${info.lastInsertRowid}): ${m.titulo}`);
  }
  return criadas;
}

async function runPauta({ origem = 'manual', categorias, quantidade, foco = '' } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('A pauta automática não está configurada: falta a variável ANTHROPIC_API_KEY no servidor.');
    err.status = 503;
    throw err;
  }
  if (currentRunId) {
    const err = new Error('Já existe uma busca em andamento. Aguarde ela terminar.');
    err.status = 409;
    throw err;
  }
  const config = await getConfig();
  const cats = (Array.isArray(categorias) && categorias.length ? categorias : config.categorias).filter((k) => CATEGORIES[k]);
  const qtd = Number.isInteger(Number(quantidade)) && quantidade >= 1 && quantidade <= 5 ? Number(quantidade) : config.quantidade;
  if (!cats.length) {
    const err = new Error('Escolha pelo menos uma categoria.');
    err.status = 400;
    throw err;
  }

  const info = await db.run("INSERT INTO pauta_runs (origem, categorias, status, started_at) VALUES (?, ?, 'rodando', NOW())", [origem, cats.join(',')]);
  const runId = info.lastInsertRowid;
  currentRunId = runId;

  // Roda em segundo plano: a resposta HTTP volta na hora e o painel acompanha pelo status.
  execute(runId, cats, qtd, String(foco || '').slice(0, 500), config.autopublicar)
    .catch(() => {})
    .finally(() => { currentRunId = null; });
  return runId;
}

async function execute(runId, cats, qtd, foco, autopublicar) {
  const log = [];
  const finish = async (statusFinal, mensagem, criadas = 0) => {
    await db.run(
      'UPDATE pauta_runs SET status = ?, mensagem = ?, criadas = ?, log = ?, finished_at = NOW() WHERE id = ?',
      [statusFinal, mensagem, criadas, log.join('\n'), runId]
    );
  };

  try {
    const recentes = await db.all("SELECT title FROM news WHERE created_at >= NOW() - INTERVAL 4 DAY ORDER BY created_at DESC LIMIT 120");
    const pedido = cats.map((k) => `- ${k}: ${CATEGORIES[k]} — ${qtd} matéria(s)`).join('\n');
    const userText = `Agora é ${todayLabel()} (horário de Alagoas).

Encontre e escreva as matérias abaixo:
${pedido}
${foco ? `\nOrientação da redação para esta busca: ${foco}\n` : ''}
Matérias publicadas recentemente (não repita esses assuntos):
${recentes.map((r) => `- ${r.title}`).join('\n') || '- (nenhuma)'}`;

    const client = new Anthropic();
    const messages = [{ role: 'user', content: userText }];
    let entregues = null;
    // Fotos que o Claude pode usar: só as devolvidas pelas ferramentas nesta busca.
    const fotosPermitidas = new Map();

    for (let i = 0; i < 25 && !entregues; i++) {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high' },
        system: SYSTEM,
        tools: TOOLS,
        messages
      });
      const message = await stream.finalMessage();

      if (message.stop_reason === 'refusal') {
        throw new Error('O Claude recusou o pedido desta busca.');
      }
      if (message.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: message.content });
        continue;
      }

      const toolUses = message.content.filter((b) => b.type === 'tool_use');
      if (!toolUses.length) {
        if (message.stop_reason === 'max_tokens') throw new Error('A resposta ficou longa demais e foi cortada.');
        break;
      }
      if (message.stop_reason === 'max_tokens') throw new Error('A resposta foi cortada no meio de uma ferramenta.');

      messages.push({ role: 'assistant', content: message.content });
      const results = [];
      for (const tu of toolUses) {
        if (tu.name === 'buscar_foto') {
          const termo = typeof tu.input?.termo === 'string' ? tu.input.termo.slice(0, 120) : '';
          try {
            const fotos = termo ? await searchCommons(termo) : [];
            fotos.forEach((f) => { if (!fotosPermitidas.has(f.url)) fotosPermitidas.set(f.url, { origem: 'commons', conferida: false }); });
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(fotos.length ? fotos : { aviso: 'Nenhuma foto encontrada. Tente outro termo.' }) });
          } catch (e) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: `Falha ao consultar o Commons: ${e.message}` });
          }
        } else if (tu.name === 'fotos_da_pagina') {
          const url = typeof tu.input?.url === 'string' ? tu.input.url.trim() : '';
          try {
            const r = await photosFromOfficialPage(url);
            r.fotos.forEach((f) => { if (!fotosPermitidas.has(f.url)) fotosPermitidas.set(f.url, { origem: 'oficial', conferida: false }); });
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(r.fotos.length ? r : { aviso: 'Nenhuma foto encontrada nesta página.', pagina: r.pagina }) });
          } catch (e) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: `Não foi possível ler a página: ${e.message}` });
          }
        } else if (tu.name === 'ver_foto') {
          const url = typeof tu.input?.url === 'string' ? tu.input.url.trim() : '';
          const foto = fotosPermitidas.get(url);
          if (!foto) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: 'Esta URL não veio de fotos_da_pagina nem de buscar_foto nesta busca.' });
          } else {
            try {
              const img = await loadImageForReview(url);
              foto.conferida = true;
              results.push({ type: 'tool_result', tool_use_id: tu.id, content: [
                { type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } },
                { type: 'text', text: 'Confira se a foto mostra o fato, a pessoa, o lugar ou a instituição da matéria.' }
              ] });
            } catch (e) {
              results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: `Não foi possível abrir a foto: ${e.message}` });
            }
          }
        } else if (tu.name === 'entregar_materias') {
          const materias = Array.isArray(tu.input?.materias) ? tu.input.materias : null;
          if (!materias) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: 'Envie o campo materias como lista.' });
          } else {
            entregues = materias;
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Recebido.' });
          }
        } else {
          results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: 'Ferramenta desconhecida.' });
        }
      }
      messages.push({ role: 'user', content: results });
    }

    if (!entregues) {
      log.push('O Claude terminou sem entregar matérias.');
      await finish('erro', 'Nenhuma matéria foi entregue nesta busca.');
      return;
    }
    const criadas = await insertMaterias(entregues, autopublicar, fotosPermitidas, log);
    await finish('concluida', criadas ? `${criadas} matéria(s) criada(s).` : 'Nenhuma matéria nova (todas já existiam ou estavam incompletas).', criadas);
  } catch (e) {
    let msg = e.message || String(e);
    if (e instanceof Anthropic.AuthenticationError) msg = 'A chave ANTHROPIC_API_KEY é inválida.';
    else if (e instanceof Anthropic.RateLimitError) msg = 'Limite de uso da API atingido. Tente de novo em alguns minutos.';
    else if (e instanceof Anthropic.APIError) msg = `Erro da API da Anthropic (${e.status}): ${e.message}`;
    log.push(`Erro: ${msg}`);
    await finish('erro', msg);
  }
}

// ---------- Agendamento ----------
let lastSlot = '';
function startScheduler() {
  setInterval(async () => {
    try {
      const config = await getConfig();
      if (!config.ativo || !process.env.ANTHROPIC_API_KEY || currentRunId) return;
      const now = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
      const [day, hm] = now.split(', ');
      const slot = `${day} ${hm}`;
      if (config.horarios.includes(hm) && slot !== lastSlot) {
        lastSlot = slot;
        await runPauta({ origem: 'agendada' });
      }
    } catch (e) {
      console.error('Pauta automática (agendamento):', e.message);
    }
  }, 30 * 1000);
}

module.exports = { init, status, getConfig, saveConfig, runPauta, startScheduler, searchCommons, sanitizeConfig, photosFromOfficialPage };
