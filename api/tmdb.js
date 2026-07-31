// /api/tmdb.js
// Função serverless (Vercel). Fica FORA do bundle enviado ao navegador,
// então a variável de ambiente TMDB_API_KEY nunca aparece no front-end.
//
// Como usar no front-end (script.js):
//   fetch(`/api/tmdb?path=trending/all/week&language=pt-BR`)
// em vez de:
//   fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=CHAVE&language=pt-BR`)
//
// Configuração necessária na Vercel:
//   Project Settings -> Environment Variables -> TMDB_API_KEY = sua chave da TMDB
//   (não precisa do prefixo NEXT_PUBLIC_ nem VITE_ — isso exporia a chave ao cliente)

export default async function handler(req, res) {
  const { path, ...resto } = req.query;

  if (!path) {
    res.status(400).json({ erro: "Parâmetro 'path' é obrigatório, ex: path=movie/top_rated" });
    return;
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(500).json({ erro: "TMDB_API_KEY não configurada no servidor" });
    return;
  }

  const params = new URLSearchParams(resto);
  params.set("api_key", apiKey);

  const url = `https://api.themoviedb.org/3/${path}?${params.toString()}`;

  try {
    const respostaTmdb = await fetch(url);
    const dados = await respostaTmdb.json();

    // cache leve na CDN da Vercel pra aliviar chamadas repetidas (opcional)
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(respostaTmdb.status).json(dados);
  } catch (erro) {
    res.status(500).json({ erro: "Falha ao buscar dados da TMDB" });
  }
}