const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5174;
// Só o conteúdo de public/ é servido via HTTP — mantém server/, data/ (banco de dados),
// .git/ e arquivos de configuração fora do alcance de qualquer requisição externa.
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Necessário quando o site roda atrás de um proxy reverso (Render, Cloudflare etc.)
// para o rate limiting e os cookies seguros identificarem o IP/protocolo reais.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'", 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"]
    }
  }
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// Limita tentativas de login para dificultar ataques de força bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }
});

// Limite geral de requisições por IP, para proteger o servidor de sobrecarga/abuso.
// Valor alto o suficiente para não travar IPs compartilhados (redes de escola/escritório)
// em dias de muito acesso, mas ainda capaz de barrar automações abusivas.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um instante e tente novamente.' }
});
app.use('/api/', apiLimiter);

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Não autenticado' });
}

// ---------- Auth ----------
app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Informe usuário e senha' });
  }
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ ok: true, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ loggedIn: true, username: req.session.username });
  }
  res.json({ loggedIn: false });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Senha atual e nova senha (mín. 6 caracteres) são obrigatórias' });
  }
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.session.userId);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

// ---------- News (public read) ----------
app.get('/api/news', (req, res) => {
  const { category, featured, limit } = req.query;
  let sql = 'SELECT * FROM news';
  const clauses = [];
  const params = [];
  if (category) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (featured === '1') {
    clauses.push('featured = 1');
  }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  if (limit) {
    sql += ' LIMIT ?';
    params.push(Number(limit));
  }
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.get('/api/news/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Notícia não encontrada' });
  res.json(row);
});

// ---------- News (métricas públicas: cliques e visualizações) ----------
app.post('/api/news/:id/view', (req, res) => {
  const info = db.prepare('UPDATE news SET views = views + 1 WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Notícia não encontrada' });
  res.json({ ok: true });
});

app.post('/api/news/:id/click', (req, res) => {
  const info = db.prepare('UPDATE news SET clicks = clicks + 1 WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Notícia não encontrada' });
  res.json({ ok: true });
});

// ---------- News (admin write) ----------
app.post('/api/news', requireAuth, (req, res) => {
  const { title, summary, content, image, category, featured } = req.body || {};
  if (!title || !summary || !content || !category) {
    return res.status(400).json({ error: 'Preencha título, resumo, conteúdo e categoria' });
  }
  const img = image || `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' width='700' height='420'><rect width='100%' height='100%' fill='#2fa84f'/><text x='50%' y='50%' font-family='sans-serif' font-size='20' fill='#ffffff' text-anchor='middle' dominant-baseline='middle'>AG FM</text></svg>`
  ).toString('base64')}`;
  const info = db.prepare(`
    INSERT INTO news (title, summary, content, image, category, featured, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(title, summary, content, img, category, featured ? 1 : 0);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/news/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Notícia não encontrada' });
  const { title, summary, content, image, category, featured } = req.body || {};
  db.prepare(`
    UPDATE news SET title = ?, summary = ?, content = ?, image = ?, category = ?, featured = ?
    WHERE id = ?
  `).run(
    title ?? existing.title,
    summary ?? existing.summary,
    content ?? existing.content,
    image ?? existing.image,
    category ?? existing.category,
    featured !== undefined ? (featured ? 1 : 0) : existing.featured,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/news/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Notícia não encontrada' });
  res.json({ ok: true });
});

// ---------- Ingestão automática (curadoria de pautas do BR104) ----------
// Endpoint dedicado para a rotina agendada que monitora o BR104 e publica
// matérias ORIGINAIS da AGFM (nunca cópia literal) inspiradas nas pautas de lá,
// sempre com created_at atual e crédito da fonte em source_url/source_name.
const ALLOWED_CATEGORIES = ['alagoas', 'interior', 'entretenimento', 'saude', 'esportes'];

