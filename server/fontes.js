// Fontes da redação manual: lista as últimas notícias dos portais e agências,
// abre a matéria original e traz texto e fotos para o app do celular. Não usa IA.
const UA = 'AGFMNewsPauta/1.0 (https://radioagfmnews.com.br)';
const CACHE_MS = 5 * 60 * 1000;
const MAX_BYTES = 3 * 1024 * 1024;

// Em portais de notícia o texto tem dono: ele aparece só como consulta, nunca
// entra pronto na matéria. Agências públicas liberam a reprodução com crédito.
const FONTES = [
  {
    id: 'br104', nome: 'BR104', url: 'https://www.br104.com.br/', host: 'www.br104.com.br', publica: false,
    link: /^https:\/\/www\.br104\.com\.br\/(?!pernambuco\/|caruaru\/|eleicoes-2026\/)[^/]+\/[^/]+\/[^/]+\/?$/
  },
  {
    id: 'a24h', nome: 'Alagoas 24 Horas', url: 'https://www.alagoas24horas.com.br/', host: 'www.alagoas24horas.com.br', publica: false,
    link: /^https:\/\/www\.alagoas24horas\.com\.br\/\d{6,}\/[^/]+\/?$/
  },
  {
    id: 'agal', nome: 'Agência Alagoas', url: 'https://www.alagoas.al.gov.br/noticias', host: 'www.alagoas.al.gov.br', publica: true,
    link: /^https:\/\/www\.alagoas\.al\.gov\.br\/noticia\/[^/?#]+$/
  },
  {
    id: 'abr', nome: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/ultimas', host: 'agenciabrasil.ebc.com.br', publica: true,
    link: /^https:\/\/agenciabrasil\.ebc\.com\.br\/[a-z-]+\/noticia\/\d{4}-\d{2}\/[^/?#]+$/
  }
];

const POLITICA = /\b(lula|bolsonaro|fl[aá]vio|trump|tarc[ií]sio|moraes|stf|tse|tre|senado|c[aâ]mara|congresso|deputad[oa]s?|senador(a|es)?|vereador(a|es)?|prefeit[oa]|governador(a)?|ministr[oa]s?|presidente da rep[uú]blica|elei[cç][aãõ]o|elei[cç][oõ]es|eleitoral|eleitor(es)?|candidatura|partido|pl|pt|mdb|pec|impeachment|paulo dantas|jhc)\b/i;

// Fotos da Reuters vêm com "proibida reprodução" e nunca podem ser usadas.
const FOTO_PROIBIDA = /lynx|_rtr[a-z]+_|reuters/i;
const FOTO_LIXO = /(logo|icon|favicon|brasao|banner|avatar|sprite|loading|placeholder|spacer|blank|publicidade|anuncio|\.svg|\.gif|ebc\.png|tom\.png|timthumb|img-gnews|luanderson|giovana|rayanne|izael|ian-santana|-\d{2,4}x\d{2,4}\.)/i;
const TEXTO_LIXO = /^(leia (também|mais)|veja (também|mais)|siga |participe|compartilhe|clique |todos os direitos|copyright|©|publicidade|assine|receba |este site|utilizamos cookies|edição:|correções:|encontrou um erro|portal oficial|é proibida a reprodução)/i;

const cache = new Map();

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;|&mdash;/g, '–')
    .replace(/&amp;/g, '&');
}

const limpar = (html) => decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

