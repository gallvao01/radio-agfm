# AG FM 99,9 — Site

Site institucional da Rádio AG FM 99,9 (União dos Palmares/Alagoas), com player de rádio ao vivo, notícias dinâmicas e painel administrativo para publicar/editar/remover conteúdo.

## Como rodar

```
npm install
npm start
```

O site sobe em `http://localhost:5174` (porta configurável via variável de ambiente `PORT`).

## Estrutura
- `server/index.js` — servidor Express (API); serve estáticos **somente** a partir de `public/`
- `server/db.js` — banco de dados SQLite (`data/agfm.db`, criado automaticamente) e conteúdo inicial (seed)
- `public/` — tudo que é acessível pelo navegador:
  - `index.html`, `categoria.html` — carregam as notícias dinamicamente via `js/news.js`
  - `admin.html` + `js/admin.js` + `css/admin.css` — painel administrativo (login, criar/editar/excluir notícias, ver visualizações/cliques, trocar senha)
  - `programacao.html`, `quem-somos.html`, `nossa-historia.html`, `expediente.html`, `contato.html`, `termos-de-uso.html`, `politica-de-privacidade.html` — páginas institucionais
  - `assets/img/logo.png` — logo da rádio (em alta resolução)
- `data/`, `.env.admin`, `package.json` e o próprio `server/` ficam **fora** de `public/` — não são acessíveis via HTTP (correção de segurança: antes o servidor expunha o banco de dados e o código-fonte para qualquer pessoa que soubesse a URL)

## Painel administrativo (login externo)

Acesse **`/admin.html`** (link "Área restrita" no rodapé de qualquer página).

- **Usuário:** `admin`
- **Senha inicial:** `AGFM@2026`

⚠️ Troque a senha assim que possível pelo botão "Trocar senha" dentro do painel.

No painel é possível:
- Criar, editar e excluir notícias (título, resumo, conteúdo completo, categoria, imagem e destaque na home)
- Filtrar notícias por categoria
- Trocar a senha de acesso

Todo o conteúdo de notícias do site (home, páginas de categoria) é lido diretamente do banco de dados — qualquer alteração feita no painel aparece no site imediatamente, sem precisar editar arquivos.

## Conteúdo já preenchido

As notícias de Alagoas e União dos Palmares (incluindo sobre o prefeito Júnior Menezes) foram pesquisadas e cadastradas no banco com base em fontes públicas (portal oficial da Prefeitura, Alagoas 24 Horas). Você pode editar, atualizar ou remover qualquer uma pelo painel.

### Imagens das notícias

Ordem de prioridade para a imagem de cada notícia:
1. **Foto real e verificável** do assunto/local exato (fonte oficial ou Wikimedia Commons — sempre confirmando que o lugar/pessoa/símbolo é mesmo o correto, não só um resultado de busca parecido).
2. Se não existir foto real verificável, uma **imagem gerada por IA**, realista e coerente com o tema (via `image.pollinations.ai`, sem necessidade de login). Toda notícia com imagem de IA recebe automaticamente um selo "IA" na miniatura e uma legenda de aviso na página do artigo — isso é feito pelo `js/news.js` com base no sufixo `-ia.jpg` no nome do arquivo, então ao adicionar uma nova imagem gerada por IA pelo painel, nomeie o arquivo terminando em `-ia` (ex: `nome-do-assunto-ia.jpg`).

Nunca usar uma foto real de um lugar/pessoa diferente do que a notícia descreve, mesmo que pareça parecida — é preferível uma imagem de IA claramente sinalizada a uma foto real só que do lugar errado.

## Métricas por notícia

Cada notícia acumula **visualizações** (quando a página da matéria é aberta) e **cliques** (quando o link é clicado em qualquer lugar do site — home, categoria, destaque, mais ouvidas). Os números aparecem na tabela do painel admin, em `/admin.html`.

## Curadoria automática (planejada)

Existe um endpoint protegido (`POST /api/ingest/news`, exige o header `X-Ingest-Token` igual à variável de ambiente `INGEST_TOKEN`) e uma coluna `source_url` no banco para permitir, no futuro, publicar matérias **originais** da AGFM inspiradas em pautas de outros portais (nunca cópia literal), sem duplicar a mesma pauta duas vezes. Ainda não está agendado — depende do site estar publicado com domínio público, já que a automação roda na nuvem e não alcança `localhost`.

## Pendências

1. **Grade de programação completa** (`programacao.html`) — só tem o programa "União Rural" (José Oriel, domingos 6h) confirmado via Instagram.
2. **Dados institucionais do Expediente** — CNPJ, responsável legal, etc.
3. **Revisão jurídica** dos textos de Termos de Uso e Política de Privacidade (atualmente são textos-modelo genéricos).
4. ~~**Domínio e hospedagem**~~ — **concluído em 2026-07-23**: site em produção em [radioagfmnews.com.br](https://radioagfmnews.com.br) via Hostinger Web Apps (Node.js 24.x).
