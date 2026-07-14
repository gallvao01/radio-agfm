const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5174;
const ROOT = path.join(__dirname, '..');

app.use(express.json());
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Não autenticado' });
}

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
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

// ---------- Static site ----------
app.use(express.static(ROOT));

app.listen(PORT, () => {
  console.log(`AG FM site rodando em http://localhost:${PORT}`);
});