async function baixar(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`a página respondeu ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES * 2) throw new Error('página grande demais');
  return { html: buf.toString('utf8'), final: res.url || url };
}

// O BR104 cola o nome da editoria no começo do título do link.
const semRepeticao = (t) => t.replace(/^(.{4,40}?) (?=\1 )/, '');

function extrairLinks(html, fonte) {
  const achados = new Map();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = (m[1].match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    let url;
    try { url = new URL(decodeEntities(href), fonte.url).href.split('#')[0]; } catch { continue; }
    if (!fonte.link.test(url)) continue;
    const titulo = semRepeticao(limpar(m[2])) || decodeEntities((m[1].match(/title=["']([^"']+)["']/i) || [])[1] || '').trim();
    if (titulo.length < 25 || titulo.length > 220) continue;
    const atual = achados.get(url);
    if (!atual) achados.set(url, titulo);
    else if (titulo.length < atual.length) achados.set(url, titulo); // o link sem o resumo junto é o mais limpo
  }
  return [...achados].map(([url, titulo]) => ({ url, titulo }));
}

function categoriaDe(fonte, url) {
  const p = new URL(url).pathname;
  if (fonte.id === 'abr') {
    if (p.startsWith('/internacional/')) return 'mundo';
    if (p.startsWith('/esportes/')) return 'esportes';
    if (p.startsWith('/saude/')) return 'saude';
    if (p.startsWith('/cultura/')) return 'entretenimento';
    return 'brasil';
  }
  if (/esporte/.test(p)) return 'esportes';
  if (/saude/.test(p)) return 'saude';
  if (fonte.id === 'br104' && /uniao-dos-palmares|sao-jose-da-laje|murici|branquinha|ibateguara|santana-do-mundau|messias|cha-preta/.test(p)) return 'interior';
  return 'alagoas';
}

async function listar(fonte) {
  const guardado = cache.get(fonte.id);
  if (guardado && Date.now() - guardado.em < CACHE_MS) return guardado.itens;
  const { html } = await baixar(fonte.url);
  const itens = extrairLinks(html, fonte).slice(0, 40).map((n) => ({
    ...n,
    fonte: fonte.id,
    fonteNome: fonte.nome,
    categoria: categoriaDe(fonte, n.url),
    politica: POLITICA.test(n.titulo) || /\/politica\//.test(n.url)
  }));
  cache.set(fonte.id, { em: Date.now(), itens });
  return itens;
}

// Lista as quatro fontes juntas. Se uma cair, as outras continuam aparecendo.
async function listarTodas() {
  const lotes = await Promise.allSettled(FONTES.map(listar));
  const erros = [];
  const porFonte = lotes.map((l, i) => {
    if (l.status === 'fulfilled') return l.value;
    erros.push(FONTES[i].nome);
    return [];
  });
  // Intercala as fontes para nenhuma tomar a tela inteira.
  const noticias = [];
  const maior = Math.max(0, ...porFonte.map((l) => l.length));
  for (let i = 0; i < maior; i += 1) {
    for (const lista of porFonte) if (lista[i]) noticias.push(lista[i]);
  }
  return { noticias, erros };
}

function meta(html, nome) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]*>`, 'i'));
  return tag ? decodeEntities((tag[0].match(/content=["']([^"']*)["']/i) || [])[1] || '').trim() : '';
}

