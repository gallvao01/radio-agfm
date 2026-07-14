# AG FM 99,9 — Site

Site institucional da Rádio AG FM 99,9 (União dos Palmares/Alagoas), com player de rádio ao vivo, notícias dinâmicas e painel administrativo para publicar/editar/remover conteúdo.

## Como rodar

```
npm install
npm start
```

O site sobe em `http://localhost:5174` (porta configurável via variável de ambiente `PORT`).

## Estrutura
- `server/index.js` — servidor Express (API + arquivos estáticos)
- `server/db.js` — banco de dados SQLite (`data/agfm.db`, criado automaticamente) e conteúdo inicial (seed)
- `index.html`, `categoria.html` — carregam as notícias dinamicamente via `js/news.js`
- `admin.html` + `js/admin.js` + `css/admin.css` — painel administrativo (login, criar/editar/excluir notícias, trocar senha)
- `programacao.html`, `quem-somos.html`, `nossa-historia.html`, `expediente.html`, `contato.html`, `termos-de-uso.html`, `politica-de-privacidade.html` — páginas institucionais
- `assets/img/logo.png` — logo da rádio (em alta resolução)

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

## Pendências

1. **URL do stream de áudio ao vivo** — arquivo de origem do player (`<source src="https://SUBSTITUIR-PELA-URL-DO-STREAM.com/stream">`), presente em todas as páginas. Será preenchida quando a transmissão da rádio para o site estiver configurada.
2. **Notícias de Brasil** — ainda estão como espaço reservado (`[EXEMPLO]`); é só pedir para atualizar com manchetes reais quando houver interesse. A categoria "Mundo" foi removida a pedido, para focar em Alagoas e União dos Palmares.
3. **Endereço físico** da emissora (`contato.html`, `expediente.html`, rodapé).
4. **E-mail oficial** — atualmente usando placeholder `contato@agfm.com.br`.
5. **Grade de programação completa** (`programacao.html`) — só tem o programa "União Rural" (José Oriel, domingos 6h) confirmado via Instagram.
6. **Dados institucionais do Expediente** — CNPJ, responsável legal, etc.
7. **Revisão jurídica** dos textos de Termos de Uso e Política de Privacidade (atualmente são textos-modelo genéricos).
