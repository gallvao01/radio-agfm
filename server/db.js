const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Banco de dados persistente (MySQL do Hostinger) — ao contrário do antigo arquivo
// SQLite local, este banco NÃO é apagado quando o código é reimplantado via Git.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
});

async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0];
}

async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return { lastInsertRowid: result.insertId, changes: result.affectedRows };
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS news (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content LONGTEXT NOT NULL,
      image TEXT NOT NULL,
      video TEXT,
      gallery TEXT,
      category VARCHAR(50) NOT NULL,
      featured TINYINT NOT NULL DEFAULT 0,
      source_url TEXT,
      source_name VARCHAR(255),
      views INT NOT NULL DEFAULT 0,
      clicks INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ALTER separado porque a tabela news já existe em produção sem a coluna video
  // (CREATE TABLE IF NOT EXISTS não adiciona colunas novas a uma tabela existente).
  try {
    await pool.query('ALTER TABLE news ADD COLUMN video TEXT');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }
  try {
    await pool.query('ALTER TABLE news ADD COLUMN gallery TEXT');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comprovantes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      anunciante VARCHAR(255) NOT NULL,
      comercial VARCHAR(255) NOT NULL,
      data_inicio VARCHAR(50) NOT NULL,
      data_fim VARCHAR(50) NOT NULL,
      insercoes LONGTEXT NOT NULL,
      responsavel_nome VARCHAR(255) NOT NULL,
      responsavel_cargo VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const newsCountRow = await get('SELECT COUNT(*) AS c FROM news');
  if (newsCountRow.c === 0) {
    const img = (file) => `assets/img/news/${file}`;
    const seed = [
      {
        title: 'Júnior Menezes institui comissão para novo concurso público em União dos Palmares',
        summary: 'Portaria publicada em 1º de julho cria comissão especial para planejar concurso da SMTT e da Guarda Civil Municipal.',
        content: 'A Secretaria Municipal Geral de Administração de União dos Palmares formalizou, por meio da Portaria nº 007/2026/SMGA (publicada em 1º de julho de 2026), uma Comissão Especial de Estudos e Planejamento para organizar um novo concurso público municipal. A iniciativa busca preencher cargos efetivos em duas corporações estratégicas: a Superintendência Municipal de Transportes e Trânsito (SMTT) e a Guarda Civil Municipal. A comissão, coordenada pelo secretário-geral de Administração, Adelson Angelo de Andrade, e com participação da Procuradoria Geral, da Controladoria Interna e da Secretaria de Finanças, será responsável por estudos de viabilidade técnica e financeira, definição do número de vagas, elaboração do cronograma e levantamento da documentação necessária para a contratação da banca examinadora.',
        image: img('prefeito-junior-menezes.jpg'),
        category: 'interior',
        featured: 1,
        date: '2026-07-02 10:00:00'
      },
      {
        title: 'Quem é Júnior Menezes, o prefeito de União dos Palmares',
        summary: 'Eleito em 2024 com a maior votação da história do município, Júnior Menezes segue à frente da Prefeitura com foco em saúde, educação e infraestrutura.',
        content: 'Júnior Menezes assumiu a Prefeitura de União dos Palmares após vencer as eleições de 2024 com 63,83% dos votos válidos, o maior percentual já obtido por um prefeito eleito no município. Ao longo da gestão, a Prefeitura tem promovido ações em diversas áreas, como mutirões de saúde, reformas de escolas, inauguração de novas unidades básicas de saúde e eventos culturais e sociais voltados à população.',
        image: img('prefeitura-up-ia.jpg'),
        category: 'interior',
        featured: 0,
        date: '2026-07-10 09:00:00'
      }
    ];

    for (const n of seed) {
      await run(
        'INSERT INTO news (title, summary, content, image, category, featured, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [n.title, n.summary, n.content, n.image, n.category, n.featured, n.date]
      );
    }
  }

  const adminCountRow = await get('SELECT COUNT(*) AS c FROM admin_users');
  if (adminCountRow.c === 0) {
    const defaultPassword = 'AGFM@2026';
    const hash = bcrypt.hashSync(defaultPassword, 10);
    await run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    console.log('----------------------------------------------------');
    console.log('Usuário admin criado. Login: admin | Senha: AGFM@2026');
    console.log('Troque a senha assim que possível pelo painel /admin.html');
    console.log('----------------------------------------------------');
  }
}

module.exports = { get, all, run, init, pool };