function miolo(html) {
  const semRuido = html
    .replace(/<(script|style|noscript|svg|nav|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  // O que vem no <article> costuma ser o mais confiável, mas o Alagoas 24 Horas usa
  // <article> só no cabeçalho e guarda o corpo em .entry-content. Vale o que tiver mais parágrafos.
  const artigo = semRuido.match(/<article\b[\s\S]*?<\/article>/i);
  const corpo = semRuido.match(/class=["'][^"']*\bentry-content\b[\s\S]*?(?=class=["'][^"']*\bpost-tags\b|<\/article>|$)/i);
  const paragrafos = (texto) => (texto.match(/<p\b/gi) || []).length;
  const melhor = [artigo, corpo].filter(Boolean).map((m) => m[0])
    .sort((a, b) => paragrafos(b) - paragrafos(a))[0];
  return melhor && paragrafos(melhor) > 0 ? melhor : semRuido;
}

function extrairParagrafos(trecho, titulo) {
  const vistos = new Set();
  const saida = [];
  for (const m of trecho.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const texto = limpar(m[1]);
    if (texto.length < 40 || TEXTO_LIXO.test(texto) || vistos.has(texto) || texto === titulo) continue;
    vistos.add(texto);
    saida.push(texto);
    if (saida.length >= 30) break;
  }
  return saida;
}

function extrairFotos(html, trecho, base, fonte) {
  const fotos = new Map();
  const add = (src, legenda) => {
    let url;
    try { url = new URL(decodeEntities(src), base).href; } catch { return; }
    if (!/^https:\/\//.test(url) || FOTO_LIXO.test(url) || FOTO_PROIBIDA.test(url)) return;
    if (!fotos.has(url)) fotos.set(url, { url, legenda: limpar(legenda).slice(0, 160) });
  };
  const og = meta(html, 'og:image');
  if (og) add(og.replace('/conteudos/reduzidas/', '/conteudos/'), '');
  // Nas agências, as outras imagens da página são de notícias relacionadas.
  if (fonte.publica) return [...fotos.values()];
  for (const m of trecho.matchAll(/<img\b[^>]*>/gi)) {
    const attr = (n) => (m[0].match(new RegExp(`\\s${n}=["']([^"']+)["']`, 'i')) || [])[1];
    const src = attr('data-src') || attr('data-original') || attr('data-lazy-src') || attr('src');
    if (src && !src.startsWith('data:')) add(src, attr('alt') || '');
    if (fotos.size >= 6) break;
  }
  return [...fotos.values()];
}

function acharCredito(html) {
  const legendas = [
    (html.match(/class=["']credito-foto[^>]*>([\s\S]*?)<\/figcaption>/i) || [])[1],
    (html.match(/fa-camera["'][^>]*><\/i>([\s\S]*?)<\/p>/i) || [])[1],
    ...[...html.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi)].map((m) => m[1]),
    ...[...html.matchAll(/wp-caption-text[^>]*>([\s\S]*?)<\//gi)].map((m) => m[1])
  ].filter(Boolean).map(limpar);
  for (const l of legendas) {
    const m = l.match(/(?:\bfotos?|\bimagem|©)\s*:?\s*([^|)]{3,80})/i);
    if (m) return m[1].trim().replace(/\.$/, '');
    if (l.length <= 60 && /\/|ascom/i.test(l)) return l;
  }
  return '';
}

const diaDe = (data) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Maceio' }).format(data);

// Data de publicação no fuso de Alagoas. A Agência Alagoas não traz metadados:
// lá a data é a primeira que aparece depois do título.
function dataDaMateria(html) {
  const iso = meta(html, 'article:published_time') || (html.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1];
  const data = iso ? new Date(iso) : null;
  if (data && !Number.isNaN(data.getTime())) return diaDe(data);
  const titulo = html.search(/<h1\b/i);
  const m = html.slice(Math.max(titulo, 0)).match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

async function abrir(urlBruta) {
  let u;
  try { u = new URL(urlBruta); } catch { throw new Error('Link inválido'); }
  const fonte = FONTES.find((f) => f.host === u.hostname);
  if (u.protocol !== 'https:' || !fonte || !fonte.link.test(u.href.split('#')[0])) {
    throw new Error('Esse link não é de uma das fontes do app.');
  }
  const { html, final } = await baixar(u.href);
  const trecho = miolo(html);
  const credito = acharCredito(html);
  const fotoProibida = /proibid[ao] (a )?reprodu|reuters/i.test(credito);
  const textoProibido = /é proibida a reprodução deste conteúdo/i.test(limpar(trecho));
  const titulo = meta(html, 'og:title').replace(/(\s+\|\s+[^|]+)+$/, '').trim() || limpar((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
  return {
    url: u.href,
    fonte: fonte.id,
    fonteNome: fonte.nome,
    textoLivre: fonte.publica && !textoProibido,
    categoria: categoriaDe(fonte, u.href),
    titulo,
    resumo: meta(html, 'og:description').slice(0, 300),
    paragrafos: extrairParagrafos(trecho, titulo),
    fotos: fotoProibida ? [] : extrairFotos(html, trecho, final, fonte),
    fotoProibida,
    credito: fotoProibida ? '' : credito,
    data: dataDaMateria(html)
  };
}

// O título do link pode não citar política; a matéria aberta mostra melhor o assunto.
function tocaPolitica(m) {
  if (/(^|[^\p{L}])(presidente|governo|mp|renúncia|renuncia|direita|esquerda|protesto)(?![\p{L}])/iu.test(m.titulo)) return true;
  return POLITICA.test(m.titulo) || POLITICA.test(m.resumo) || m.paragrafos.slice(0, 2).some((p) => POLITICA.test(p));
}

async function emParalelo(itens, limite, tarefa) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo;
      proximo += 1;
      resultados[i] = await tarefa(itens[i]);
    }
  };
  await Promise.all(Array.from({ length: limite }, trabalhador));
  return resultados;
}

function conteudoPronto(m) {
  return [...m.paragrafos, `Com informações de ${m.fonteNome}.`, `Foto: ${m.credito || m.fonteNome}`].join('\n');
}

// Abre as notícias das quatro fontes e separa as de hoje, sem política. Texto de
// agência pública vem pronto para revisão; portal tem texto com dono e fica para
// o editor escrever. Uma notícia ou fonte que falhar não derruba as outras.
async function noticiasDoDia() {
  cache.clear();
  const { noticias, erros } = await listarTodas();
  const dia = diaDe(new Date());
  let falhas = 0;
  const abertas = await emParalelo(noticias.filter((n) => !n.politica), 5, async (n) => {
    try {
      return await abrir(n.url);
    } catch {
      falhas += 1;
      return null;
    }
  });
  const prontas = [];
  const aEscrever = [];
  for (const m of abertas) {
    if (!m || m.data !== dia || tocaPolitica(m)) continue;
    const base = { url: m.url, fonteNome: m.fonteNome, categoria: m.categoria, titulo: m.titulo, foto: m.fotos[0] ? m.fotos[0].url : '' };
    if (m.textoLivre && base.foto && m.paragrafos.length >= 3) {
      prontas.push({ ...base, resumo: (m.resumo || m.paragrafos[0]).slice(0, 280), conteudo: conteudoPronto(m) });
    } else {
      aEscrever.push(base);
    }
  }
  return { dia, erros, falhas, prontas, aEscrever };
}

module.exports = { listarTodas, abrir, noticiasDoDia, diaDe, FONTES };
