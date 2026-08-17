# StarCine 🎬

Plataforma de avaliações de filmes e séries, com catálogo integrado à API do TMDB, login com Google e avaliações salvas por usuário.

**Acesse:** [star-cinee.vercel.app](https://star-cinee.vercel.app)

## Funcionalidades

- Catálogo de filmes e séries com dados em tempo real via TMDB API
- Filtros por tipo (filme/série), gênero e ordenação
- Login com conta Google
- Avaliação por estrelas e comentários, salvos por usuário
- Layout responsivo (desktop e mobile)

## Tecnologias

- **Front-end:** HTML, CSS, JavaScript (módulos ES)
- **Autenticação e banco de dados:** Firebase (Authentication + Firestore)
- **Dados de catálogo:** [TMDB API](https://www.themoviedb.org/documentation/api)
- **Hospedagem:** Vercel, com função serverless (`/api/tmdb.js`) como proxy da TMDB API

## Segurança

- A chave da TMDB API nunca é exposta ao navegador: todas as chamadas passam por uma função serverless (`/api/tmdb.js`), que injeta a chave no servidor a partir de uma variável de ambiente.
- Regras de segurança do Firestore controlam quem pode ler/escrever dados — a autenticação por si só não libera acesso.
- Cabeçalhos de segurança (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) configurados via `vercel.json`.

## Configuração do projeto

### Variáveis de ambiente (Vercel)

| Variável | Descrição |
|---|---|
| `TMDB_API_KEY` | Chave da API do TMDB, usada apenas no back-end (`/api/tmdb.js`) |

> A configuração do Firebase (`firebaseConfig`) é pública por design e fica diretamente no código do front-end — não é um segredo.


## Autores

Desenvolvido por [Mateus Correa](https://github.com/Mateuscorrealana) e [Irivam Junior](https://github.com/silvazZzZ).