function requireIngestToken(req, res, next) {
  const token = process.env.INGEST_TOKEN;
  if (!token) {
    return res.status(503).json({ error: 'Ingestão automática não configurada (defina INGEST_TOKEN no ambiente do servidor)' });
  }
  const provided = req.get('X-Ingest-Token') || '';
  const expected = Buffer.from(token);
  const given = Buffer.from(provided);
  const valid = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (!valid) {
    return res.status(401).json({ error: 'Token de ingestão inválido' });
  }
  next();
}

// Lista as fontes (source_url) já publicadas, para a rotina comparar de uma vez
// com as pautas atuais do BR104 e evitar reprocessar a mesma matéria.
app.get('/api/ingest/known-sources', requireIngestToken, (req, res) => {
  const rows = db.prepare('SELECT source_url FROM news WHERE source_url IS NOT NULL').all();
  res.json({ source_urls: rows.map((r) => r.source_url) });
});

app.post('/api/ingest/news', requireIngestToken, (req, res) => {
  const { title, summary, content, image, category, featured, source_url, source_name } = req.body || {};
  if (!title || !summary || !content || !category || !source_url) {
    return res.status(400).json({ error: 'Preencha título, resumo, conteúdo, categoria e source_url' });
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Categoria inválida. Use uma de: ${ALLOWED_CATEGORIES.join(', ')}` });
  }

  const existing = db.prepare('SELECT id FROM news WHERE source_url = ?').get(source_url);
  if (existing) {
    return res.json({ ok: true, duplicate: true, id: existing.id });
  }

  const img = image || `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' width='700' height='420'><rect width='100%' height='100%' fill='#2fa84f'/><text x='50%' y='50%' font-family='sans-serif' font-size='20' fill='#ffffff' text-anchor='middle' dominant-baseline='middle'>AG FM</text></svg>`
  ).toString('base64')}`;

  const info = db.prepare(`
    INSERT INTO news (title, summary, content, image, category, featured, source_url, source_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(title, summary, content, img, category, featured ? 1 : 0, source_url, source_name || null);

  res.json({ ok: true, duplicate: false, id: info.lastInsertRowid });
});

// ---------- Comprovantes de irradiação (admin only) ----------
app.get('/api/comprovantes', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM comprovantes ORDER BY created_at DESC').all();
  res.json(rows.map((r) => ({ ...r, insercoes: JSON.parse(r.insercoes) })));
});

app.get('/api/comprovantes/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM comprovantes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Comprovante não encontrado' });
  res.json({ ...row, insercoes: JSON.parse(row.insercoes) });
});

app.post('/api/comprovantes', requireAuth, (req, res) => {
  const { anunciante, comercial, dataInicio, dataFim, insercoes, responsavelNome, responsavelCargo } = req.body || {};
  if (!anunciante || !comercial || !dataInicio || !dataFim || !Array.isArray(insercoes) || !insercoes.length || !responsavelNome || !responsavelCargo) {
    return res.status(400).json({ error: 'Preencha anunciante, comercial, período, ao menos uma inserção e o responsável' });
  }
  const info = db.prepare(`
    INSERT INTO comprovantes (anunciante, comercial, data_inicio, data_fim, insercoes, responsavel_nome, responsavel_cargo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(anunciante, comercial, dataInicio, dataFim, JSON.stringify(insercoes), responsavelNome, responsavelCargo);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.delete('/api/comprovantes/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM comprovantes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Comprovante não encontrado' });
  res.json({ ok: true });
});

// ---------- Static site ----------
// Fotos de notícia têm nome único por arquivo, então podem ficar em cache por muito
// tempo sem risco. CSS/JS mudam no mesmo nome de arquivo, então usam "no-cache":
// o navegador ainda guarda uma cópia local, mas sempre confere com o servidor antes
// de reusá-la (resposta 304 barata) — assim uma correção aparece na hora pra quem
// já visitou o site, sem perder o ganho de performance em dias de muito acesso.
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, filePath) => {
    if (/\.(png|jpe?g|webp|svg|gif|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.listen(PORT, () => {
  console.log(`AG FM site rodando em http://localhost:${PORT}`);
});
