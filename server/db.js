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
      title: 'Após junho cheio de folgas, União dos Palmares terá novo feriado; veja a data',
      summary: 'Feriado municipal em homenagem a Santa Maria Madalena, padroeira da cidade, cai em 22 de julho.',
      content: 'União dos Palmares terá mais um feriado municipal no calendário: o dia 22 de julho, dedicado a Santa Maria Madalena, padroeira da cidade, com base na Lei Municipal nº 1.182/2010. Embora a festa social tradicional em homenagem à santa ocorra em fevereiro, a festividade religiosa é celebrada em julho, quando as celebrações movimentam o município ao longo do mês, com peregrinação da imagem da padroeira por comunidades urbanas e rurais, além de missas, novenas e procissões organizadas pela paróquia local. Repartições públicas municipais suspendem o expediente na data, enquanto o funcionamento do comércio pode variar conforme cada estabelecimento.',
      image: img('praca-comemoracao.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-07-08 17:00:00'
    },
    {
      title: 'Júnior Menezes garante mais 4,5 km de asfalto para União dos Palmares em parceria com Arthur Lira',
      summary: 'Prefeito e deputado federal assinaram ordem de serviço para pavimentação de vias urbanas com investimento de R$ 1,5 milhão.',
      content: 'O prefeito Júnior Menezes e o deputado federal Arthur Lira assinaram ordem de serviço para a pavimentação de mais de 4,5 quilômetros de vias urbanas em União dos Palmares, com investimento de R$ 1,5 milhão viabilizado pelo parlamentar por meio da Codevasf. A parceria integra uma estratégia de ampliação dos investimentos em mobilidade urbana no município, que já recebeu pavimentação em bairros como COHAB Velha, COHAB Nova, Alto do Cruzeiro, Vaquejada, Robertão, Morada das Árvores e Jaguaribe por meio de parcerias anteriores com o governador Paulo Dantas. Na mesma ocasião, Arthur Lira também participou da entrega de veículos para a prefeitura, incluindo uma caminhonete adquirida com recursos viabilizados pelo deputado.',
      image: img('rodovia.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-06-26 14:00:00'
    },
    {
      title: 'Projeto "Encontro com Palmares" une ancestralidade e realidade virtual em itinerância por seis estados do Brasil',
      summary: 'Iniciativa foi lançada na Serra da Barriga, em União dos Palmares, e percorre comunidades quilombolas até março de 2027.',
      content: '"Encontro com Palmares" é um projeto de intercâmbio cultural que combina saberes afro-brasileiros com tecnologia audiovisual, tendo como elemento central a "Sala de Saberes Petrobras", espaço imersivo com óculos de realidade virtual 360° que permite explorar digitalmente a Serra da Barriga. O projeto foi lançado em 26 de junho de 2026 no Parque Memorial Quilombo dos Palmares, em União dos Palmares, com programação gratuita que incluiu oficinas, apresentações artísticas e a peça teatral "Em Busca de Palmares". A caravana percorrerá comunidades quilombolas no Pará, Maranhão, Minas Gerais, São Paulo e Rio Grande do Sul entre junho de 2026 e março de 2027, com oficinas de dança afro, percussão, ervas medicinais, culinária quilombola e rodas de conversa com lideranças locais.',
      image: img('zumbi-monumento.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-06-26 19:00:00'
    },
    {
      title: 'Pesquisa Ápice: gestão de Júnior Menezes atinge 93,7% de aprovação em União dos Palmares',
      summary: 'Levantamento do Instituto Ápice mostra o maior índice de aprovação do prefeito desde o início do mandato.',
      content: 'Uma pesquisa do Instituto Ápice apontou que a gestão do prefeito Júnior Menezes atingiu 93,7% de aprovação entre os moradores de União dos Palmares, o maior índice registrado até o momento. Alguns bairros chegaram a 100% de aprovação, enquanto o menor percentual registrado foi de 84,5%. Estudos anteriores dos institutos Ibrape e Falpe já apontavam tendência semelhante de alta. Com quase 18 meses de mandato, o prefeito mantém o capital político da vitória eleitoral de 2024, e moradores ouvidos pela pesquisa destacaram a proximidade do prefeito com a população e a comunicação direta como pontos fortes da gestão.',
      image: img('escola-rocha-cavalcante.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-05-21 12:00:00'
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
      title: 'Pesquisa Paraná Pesquisas: JHC lidera disputa pelo governo de Alagoas em empate técnico com Renan Filho',
      summary: 'Levantamento encomendado pela TV Pajuçara mostra JHC (PSDB) à frente, mas dentro da margem de erro nos cenários estimulados de 1º e 2º turno.',
      content: 'Uma pesquisa do instituto Paraná Pesquisas, registrada no TSE sob o número AL-04491/2026 e encomendada pela TV Pajuçara, aponta João Henrique Caldas (JHC), do PSDB, na liderança da disputa pelo governo de Alagoas em 2026. No cenário estimulado de primeiro turno, JHC aparece com 45,9% das intenções de voto, contra 41% de Renan Filho (MDB) — uma diferença de 4,9 pontos percentuais que configura empate técnico, já que a margem de erro é de 2,7 pontos. Na simulação de segundo turno entre os dois, o resultado se repete: 47,5% para JHC e 42% para Renan Filho. Na pesquisa espontânea, JHC tem 21,7% e Renan Filho, 16,9%, com 55,3% dos entrevistados sem opinião formada. Para o Senado, no cenário estimulado, aparecem entre os mais citados Alfredo Gaspar (PL) com 40,4%, Arthur Lira (PP) com 39,8% e Renan Calheiros (MDB) com 36,4%. A pesquisa ouviu 1.400 eleitores entre 28 de junho e 1º de julho de 2026, com nível de confiança de 95%.',
      image: img('bandeira-alagoas.svg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-04 11:00:00'
    },
    {
      title: 'JHC renuncia à Prefeitura de Maceió para disputar as eleições estaduais de 2026',
      summary: 'Com a saída do prefeito, o vice Rodrigo Cunha assume o comando da capital alagoana.',
      content: 'O prefeito de Maceió, João Henrique Caldas (JHC), renunciou ao cargo em abril de 2026 para se dedicar à disputa eleitoral deste ano, apontado como possível candidato ao governo de Alagoas ou ao Senado. Com a renúncia, o vice-prefeito Rodrigo Cunha (Podemos) assumiu o comando da Prefeitura de Maceió. JHC deixou o PL, partido em que era presidente estadual, e se filiou ao PSDB para concorrer nas eleições estaduais.',
      image: img('maceio-orla.jpg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-04-04 10:00:00'
    },
    {
      title: 'Calendário eleitoral entra em fase decisiva em julho, com restrições a agentes públicos e convenções partidárias',
      summary: 'Regras eleitorais para as Eleições 2026 se intensificam neste mês, três meses antes do primeiro turno de outubro.',
      content: 'O mês de julho marca o início de uma fase decisiva do calendário das Eleições 2026 em Alagoas. Desde o dia 4 de julho, três meses antes do primeiro turno, entraram em vigor restrições a agentes públicos, incluindo limitações a nomeações, contratações, transferências ou exonerações de servidores, além da obrigatoriedade de remoção de nomes, slogans, símbolos e imagens de autoridades em disputa dos canais oficiais de órgãos públicos. No dia 7 de julho, juízes eleitorais publicaram editais de convocação de mesárias, mesários e apoio logístico para a votação. Entre 20 de julho e 5 de agosto, partidos e federações poderão realizar convenções partidárias para escolher os candidatos a presidente, governador, senador, deputado federal e deputado estadual, além de deliberar sobre coligações nas eleições majoritárias.',
      image: img('urna-eletronica.jpg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-01 09:00:00'
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
