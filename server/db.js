const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'agfm.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    image TEXT NOT NULL,
    category TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  );
`);

const newsCount = db.prepare('SELECT COUNT(*) AS c FROM news').get().c;

if (newsCount === 0) {
  const insert = db.prepare(`
    INSERT INTO news (title, summary, content, image, category, featured, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const img = (file) => `assets/img/news/${file}`;

  const seed = [
    {
      title: 'Prefeito Júnior Menezes pressiona Verde Alagoas por regularização no abastecimento de água em União dos Palmares',
      summary: 'Gestão municipal cobra a concessionária responsável pelo fornecimento de água após moradores de diversos bairros relatarem interrupções constantes no abastecimento.',
      content: 'O prefeito de União dos Palmares, Júnior Menezes (José Iran Menezes da Silva Junior), intensificou as cobranças junto à concessionária Verde Alagoas para que o abastecimento de água seja normalizado em bairros que enfrentam interrupções frequentes no serviço. Júnior Menezes venceu as eleições municipais de 2024 com 23.163 votos, equivalentes a 63,83% dos votos válidos — a maior votação da história do município — ao lado da vice-prefeita Samires Ulisses. Desde então, a atual gestão tem atuado junto a órgãos estaduais e concessionárias para resolver demandas de infraestrutura da cidade.',
      image: img('prefeito-junior-menezes.jpg'),
      category: 'interior',
      featured: 1,
      date: '2026-03-03 10:00:00'
    },
    {
      title: 'Quem é Júnior Menezes, o prefeito de União dos Palmares',
      summary: 'Eleito em 2024 com a maior votação da história do município, Júnior Menezes segue à frente da Prefeitura com foco em saúde, educação e infraestrutura.',
      content: 'Júnior Menezes assumiu a Prefeitura de União dos Palmares após vencer as eleições de 2024 com 63,83% dos votos válidos, o maior percentual já obtido por um prefeito eleito no município. Ao longo da gestão, a Prefeitura tem promovido ações em diversas áreas, como mutirões de saúde, reformas de escolas, inauguração de novas unidades básicas de saúde e eventos culturais e sociais voltados à população.',
      image: img('prefeito-junior-menezes.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-07-10 09:00:00'
    },
    {
      title: 'PM prende suspeitos e desarticula esquema de troca de produtos por drogas na rodoviária de União dos Palmares',
      summary: 'Guarnição do 13º Batalhão de Polícia Militar prendeu dois indivíduos em flagrante durante operação na região da rodoviária.',
      content: 'A guarnição motorizada Guardiã-01, do 13º Batalhão de Polícia Militar, prendeu em flagrante dois indivíduos suspeitos de participar de um esquema de troca de produtos por drogas na região da rodoviária de União dos Palmares. A ação desarticulou a atividade ilícita e os envolvidos foram encaminhados à delegacia.',
      image: img('policia.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-07-08 14:00:00'
    },
    {
      title: 'Acidente grave entre Branquinha e União dos Palmares deixa vítima fatal na BR-104',
      summary: 'Colisão entre uma carreta de leite e um automóvel interditou parcialmente a rodovia federal.',
      content: 'Um acidente grave envolvendo uma carreta de transporte de leite e um automóvel deixou uma vítima fatal no trecho da BR-104 entre os municípios de Branquinha e União dos Palmares. O Corpo de Bombeiros foi acionado para atender a ocorrência e a rodovia chegou a ser parcialmente interditada durante o atendimento.',
      image: img('rodovia.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-07-05 08:00:00'
    },
    {
      title: 'União dos Palmares celebra o Dia das Mães com festa na Praça Basiliano de Sarmento',
      summary: 'Evento reuniu centenas de famílias com música e programação especial organizada pela Prefeitura.',
      content: 'A Prefeitura de União dos Palmares promoveu uma grande festividade em celebração ao Dia das Mães na Praça Basiliano de Sarmento, reunindo centenas de famílias em uma programação com música ao vivo e atividades para todas as idades.',
      image: img('praca-comemoracao.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-05-04 18:00:00'
    },
    {
      title: 'Caravana "Toque de Assistência com Amor" leva serviços e cidadania ao distrito de Rocha Cavalcante',
      summary: 'Secretaria de Assistência Social levou atendimentos gratuitos à população do distrito, fora da sede do município.',
      content: 'A Secretaria de Assistência Social de União dos Palmares realizou mais uma edição da caravana "Toque de Assistência com Amor", desta vez no distrito de Rocha Cavalcante, oferecendo serviços de cidadania e atendimento social à comunidade local.',
      image: img('escola-rocha-cavalcante.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-04-26 15:00:00'
    },
    {
      title: 'União dos Palmares está entre as 20 redes de ensino do país reconhecidas pelo MEC por educação antirracista',
      summary: 'Reconhecimento nacional destaca o trabalho da rede municipal de ensino na promoção da educação antirracista.',
      content: 'A rede municipal de ensino de União dos Palmares foi reconhecida pelo Ministério da Educação (MEC) como uma das 20 redes do país que mais se destacam na promoção de práticas de educação antirracista, um marco importante para a educação do município.',
      image: img('escola-rocha-cavalcante.jpg'),
      category: 'interior',
      featured: 0,
      date: '2025-11-06 12:00:00'
    },
    {
      title: 'Confira a programação completa do Festival Negritude em União dos Palmares',
      summary: 'Festival celebra duas noites de música, cultura e valorização da ancestralidade no município.',
      content: 'A Prefeitura de União dos Palmares divulgou a programação completa do Festival Negritude, que promete duas noites de música, cultura e celebração da ancestralidade afro-brasileira, com atrações locais e regionais.',
      image: img('zumbi-monumento.jpg'),
      category: 'interior',
      featured: 0,
      date: '2025-11-12 19:00:00'
    },
    {
      title: 'Prefeitura de União dos Palmares intensifica prevenção ao câncer de mama com mutirão de mamografias gratuitas',
      summary: 'Ação da Secretaria de Saúde oferece exames gratuitos à população em campanha de conscientização.',
      content: 'A Secretaria de Saúde de União dos Palmares realizou um mutirão de prevenção ao câncer de mama, disponibilizando exames de mamografia gratuitos à população como parte das ações de conscientização sobre a doença.',
      image: img('mamografia.jpg'),
      category: 'interior',
      featured: 0,
      date: '2025-11-12 09:00:00'
    },
    {
      title: 'Hemoal promove coleta externa de sangue em União dos Palmares',
      summary: 'Coleta foi realizada no Hospital Regional da Mata, incentivando a doação de sangue na região.',
      content: 'O Hemocentro de Alagoas (Hemoal) realizou uma coleta externa de sangue no Hospital Regional da Mata, em União dos Palmares, incentivando a população a contribuir com doações para o banco de sangue do estado.',
      image: img('doacao-sangue.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-06-17 10:00:00'
    },
    {
      title: 'Tragédia no Agreste: adolescente morre em Craíbas após lance durante partida de futebol',
      summary: 'Jovem passou mal durante jogo e não resistiu, causando comoção na cidade do interior alagoano.',
      content: 'Uma tragédia comoveu o município de Craíbas, no Agreste alagoano, após um adolescente passar mal durante uma partida de futebol e não resistir. O caso gerou grande comoção entre moradores da região.',
      image: img('bandeira-alagoas.svg'),
      category: 'interior',
      featured: 0,
      date: '2026-07-01 16:00:00'
    },
    {
      title: 'Cartórios eleitorais de Alagoas iniciam convocação de mesários para as Eleições 2026',
      summary: 'Órgãos eleitorais do estado começam o processo de chamada de mesários para o pleito deste ano.',
      content: 'Os cartórios eleitorais de Alagoas deram início ao processo de convocação de mesários que atuarão nas Eleições 2026, etapa fundamental para a organização da votação no estado.',
      image: img('urna-eletronica.jpg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-13 08:00:00'
    },
    {
      title: 'Kleber Malaquias: ex-PM acusado de participar da morte de empresário vai a júri popular',
      summary: 'Caso que chocou Alagoas terá desfecho em julgamento popular após conclusão das investigações.',
      content: 'O ex-policial militar Kleber Malaquias, acusado de participar da morte de um empresário em Alagoas, foi pronunciado e irá a júri popular. O caso segue em acompanhamento pela Justiça estadual.',
      image: img('justica.png'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-13 08:30:00'
    },
    {
      title: 'Convocados no PSS 2026 iniciam contratação para reforço da Educação de Maceió',
      summary: 'Processo seletivo simplificado avança com a chamada de profissionais para a rede municipal de ensino.',
      content: 'A Prefeitura de Maceió iniciou a etapa de contratação dos profissionais convocados no Processo Seletivo Simplificado (PSS) 2026, reforçando o quadro da rede municipal de Educação para o ano letivo.',
      image: img('maceio-orla.jpg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-13 09:00:00'
    },
    {
      title: 'Julho começa com apenas 2,6% da chuva esperada em Maceió',
      summary: 'Dados apontam déficit expressivo de chuvas no início do mês na capital alagoana.',
      content: 'O mês de julho começou com um déficit expressivo de precipitação em Maceió, registrando apenas 2,6% do volume de chuva esperado para o período, segundo dados meteorológicos.',
      image: img('maceio-orla.jpg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-13 07:00:00'
    },
    {
      title: 'ASA goleia e avança às oitavas de final da Série D',
      summary: 'Clube alagoano tem atuação expressiva e segue vivo na competição nacional.',
      content: 'O Agremiação Sportiva Alagoana (ASA) teve atuação segura e goleou seu adversário, garantindo classificação às oitavas de final da Série D do Campeonato Brasileiro, mantendo viva a esperança de acesso.',
      image: img('asa-escudo.svg'),
      category: 'esportes',
      featured: 0,
      date: '2026-07-13 20:00:00'
    },
    {
      title: '[EXEMPLO] Principais destaques do noticiário nacional',
      summary: 'Espaço reservado para notícias de abrangência nacional — atualize com as manchetes do dia.',
      content: 'Este espaço foi reservado para notícias de abrangência nacional (Brasil). Assim que houver interesse em manchetes específicas, é só pedir para atualizar esta seção com o conteúdo real.',
      image: img('congresso-nacional.jpg'),
      category: 'brasil',
      featured: 0,
      date: '2025-01-01 00:00:00'
    }
  ];

  seed.forEach((n) => {
    insert.run(n.title, n.summary, n.content, n.image, n.category, n.featured, n.date);
  });
}

const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admin_users').get().c;
if (adminCount === 0) {
  const defaultPassword = 'AGFM@2026';
  const hash = bcrypt.hashSync(defaultPassword, 10);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('----------------------------------------------------');
  console.log('Usuário admin criado. Login: admin | Senha: AGFM@2026');
  console.log('Troque a senha assim que possível pelo painel /admin.html');
  console.log('----------------------------------------------------');
}

module.exports = db;
