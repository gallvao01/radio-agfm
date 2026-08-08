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
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Informe usuário e senha' });
  }
  const user = await db.get('SELECT * FROM admin_users WHERE username = ?', [username]);
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

app.post('/api/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Senha atual e nova senha (mín. 6 caracteres) são obrigatórias' });
  }
  const user = await db.get('SELECT * FROM admin_users WHERE id = ?', [req.session.userId]);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.run('UPDATE admin_users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  res.json({ ok: true });
});

// ---------- News (public read) ----------
// Só notícias com status='published' aparecem aqui — as pendentes (vindas da
// ingestão automática) ficam invisíveis pro público até alguém aprovar no painel.
app.get('/api/news', async (req, res) => {
  const { category, featured, limit } = req.query;
  let sql = "SELECT * FROM news WHERE status = 'published'";
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (featured === '1') {
    sql += ' AND featured = 1';
  }
  sql += ' ORDER BY created_at DESC';
  if (limit) {
    sql += ' LIMIT ?';
    params.push(Number(limit));
  }
  const rows = await db.all(sql, params);
  res.json(rows);
});

app.get('/api/news/:id', async (req, res) => {
  const row = await db.get("SELECT * FROM news WHERE id = ? AND status = 'published'", [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Notícia não encontrada' });
  res.json(row);
});

// ---------- News (métricas públicas: cliques e visualizações) ----------
app.post('/api/news/:id/view', async (req, res) => {
  const info = await db.run('UPDATE news SET views = views + 1 WHERE id = ?', [req.params.id]);
  if (info.changes === 0) return res.status(404).json({ error: 'Notícia não encontrada' });
  res.json({ ok: true });
});

app.post('/api/news/:id/click', async (req, res) => {
  const info = await db.run('UPDATE news SET clicks = clicks + 1 WHERE id = ?', [req.params.id]);
  if (info.changes === 0) return res.status(404).json({ error: 'Notícia não encontrada' });
  res.json({ ok: true });
});

// ---------- News (admin write) ----------
app.post('/api/news', requireAuth, async (req, res) => {
  const { title, summary, content, image, video, gallery, category, featured } = req.body || {};
  if (!title || !summary || !content || !category) {
    return res.status(400).json({ error: 'Preencha título, resumo, conteúdo e categoria' });
  }
  const img = image || `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' width='700' height='420'><rect width='100%' height='100%' fill='#2fa84f'/><text x='50%' y='50%' font-family='sans-serif' font-size='20' fill='#ffffff' text-anchor='middle' dominant-baseline='middle'>AG FM</text></svg>`
  ).toString('base64')}`;
  const info = await db.run(
    'INSERT INTO news (title, summary, content, image, video, gallery, category, featured, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
    [title, summary, content, img, video || null, gallery ? JSON.stringify(gallery) : null, category, featured ? 1 : 0]
  );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/news/:id', requireAuth, async (req, res) => {
  const existing = await db.get('SELECT * FROM news WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Notícia não encontrada' });
  const { title, summary, content, image, video, gallery, category, featured } = req.body || {};
  await db.run(
    'UPDATE news SET title = ?, summary = ?, content = ?, image = ?, video = ?, gallery = ?, category = ?, featured = ? WHERE id = ?',
    [
      title ?? existing.title,
      summary ?? existing.summary,
      content ?? existing.content,
      image ?? existing.image,
      video !== undefined ? (video || null) : existing.video,
      gallery !== undefined ? (gallery ? JSON.stringify(gallery) : null) : existing.gallery,
      category ?? existing.category,
      featured !== undefined ? (featured ? 1 : 0) : existing.featured,
      req.params.id
    ]
  );
  res.json({ ok: true });
});

app.delete('/api/news/:id', requireAuth, async (req, res) => {
  const info = await db.run('DELETE FROM news WHERE id = ?', [req.params.id]);
  if (info.changes === 0) return res.status(404).json({ error: 'Notícia não encontrada' });
  res.json({ ok: true });
});

// ---------- Fila de revisão (pautas da ingestão automática aguardando aprovação) ----------
app.get('/api/admin/news/pending', requireAuth, async (req, res) => {
  const rows = await db.all("SELECT * FROM news WHERE status = 'pending' ORDER BY created_at DESC");
  res.json(rows);
});

app.post('/api/news/:id/approve', requireAuth, async (req, res) => {
  const info = await db.run("UPDATE news SET status = 'published' WHERE id = ? AND status = 'pending'", [req.params.id]);
  if (info.changes === 0) return res.status(404).json({ error: 'Pauta pendente não encontrada' });
  res.json({ ok: true });
});

app.post('/api/news/:id/reject', requireAuth, async (req, res) => {
  const info = await db.run("UPDATE news SET status = 'rejected' WHERE id = ? AND status = 'pending'", [req.params.id]);
  if (info.changes === 0) return res.status(404).json({ error: 'Pauta pendente não encontrada' });
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
app.get('/api/ingest/known-sources', requireIngestToken, async (req, res) => {
  const rows = await db.all('SELECT source_url FROM news WHERE source_url IS NOT NULL');
  res.json({ source_urls: rows.map((r) => r.source_url) });
});

app.post('/api/ingest/news', requireIngestToken, async (req, res) => {
  const { title, summary, content, image, video, gallery, category, featured, source_url, source_name } = req.body || {};
  if (!title || !summary || !content || !category || !source_url) {
    return res.status(400).json({ error: 'Preencha título, resumo, conteúdo, categoria e source_url' });
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Categoria inválida. Use uma de: ${ALLOWED_CATEGORIES.join(', ')}` });
  }

  const existing = await db.get('SELECT id FROM news WHERE source_url = ?', [source_url]);
  if (existing) {
    return res.json({ ok: true, duplicate: true, id: existing.id });
  }

  const img = image || `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' width='700' height='420'><rect width='100%' height='100%' fill='#2fa84f'/><text x='50%' y='50%' font-family='sans-serif' font-size='20' fill='#ffffff' text-anchor='middle' dominant-baseline='middle'>AG FM</text></svg>`
  ).toString('base64')}`;

  // Entra como 'pending' — nunca vai direto pro ar. Só aparece pro público depois
  // que alguém da equipe revisar e aprovar pelo painel admin (fila de revisão).
  const info = await db.run(
    "INSERT INTO news (title, summary, content, image, video, gallery, category, featured, source_url, source_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())",
    [title, summary, content, img, video || null, gallery ? JSON.stringify(gallery) : null, category, featured ? 1 : 0, source_url, source_name || null]
  );

  res.json({ ok: true, duplicate: false, pending: true, id: info.lastInsertRowid });
});

// ---------- Comprovantes de irradiação (admin only) ----------
app.get('/api/comprovantes', requireAuth, async (req, res) => {
  const rows = await db.all('SELECT * FROM comprovantes ORDER BY created_at DESC');
  res.json(rows.map((r) => ({ ...r, insercoes: JSON.parse(r.insercoes) })));
});

app.get('/api/comprovantes/:id', requireAuth, async (req, res) => {
  const row = await db.get('SELECT * FROM comprovantes WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Comprovante não encontrado' });
  res.json({ ...row, insercoes: JSON.parse(row.insercoes) });
});

app.post('/api/comprovantes', requireAuth, async (req, res) => {
  const { anunciante, comercial, dataInicio, dataFim, insercoes, responsavelNome, responsavelCargo } = req.body || {};
  if (!anunciante || !comercial || !dataInicio || !dataFim || !Array.isArray(insercoes) || !insercoes.length || !responsavelNome || !responsavelCargo) {
    return res.status(400).json({ error: 'Preencha anunciante, comercial, período, ao menos uma inserção e o responsável' });
  }
  const info = await db.run(
    'INSERT INTO comprovantes (anunciante, comercial, data_inicio, data_fim, insercoes, responsavel_nome, responsavel_cargo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
    [anunciante, comercial, dataInicio, dataFim, JSON.stringify(insercoes), responsavelNome, responsavelCargo]
  );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.delete('/api/comprovantes/:id', requireAuth, async (req, res) => {
  const info = await db.run('DELETE FROM comprovantes WHERE id = ?', [req.params.id]);
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
    if (/\.(png|jpe?g|webp|svg|gif|ico|mp4|webm)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`AG FM site rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao conectar/inicializar o banco de dados:', err);
    process.exit(1);
  });
