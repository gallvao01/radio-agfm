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

  CREATE TABLE IF NOT EXISTS comprovantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anunciante TEXT NOT NULL,
    comercial TEXT NOT NULL,
    data_inicio TEXT NOT NULL,
    data_fim TEXT NOT NULL,
    insercoes TEXT NOT NULL,
    responsavel_nome TEXT NOT NULL,
    responsavel_cargo TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      image: img('prefeitura-up-ia.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-07-10 09:00:00'
    },
    {
      title: 'Carro furtado em União dos Palmares é recuperado após PM descobrir troca de produtos por drogas em Maceió',
      summary: 'Veículo e notebooks roubados de um estabelecimento no interior foram localizados pela polícia na rodoviária da capital.',
      content: 'A guarnição motorizada do 13º Batalhão de Polícia Militar abordou, na madrugada de 7 de julho, um Chevrolet Onix prata sendo conduzido sem habilitação no Terminal Rodoviário de Maceió, no bairro do Feitosa. O motorista confessou ter arrombado um estabelecimento comercial em União dos Palmares e furtado o veículo, dois notebooks e um equipamento de vigilância. Ele revelou ainda ter trocado os computadores por drogas com um comerciante que atuava dentro da própria rodoviária. A polícia recuperou os aparelhos e conduziu os dois suspeitos à Central de Flagrantes: o autor do furto foi autuado por furto qualificado, enquanto o comerciante responderá por receptação.',
      image: img('pm-alagoas-brasao.png'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-08 14:00:00'
    },
    {
      title: 'Identificada vítima de acidente fatal na BR-104, entre Branquinha e União dos Palmares',
      summary: 'Condutor de 22 anos morreu ao colidir de frente com uma carreta carregada de leite no km 47 da rodovia.',
      content: 'Darlan Liberato dos Santos, de 22 anos, empresário do ramo de som automotivo e morador de Murici, morreu em um acidente no km 47 da BR-104, entre os municípios de Branquinha e União dos Palmares. Segundo a Polícia Rodoviária Federal, o Toyota Corolla conduzido por Darlan invadiu a pista contrária e colidiu de frente com uma carreta carregada de leite da empresa Natville. Ele não resistiu aos ferimentos e morreu no local antes de receber atendimento. O motorista da carreta sofreu apenas ferimentos leves. A BR-104 foi totalmente liberada após as 22h, depois da perícia do Instituto de Criminalística, da remoção do corpo pelo IML e da limpeza da pista.',
      image: img('br104-ia.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-02-25 17:00:00'
    },
    {
      title: 'Após junho cheio de folgas, União dos Palmares terá novo feriado; veja a data',
      summary: 'Feriado municipal em homenagem a Santa Maria Madalena, padroeira da cidade, cai em 22 de julho.',
      content: 'União dos Palmares terá mais um feriado municipal no calendário: o dia 22 de julho, dedicado a Santa Maria Madalena, padroeira da cidade, com base na Lei Municipal nº 1.182/2010. Embora a festa social tradicional em homenagem à santa ocorra em fevereiro, a festividade religiosa é celebrada em julho, quando as celebrações movimentam o município ao longo do mês, com peregrinação da imagem da padroeira por comunidades urbanas e rurais, além de missas, novenas e procissões organizadas pela paróquia local. Repartições públicas municipais suspendem o expediente na data, enquanto o funcionamento do comércio pode variar conforme cada estabelecimento.',
      image: img('serra-da-barriga-1.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-07-08 17:00:00'
    },
    {
      title: 'Júnior Menezes garante mais 4,5 km de asfalto para União dos Palmares em parceria com Arthur Lira',
      summary: 'Prefeito e deputado federal assinaram ordem de serviço para pavimentação de vias urbanas com investimento de R$ 1,5 milhão.',
      content: 'O prefeito Júnior Menezes e o deputado federal Arthur Lira assinaram ordem de serviço para a pavimentação de mais de 4,5 quilômetros de vias urbanas em União dos Palmares, com investimento de R$ 1,5 milhão viabilizado pelo parlamentar por meio da Codevasf. A parceria integra uma estratégia de ampliação dos investimentos em mobilidade urbana no município, que já recebeu pavimentação em bairros como COHAB Velha, COHAB Nova, Alto do Cruzeiro, Vaquejada, Robertão, Morada das Árvores e Jaguaribe por meio de parcerias anteriores com o governador Paulo Dantas. Na mesma ocasião, Arthur Lira também participou da entrega de veículos para a prefeitura, incluindo uma caminhonete adquirida com recursos viabilizados pelo deputado.',
      image: img('pavimentacao-ia.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-06-26 14:00:00'
    },
    {
      title: 'Projeto "Encontro com Palmares" une ancestralidade e realidade virtual em itinerância por seis estados do Brasil',
      summary: 'Iniciativa foi lançada na Serra da Barriga, em União dos Palmares, e percorre comunidades quilombolas até março de 2027.',
      content: '"Encontro com Palmares" é um projeto de intercâmbio cultural que combina saberes afro-brasileiros com tecnologia audiovisual, tendo como elemento central a "Sala de Saberes Petrobras", espaço imersivo com óculos de realidade virtual 360° que permite explorar digitalmente a Serra da Barriga. O projeto foi lançado em 26 de junho de 2026 no Parque Memorial Quilombo dos Palmares, em União dos Palmares, com programação gratuita que incluiu oficinas, apresentações artísticas e a peça teatral "Em Busca de Palmares". A caravana percorrerá comunidades quilombolas no Pará, Maranhão, Minas Gerais, São Paulo e Rio Grande do Sul entre junho de 2026 e março de 2027, com oficinas de dança afro, percussão, ervas medicinais, culinária quilombola e rodas de conversa com lideranças locais.',
      image: img('serra-da-barriga-3.jpg'),
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
      title: 'Hemoal promove coleta externa de sangue em União dos Palmares dentro da campanha Junho Vermelho',
      summary: 'Ação itinerante no Hospital Regional da Mata, no bairro Alameda, buscou formar estoque estratégico de sangue para maternidades e hospitais.',
      content: 'O Hemocentro de Alagoas (Hemoal) realizou uma coleta externa de sangue no Hospital Regional da Mata (HRM), no bairro Alameda, em União dos Palmares, das 9h às 16h, como parte da campanha Junho Vermelho. A ação itinerante teve como objetivo formar um estoque estratégico de componentes sanguíneos para atender à demanda transfusional de maternidades e hospitais da região. Para doar, é preciso estar em bom estado de saúde, portar documento de identificação com foto, pesar no mínimo 50 quilos e ter entre 16 e 69 anos.',
      image: img('doacao-sangue.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-06-17 10:00:00'
    },
    {
      title: 'Adolescente de 14 anos morre em Craíbas após passar mal horas depois de sentir dores durante jogo de futebol',
      summary: 'Jovem foi atendido, liberado e passou mal durante a madrugada em casa; caso será esclarecido por necropsia.',
      content: 'José Laelson Nascimento dos Santos, de 14 anos, morreu na madrugada de segunda-feira (13 de julho) em Craíbas, no Agreste alagoano, após passar mal em casa. Segundo relatos de familiares, o adolescente jogava futebol quando sofreu um forte impacto de bola no peito. Ele chegou a ser atendido na Casa Maternal Frei Damião, em Craíbas, e depois foi transferido ao Hospital de Emergência do Agreste (HEA), em Arapiraca, onde foi avaliado, medicado e liberado para casa. Horas depois, seu quadro se agravou e ele passou mal na residência da família; apesar dos esforços para reverter a situação, o óbito foi confirmado em seguida. O corpo foi encaminhado ao Instituto Médico Legal (IML) de Arapiraca, e o laudo da necropsia será fundamental para esclarecer a real causa da morte e se há relação direta com o impacto sofrido durante o jogo.',
      image: img('agreste-alagoas-ia.jpg'),
      category: 'interior',
      featured: 0,
      date: '2026-07-13 10:00:00'
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
      title: 'Calendário eleitoral entra em fase decisiva em julho, com restrições a agentes públicos e convenções partidárias',
      summary: 'Regras eleitorais para as Eleições 2026 se intensificam neste mês, três meses antes do primeiro turno de outubro.',
      content: 'O mês de julho marca o início de uma fase decisiva do calendário das Eleições 2026 em Alagoas. Desde o dia 4 de julho, três meses antes do primeiro turno, entraram em vigor restrições a agentes públicos, incluindo limitações a nomeações, contratações, transferências ou exonerações de servidores, além da obrigatoriedade de remoção de nomes, slogans, símbolos e imagens de autoridades em disputa dos canais oficiais de órgãos públicos. No dia 7 de julho, juízes eleitorais publicaram editais de convocação de mesárias, mesários e apoio logístico para a votação. Entre 20 de julho e 5 de agosto, partidos e federações poderão realizar convenções partidárias para escolher os candidatos a presidente, governador, senador, deputado federal e deputado estadual, além de deliberar sobre coligações nas eleições majoritárias.',
      image: img('tre-al-ia.jpg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-01 09:00:00'
    },
    {
      title: 'Último réu do caso Kleber Malaquias vai a júri popular nesta segunda-feira (20)',
      summary: 'Ex-PM Marcos Maurício Francisco dos Santos é o sexto e último acusado a ser julgado pela morte do empresário e ativista.',
      content: 'O ex-policial militar Marcos Maurício Francisco dos Santos será julgado por júri popular nesta segunda-feira (20 de julho), a partir das 8h, no Fórum Desembargador Jairon Maia Fernandes, em Maceió — o último dos seis réus a ser julgado pela morte do empresário e ativista social Kleber Malaquias, assassinado a tiros dentro de um bar em Rio Largo em 15 de julho de 2020. Segundo o Ministério Público, o crime teve caráter de execução, motivado pelas denúncias públicas que Kleber Malaquias fazia contra esquemas de corrupção envolvendo agentes públicos. Marcos Maurício é acusado de integrar o grupo responsável pelo monitoramento da vítima e pelo repasse de informações aos executores. Os outros quatro réus já foram condenados: os ex-policiais militares Fredson José dos Santos e Marcelo Souza, além de José Mário de Lima Silva e Edinaldo Estevão de Lima.',
      image: img('forum-justica-ia.jpg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-13 08:30:00'
    },
    {
      title: 'Prefeitura de Maceió convoca 650 professores e mais de 600 profissionais de apoio no PSS 2026 da Educação',
      summary: 'Convocados entregam documentação em duas chamadas ao longo de julho, incluindo auxiliares de sala para a Educação Especial.',
      content: 'A Prefeitura de Maceió, por meio da Secretaria Municipal de Educação (Semed), convocou 650 professores aprovados no Processo Seletivo Simplificado (PSS) 2026 para os cargos de Educação Infantil, 1º ao 5º ano, Matemática, Português, História, Ciências, Arte e Geografia. A entrega de documentos e o credenciamento para lotação aconteceram entre os dias 6 e 9 de julho, das 8h às 14h, na Coordenação Geral de Gestão de Pessoas (CGGP), no bairro Cambona. Em uma segunda convocação, a Semed chamou também os Profissionais de Apoio Escolar (PAEs) e auxiliares de sala, com a maior parte das 626 vagas destinada a auxiliares de sala da Educação Especial, com entrega de documentos entre os dias 13 e 16 de julho. Após a validação e escolha da lotação, os contratos são enviados por e-mail para assinatura digital pela plataforma Gov.br.',
      image: img('escola-publica-ia.jpg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-13 09:00:00'
    },
    {
      title: 'Em 13 dias, julho registra apenas 2,66% da chuva esperada em Maceió',
      summary: 'Apesar do déficit expressivo no início do mês, meteorologistas dizem que ainda é cedo para prever se julho fechará abaixo da média.',
      content: 'Maceió registrou até o dia 13 de julho apenas 7,2 milímetros de chuva, o equivalente a 2,66% dos 271 milímetros esperados para todo o mês. Segundo o meteorologista Hugo Carvalho, coordenador do Centro Integrado de Meteorologia e Recursos Hídricos de Alagoas (Cimadec), a quantidade de chuva prevista para um mês não precisa ocorrer de forma uniforme — em alguns anos, boa parte da precipitação mensal se concentra em apenas dois ou três dias, o que torna fundamental o acompanhamento diário do cenário. Para os próximos dias, a previsão indica predomínio de sol, com possibilidade de chuvas isoladas apenas na quarta-feira (15). Não há alertas vigentes emitidos pelo Inmet ou pelo Cemaden para a capital alagoana.',
      image: img('maceio-orla.jpg'),
      category: 'alagoas',
      featured: 0,
      date: '2026-07-13 07:00:00'
    },
    {
      title: 'ASA goleia o Ivinhema-MS por 4 a 0 e avança às oitavas de final da Série D',
      summary: 'Time de Arapiraca fechou o placar agregado em 6 a 1 e vai enfrentar o Cianorte-PR na próxima fase.',
      content: 'O ASA (Agremiação Sportiva Arapiraquense), clube de Arapiraca, venceu o Ivinhema-MS por 4 a 0 no domingo (12 de julho), no Estádio Coaracy da Mata Fonseca, em Arapiraca, e confirmou classificação às oitavas de final da Série D do Campeonato Brasileiro. Como já havia vencido o jogo de ida por 2 a 1, fora de casa, o ASA fechou o placar agregado em 6 a 1. Os gols da vitória foram marcados por Alex Bruno, Higor Leite e Michel Douglas, que balançou as redes duas vezes. Na próxima fase, o ASA enfrenta o Cianorte-PR, que eliminou o XV de Piracicaba-SP.',
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
