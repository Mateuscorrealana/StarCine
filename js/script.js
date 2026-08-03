/* Código completo com correção: avaliações e perfil por usuário (evita reutilizar dados de outra conta)
   Mantém as melhorias de robustez e performance aplicadas antes.
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5B2Q9q1vpSJYMAwhl3MNLAnz8EIfoamo",
  authDomain: "starcine-d29ea.firebaseapp.com",
  projectId: "starcine-d29ea",
  storageBucket: "starcine-d29ea.firebasestorage.app",
  messagingSenderId: "875320488841",
  appId: "1:875320488841:web:dd1f2442b0b5526c7ea758",
  measurementId: "G-3Z8HF8B86K"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

document.addEventListener("DOMContentLoaded", () => {

  const TMDB_BASE = "/api/tmdb";

  const grid = document.getElementById("grid-catalogo");
  const inputBusca = document.querySelector(".header__search-input");
  const contadorTitulos = document.getElementById("contadorTitulos");
  const botoesFiltro = document.querySelectorAll(".filtro");
  const selectGenero = document.getElementById("selectGenero");
  const selectOrdem = document.getElementById("selectOrdem");
  const btnMenuMobile = document.getElementById("btnMenuMobile");
  const headerMenu = document.getElementById("headerMenu");
  const logoReload = document.getElementById("logoReload");
  const btnIrParaPerfil = document.getElementById("btnIrParaPerfil");
  const imgPrincipal = document.getElementById("imgPrincipal");
  const dots = document.querySelectorAll("#dots span");
  const btnNext = document.getElementById("btnNext");
  const btnPrev = document.getElementById("btnPrev");
  const modal = document.getElementById("modal");
  const modalOverlay = document.getElementById("modalOverlay");
  const modalFechar = document.getElementById("modalFechar");
  const modalPoster = document.getElementById("modalPoster");
  const modalTitulo = document.getElementById("modalTitulo");
  const modalMeta = document.getElementById("modalMeta");
  const modalDescricao = document.getElementById("modalDescricao");
  const estrelasContainer = document.getElementById("estrelas");
  const modalComentario = document.getElementById("modalComentario");
  const btnSalvarAvaliacao = document.getElementById("btnSalvarAvaliacao");
  const modalSalvoMsg = document.getElementById("modalSalvoMsg");
  const explorarCarrossel = document.getElementById("explorarCarrossel");
  const explorarPrev = document.getElementById("explorarPrev");
  const explorarNext = document.getElementById("explorarNext");

  // BASE keys (agora usaremos chaves por usuário: base + "__" + encodedEmail)
  const CHAVE_AVALIACOES_BASE = "starcine_avaliacoes";
  const CHAVE_USUARIO = "starcine_usuario";
  const CHAVE_PERFIL_BASE = "starcine_perfil";

  let itemAberto = null;
  let notaSelecionada = 0;

  let listaAtual = [];
  let filtroTipoAtual = "todo";
  let generosMovie = {};
  let generosTV = {};
  let timeout = null;
  let indiceAtual = 0;

  const imagensBanner = [
    "/img-principal/img-principal.png",
    "/img-principal/img-principal2.png",
    "/img-principal/img-principal3.png",
    "/img-principal/img-principal4.png",
  ];

  // Caches locais
  let avaliacoesCache = null; // carregadas para o usuário atual
  let usuarioCache = null;
  let perfilCache = null;

  // Helper para gerar chave final com base no usuário (email)
  function storageKeyFor(base) {
    const usuario = carregarUsuario();
    if (usuario && usuario.email) {
      // encodeURIComponent para evitar caracteres inválidos na chave
      return `${base}__${encodeURIComponent(usuario.email)}`;
    }
    // fallback (anônimo)
    return `${base}__ANON`;
  }

  // --- Usuário ---
  function carregarUsuario() {
    if (usuarioCache !== null) return usuarioCache;
    try {
      usuarioCache = JSON.parse(localStorage.getItem(CHAVE_USUARIO));
    } catch {
      usuarioCache = null;
    }
    return usuarioCache;
  }

  function salvarUsuario(usuario) {
    try {
      localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
      usuarioCache = usuario;
      // reset caches dependentes do usuário
      avaliacoesCache = null;
      perfilCache = null;
    } catch (err) {
      console.error("Erro ao salvar usuário:", err);
    }
  }

  // --- Perfil por usuário ---
  function carregarPerfilLocal() {
    if (perfilCache !== null) return perfilCache;
    try {
      const key = storageKeyFor(CHAVE_PERFIL_BASE);
      perfilCache = JSON.parse(localStorage.getItem(key));
    } catch {
      perfilCache = null;
    }
    return perfilCache;
  }
  function salvarPerfilLocal(perfil) {
    try {
      const key = storageKeyFor(CHAVE_PERFIL_BASE);
      localStorage.setItem(key, JSON.stringify(perfil));
      perfilCache = perfil;
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
    }
  }

  // --- Avaliações por usuário ---
  function carregarAvaliacoes() {
    if (avaliacoesCache !== null) return avaliacoesCache;
    try {
      const key = storageKeyFor(CHAVE_AVALIACOES_BASE);
      avaliacoesCache = JSON.parse(localStorage.getItem(key)) || [];
      // Fallback simples: se não existir e houver uma chave global antiga, migrar (opcional)
      if ((!avaliacoesCache || avaliacoesCache.length === 0) && localStorage.getItem(CHAVE_AVALIACOES_BASE)) {
        try {
          const global = JSON.parse(localStorage.getItem(CHAVE_AVALIACOES_BASE));
          if (Array.isArray(global) && usuarioCache && usuarioCache.email) {
            // migrar para a chave do usuário atual
            localStorage.setItem(key, JSON.stringify(global));
            avaliacoesCache = global;
          }
        } catch { /* ignore */ }
      }
    } catch {
      avaliacoesCache = [];
    }
    return avaliacoesCache;
  }

  function salvarAvaliacoes(lista) {
    try {
      const key = storageKeyFor(CHAVE_AVALIACOES_BASE);
      localStorage.setItem(key, JSON.stringify(lista));
      avaliacoesCache = lista;
    } catch (err) {
      console.error("Erro ao salvar avaliações:", err);
    }
  }

  function buscarAvaliacaoExistente(id, tipo) {
    const arr = carregarAvaliacoes();
    return arr.find(a => a.id === id && a.tipo === tipo);
  }

  // --- TMDB fetch centralizado com timeout ---
  async function fetchTmdb(path, params = {}, timeoutMs = 10000) {
    try {
      const url = new URL(TMDB_BASE, location.origin);
      url.searchParams.set("path", path);
      for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key) && params[key] !== undefined) {
          url.searchParams.set(key, params[key]);
        }
      }

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) {
        let text;
        try { text = await res.text(); } catch { text = res.statusText; }
        throw new Error(`TMDB fetch falhou: ${res.status} ${res.statusText} - ${text}`);
      }
      return await res.json();
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("A requisição para TMDB expirou (timeout).");
      }
      throw err;
    }
  }

  // --- Gêneros helper ---
  function nomesGenerosDoItem(item, tipo) {
    const mapa = tipo === "serie" ? generosTV : generosMovie;
    return (item.genre_ids || []).map(id => mapa[id]).filter(Boolean);
  }

  // --- Estrelas UI ---
  function pintarEstrelas(nota) {
    if (!estrelasContainer) return;
    const estrelas = estrelasContainer.querySelectorAll("span");
    estrelas.forEach(estrela => {
      const valor = Number(estrela.dataset.valor || 0);
      estrela.classList.toggle("preenchida", valor <= nota);
    });
  }

  if (estrelasContainer) {
    estrelasContainer.querySelectorAll("span").forEach(estrela => {
      estrela.addEventListener("click", () => {
        notaSelecionada = Number(estrela.dataset.valor || 0);
        pintarEstrelas(notaSelecionada);
      });
      estrela.addEventListener("mouseenter", () => {
        pintarEstrelas(Number(estrela.dataset.valor || 0));
      });
    });

    estrelasContainer.addEventListener("mouseleave", () => {
      pintarEstrelas(notaSelecionada);
    });
  }

  if (btnSalvarAvaliacao) {
    btnSalvarAvaliacao.addEventListener("click", () => {
      if (!itemAberto) return;

      if (notaSelecionada === 0) {
        if (modalSalvoMsg) {
          modalSalvoMsg.textContent = "Escolha de 1 a 5 estrelas antes de salvar.";
          modalSalvoMsg.style.color = "#e07a7a";
        }
        return;
      }

      const avaliacoes = carregarAvaliacoes();
      const existente = avaliacoes.findIndex(a => a.id === itemAberto.id && a.tipo === itemAberto.tipo);

      const registro = {
        id: itemAberto.id,
        tipo: itemAberto.tipo,
        nome: itemAberto.nome,
        poster: itemAberto.poster,
        nota: notaSelecionada,
        comentario: modalComentario ? modalComentario.value.trim() : "",
        data: new Date().toISOString()
      };

      if (existente >= 0) {
        avaliacoes[existente] = registro;
      } else {
        avaliacoes.push(registro);
      }

      salvarAvaliacoes(avaliacoes);
      if (modalSalvoMsg) {
        modalSalvoMsg.style.color = "#6fcf6f";
        modalSalvoMsg.textContent = "Avaliação salva no seu perfil!";
      }
    });
  }

  // --- Modal ---
  async function abrirModal(id, tipo) {
    if (!modal) return;
    try {
      const endpoint = tipo === "serie" ? "tv" : "movie";
      const item = await fetchTmdb(`${endpoint}/${id}`, { language: "pt-BR" });

      const nome = item.title || item.name || "Sem título";
      const ano = (item.release_date || item.first_air_date || "").slice(0, 4);
      const generos = (item.genres || []).map(g => g.name).join(", ");

      if (modalPoster) {
        modalPoster.src = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "/img/no-poster.png";
        modalPoster.alt = nome;
      }
      if (modalTitulo) modalTitulo.textContent = nome;
      if (modalMeta) modalMeta.textContent = `${ano} • ${generos} • ★ ${(item.vote_average || 0).toFixed(1)}`;
      if (modalDescricao) modalDescricao.textContent = item.overview || "Sem descrição disponível.";

      itemAberto = { id, tipo, nome, poster: item.poster_path };

      const existente = buscarAvaliacaoExistente(id, tipo);
      notaSelecionada = existente ? existente.nota : 0;
      if (modalComentario) modalComentario.value = existente ? existente.comentario : "";
      if (modalSalvoMsg) modalSalvoMsg.textContent = "";
      pintarEstrelas(notaSelecionada);

      modal.classList.add("ativo");

      try {
        const focoEl = modal.querySelector("button, [tabindex], input, textarea");
        if (focoEl) focoEl.focus();
      } catch (err) { /* ignore */ }
    } catch (err) {
      console.error("Erro ao abrir modal:", err);
      if (modalDescricao) modalDescricao.textContent = "Erro ao carregar detalhes. Tente novamente.";
      if (modal) modal.classList.add("ativo");
    }
  }

  function fecharModal() {
    if (!modal) return;
    modal.classList.remove("ativo");
  }

  if (modalOverlay) modalOverlay.addEventListener("click", fecharModal);
  if (modalFechar) modalFechar.addEventListener("click", fecharModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("ativo")) {
      fecharModal();
    }
  });

  // --- Busca / catálogo ---
  async function carregarPopulares() {
    try {
      const dados = await fetchTmdb("trending/all/week", { language: "pt-BR" });
      listaAtual = (dados.results || []).filter(item => item.media_type !== "person");
      aplicarFiltros();
    } catch (err) {
      console.error("Erro ao carregar populares:", err);
      listaAtual = [];
      aplicarFiltros();
    }
  }

  async function buscar(termo) {
    try {
      if (!termo) { await carregarPopulares(); return; }
      const dados = await fetchTmdb("search/multi", { language: "pt-BR", query: termo });
      listaAtual = (dados.results || []).filter(item => item.media_type !== "person");
      aplicarFiltros();
    } catch (err) {
      console.error("Erro na busca:", err);
      listaAtual = [];
      aplicarFiltros();
    }
  }

  function aplicarFiltros() {
    let lista = [...listaAtual];

    if (filtroTipoAtual !== "todo") {
      lista = lista.filter(item => {
        const tipo = item.media_type === "tv" ? "serie" : "filme";
        return tipo === filtroTipoAtual;
      });
    }

    const generoSelecionado = selectGenero ? selectGenero.value : "todos";
    if (generoSelecionado !== "todos") {
      lista = lista.filter(item => {
        const tipo = item.media_type === "tv" ? "serie" : "filme";
        return nomesGenerosDoItem(item, tipo).includes(generoSelecionado);
      });
    }

    const ordem = selectOrdem ? selectOrdem.value : "";
    if (ordem === "recentes") {
      lista.sort((a, b) => new Date(b.release_date || b.first_air_date || 0) - new Date(a.release_date || a.first_air_date || 0));
    } else if (ordem === "antigos") {
      lista.sort((a, b) => new Date(a.release_date || a.first_air_date || 0) - new Date(b.release_date || b.first_air_date || 0));
    } else if (ordem === "avaliados") {
      lista.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    }

    lista = lista.filter(item => item.poster_path);
    renderizarCards(lista);

    if (contadorTitulos) {
      const n = lista.length;
      contadorTitulos.textContent = `${n} Título${n === 1 ? "" : "s"}`;
    }
  }

  function criarCardDOM(item) {
    const tipo = item.media_type === "tv" ? "serie" : "filme";
    const nome = item.title || item.name || "";
    const ano = (item.release_date || item.first_air_date || "").slice(0, 4);

    const card = document.createElement("div");
    card.className = "card";

    const posterWrap = document.createElement("div");
    posterWrap.className = "card__poster-wrap";

    const img = document.createElement("img");
    img.className = "card__poster";
    img.loading = "lazy";
    img.src = item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : "/img/no-poster.png";
    img.alt = nome;

    const selo = document.createElement("span");
    selo.className = "card__selo";
    selo.textContent = tipo === "serie" ? "SÉRIE" : "FILME";

    posterWrap.appendChild(img);
    posterWrap.appendChild(selo);

    const info = document.createElement("div");
    info.className = "card__info";

    const tituloP = document.createElement("p");
    tituloP.className = "card__titulo";
    tituloP.textContent = nome;

    const metaP = document.createElement("p");
    metaP.className = "card__meta";
    metaP.textContent = ano;

    const notaP = document.createElement("p");
    notaP.className = "card__nota";
    notaP.textContent = `★ ${(item.vote_average || 0).toFixed(1)}`;

    info.appendChild(tituloP);
    info.appendChild(metaP);
    info.appendChild(notaP);

    card.appendChild(posterWrap);
    card.appendChild(info);

    card.addEventListener("click", () => abrirModal(item.id, tipo));
    return card;
  }

  function renderizarCards(lista) {
    if (!grid) return;
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const item of lista) {
      try {
        frag.appendChild(criarCardDOM(item));
      } catch (err) {
        console.error("Erro ao renderizar card:", err, item);
      }
    }
    grid.appendChild(frag);
  }

  const iconeBusca = document.querySelector(".header__search-icon");

  function executarBusca() {
    const termo = inputBusca ? inputBusca.value.trim() : "";
    if (termo.length > 0) {
      buscar(termo);
    } else {
      carregarPopulares();
    }
  }

  function debounceFn(fn, wait) {
    return (...args) => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      timeout = setTimeout(() => {
        timeout = null;
        fn(...args);
      }, wait);
    };
  }

  if (inputBusca) {
    inputBusca.addEventListener("input", debounceFn(() => {
      const termo = inputBusca.value.trim();
      if (termo.length > 2) buscar(termo);
      else carregarPopulares();
    }, 400));

    inputBusca.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        executarBusca();
      }
    });
  }

  if (iconeBusca) {
    iconeBusca.addEventListener("click", () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      executarBusca();
    });
  }

  async function carregarGeneros() {
    try {
      const [dMovie, dTV] = await Promise.all([
        fetchTmdb("genre/movie/list", { language: "pt-BR" }),
        fetchTmdb("genre/tv/list", { language: "pt-BR" })
      ]);

      (dMovie.genres || []).forEach(g => { generosMovie[g.id] = g.name; });
      (dTV.genres || []).forEach(g => { generosTV[g.id] = g.name; });

      if (!selectGenero) return;

      const nomesUnicos = [...new Set([
        ...Object.values(generosMovie),
        ...Object.values(generosTV)
      ])].sort();

      selectGenero.innerHTML = "";
      const optAll = document.createElement("option");
      optAll.value = "todos";
      optAll.textContent = "Todos";
      selectGenero.appendChild(optAll);

      nomesUnicos.forEach(nome => {
        const opt = document.createElement("option");
        opt.value = nome;
        opt.textContent = nome;
        selectGenero.appendChild(opt);
      });
    } catch (erro) {
      console.error("Erro ao carregar gêneros:", erro);
    }
  }

  async function carregarExplorar() {
    if (!explorarCarrossel) return;
    try {
      const dados = await fetchTmdb("movie/top_rated", { language: "pt-BR" });
      const lista = (dados.results || []).filter(item => item.poster_path);
      renderizarExplorar(lista);
    } catch (err) {
      console.error("Erro ao carregar explorar:", err);
      explorarCarrossel.innerHTML = "";
    }
  }

  function renderizarExplorar(lista) {
    if (!explorarCarrossel) return;
    explorarCarrossel.innerHTML = "";
    const frag = document.createDocumentFragment();
    lista.forEach(item => {
      const tipo = "filme";
      const nome = item.title || "";
      const ano = (item.release_date || "").slice(0, 4);

      const card = document.createElement("div");
      card.className = "card";

      const posterWrap = document.createElement("div");
      posterWrap.className = "card__poster-wrap";

      const img = document.createElement("img");
      img.className = "card__poster";
      img.loading = "lazy";
      img.src = item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : "/img/no-poster.png";
      img.alt = nome;

      const selo = document.createElement("span");
      selo.className = "card__selo";
      selo.textContent = "FILME";

      posterWrap.appendChild(img);
      posterWrap.appendChild(selo);

      const info = document.createElement("div");
      info.className = "card__info";

      const tituloP = document.createElement("p");
      tituloP.className = "card__titulo";
      tituloP.textContent = nome;

      const metaP = document.createElement("p");
      metaP.className = "card__meta";
      metaP.textContent = ano;

      const notaP = document.createElement("p");
      notaP.className = "card__nota";
      notaP.textContent = `★ ${(item.vote_average || 0).toFixed(1)}`;

      info.append(tituloP, metaP, notaP);
      card.append(posterWrap, info);

      card.addEventListener("click", () => abrirModal(item.id, tipo));
      frag.appendChild(card);
    });

    explorarCarrossel.appendChild(frag);
  }

  if (explorarNext) {
    explorarNext.addEventListener("click", () => {
      explorarCarrossel.scrollBy({ left: 620, behavior: "smooth" });
    });
  }
  if (explorarPrev) {
    explorarPrev.addEventListener("click", () => {
      explorarCarrossel.scrollBy({ left: -620, behavior: "smooth" });
    });
  }

  botoesFiltro.forEach(botao => {
    botao.addEventListener("click", () => {
      botoesFiltro.forEach(b => b.classList.remove("filtro--ativo"));
      botao.classList.add("filtro--ativo");
      filtroTipoAtual = botao.dataset.filtro || "todo";
      aplicarFiltros();
    });
  });

  if (selectGenero) selectGenero.addEventListener("change", aplicarFiltros);
  if (selectOrdem) selectOrdem.addEventListener("change", aplicarFiltros);

  if (logoReload) {
    logoReload.addEventListener("click", () => {
      if (inputBusca && inputBusca.value.trim().length > 0) {
        inputBusca.value = "";
        carregarPopulares();
      } else {
        location.reload();
      }
    });
  }

  function fecharMenuMobile() {
    if (headerMenu) headerMenu.classList.remove("aberto");
    if (btnMenuMobile) {
      btnMenuMobile.classList.remove("aberto");
      btnMenuMobile.setAttribute("aria-expanded", "false");
    }
  }

  if (btnMenuMobile && headerMenu) {
    btnMenuMobile.addEventListener("click", () => {
      const abrindo = !headerMenu.classList.contains("aberto");
      headerMenu.classList.toggle("aberto", abrindo);
      btnMenuMobile.classList.toggle("aberto", abrindo);
      btnMenuMobile.setAttribute("aria-expanded", String(abrindo));
    });

    document.addEventListener("click", (e) => {
      if (!headerMenu.contains(e.target) && !btnMenuMobile.contains(e.target)) {
        fecharMenuMobile();
      }
    });
  }

  if (btnIrParaPerfil) {
    btnIrParaPerfil.addEventListener("click", () => {
      window.location.href = "/pages/editar.html";
    });
  }

  imagensBanner.forEach(src => {
    const preCarga = new Image();
    preCarga.src = src;
  });

  let trocandoSlide = false;

  function mostrarSlide(indice) {
    if (!imgPrincipal || trocandoSlide) return;
    trocandoSlide = true;

    imgPrincipal.classList.add("card-principal__img--trocando");
    setTimeout(() => {
      imgPrincipal.src = imagensBanner[indice];
      imgPrincipal.classList.remove("card-principal__img--trocando");
      trocandoSlide = false;
    }, 150);

    dots.forEach(dot => dot.classList.remove("active"));
    if (dots[indice]) dots[indice].classList.add("active");
    indiceAtual = indice;
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      const proximo = (indiceAtual + 1) % imagensBanner.length;
      mostrarSlide(proximo);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      const anterior = (indiceAtual - 1 + imagensBanner.length) % imagensBanner.length;
      mostrarSlide(anterior);
    });
  }

  dots.forEach(dot => {
    dot.addEventListener("click", () => {
      mostrarSlide(Number(dot.dataset.index || 0));
    });
  });

  const btnVoltarTopo = document.getElementById("btnVoltarTopo");
  if (btnVoltarTopo) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 400) btnVoltarTopo.classList.add("visivel");
      else btnVoltarTopo.classList.remove("visivel");
    });

    btnVoltarTopo.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const GOOGLE_CLIENT_ID = "938643209629-plb7sdmh52qkuosl8hqnscfvu5u7kjdb.apps.googleusercontent.com";

  const headerUser = document.getElementById("headerUser");
  const userAvatar = document.getElementById("userAvatar");
  const userNomeEl = document.getElementById("userNome");

  function atualizarHeaderUsuario() {
    const usuario = carregarUsuario();
    if (usuario) {
      const perfil = carregarPerfilLocal();
      const fotoParaMostrar = (perfil && perfil.fotoManual && perfil.foto) ? perfil.foto : usuario.foto;
      const nomeParaMostrar = (perfil && perfil.nomeManual && perfil.nome) ? perfil.nome : (usuario.nomeEditado || usuario.primeiroNome);

      if (userAvatar) {
        userAvatar.src = fotoParaMostrar;
        userAvatar.classList.add("header__user-img--logado");
      }
      if (userNomeEl) userNomeEl.textContent = nomeParaMostrar;
    } else {
      if (userAvatar) {
        userAvatar.src = "/svgs/user-icon.svg";
        userAvatar.classList.remove("header__user-img--logado");
      }
      if (userNomeEl) userNomeEl.textContent = "";
      fecharDropdownUsuario();
    }
  }

  function decodificarJwt(token) {
    try {
      const payloadBase64 = token.split(".")[1];
      const payloadJson = decodeURIComponent(
        atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"))
          .split("")
          .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join("")
      );
      return JSON.parse(payloadJson);
    } catch (err) {
      console.error("Erro ao decodificar JWT:", err);
      return {};
    }
  }

  function aoLogarComGoogle(resposta) {
    try {
      const dados = decodificarJwt(resposta.credential);
      const usuarioExistente = carregarUsuario();

      const usuario = {
        primeiroNome: dados.given_name || (dados.name ? dados.name.split(" ")[0] : "Usuário"),
        nomeCompleto: dados.name || "",
        email: dados.email || "",
        foto: dados.picture || "/svgs/user-icon.svg",
        nomeEditado: usuarioExistente ? usuarioExistente.nomeEditado : null
      };

      salvarUsuario(usuario);
      // limpa caches dependentes (garante leitura das chaves do novo usuário)
      avaliacoesCache = null;
      perfilCache = null;

      atualizarHeaderUsuario();

      const modalLoginAtual = document.getElementById("modalLogin");
      if (modalLoginAtual) modalLoginAtual.classList.remove("ativo");
    } catch (err) {
      console.error("Erro no login com Google:", err);
    }
  }

  const modalLogin = document.getElementById("modalLogin");
  const modalLoginOverlay = document.getElementById("modalLoginOverlay");
  const modalLoginFechar = document.getElementById("modalLoginFechar");
  const googleButtonContainer = document.getElementById("googleButtonContainer");
  let googleJaInicializado = false;
  let botaoGoogleJaRenderizado = false;

  function abrirModalLogin() {
    if (modalLogin) modalLogin.classList.add("ativo");

    if (window.google && google.accounts && google.accounts.id) {
      if (!googleJaInicializado) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: aoLogarComGoogle
        });
        googleJaInicializado = true;
      }
      if (!botaoGoogleJaRenderizado && googleButtonContainer) {
        google.accounts.id.renderButton(googleButtonContainer, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "signin_with"
        });
        botaoGoogleJaRenderizado = true;
      }
    } else {
      if (googleButtonContainer) googleButtonContainer.textContent = "Carregando login do Google...";
      setTimeout(abrirModalLogin, 300);
    }
  }

  function fecharModalLogin() {
    if (modalLogin) modalLogin.classList.remove("ativo");
  }

  if (modalLoginOverlay) modalLoginOverlay.addEventListener("click", fecharModalLogin);
  if (modalLoginFechar) modalLoginFechar.addEventListener("click", fecharModalLogin);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalLogin && modalLogin.classList.contains("ativo")) {
      fecharModalLogin();
    }
  });

  const userDropdown = document.getElementById("userDropdown");
  const btnVerPerfil = document.getElementById("btnVerPerfil");
  const btnTrocarConta = document.getElementById("btnTrocarConta");
  const btnSair = document.getElementById("btnSair");

  function fecharDropdownUsuario() {
    if (userDropdown) userDropdown.classList.remove("aberto");
  }
  function abrirDropdownUsuario() {
    if (userDropdown) userDropdown.classList.add("aberto");
  }

  function sairDaConta() {
    try {
      localStorage.removeItem(CHAVE_USUARIO);
      usuarioCache = null;
      // limpamos caches dependentes do usuário atual
      avaliacoesCache = null;
      perfilCache = null;
      // opcional: não removemos dados por completo do localStorage (são por-usuário),
      // apenas limpamos a referência de usuário atual para evitar mistura.
    } catch (err) {
      console.error("Erro ao remover usuário:", err);
    }
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    atualizarHeaderUsuario();
    fecharDropdownUsuario();
  }

  if (btnVerPerfil) {
    btnVerPerfil.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = "/pages/editar.html";
    });
  }

  if (btnSair) {
    btnSair.addEventListener("click", (e) => {
      e.stopPropagation();
      sairDaConta();
    });
  }

  if (btnTrocarConta) {
    btnTrocarConta.addEventListener("click", (e) => {
      e.stopPropagation();
      sairDaConta();
      // abre a tela de login para escolher outra conta
      abrirModalLogin();
    });
  }

  if (headerUser) {
    headerUser.addEventListener("click", (e) => {
      const usuario = carregarUsuario();
      if (usuario) {
        e.stopPropagation();
        if (userDropdown && userDropdown.classList.contains("aberto")) {
          fecharDropdownUsuario();
        } else {
          abrirDropdownUsuario();
        }
      } else {
        abrirModalLogin();
      }
    });

    document.addEventListener("click", (e) => {
      if (!headerUser.contains(e.target)) {
        fecharDropdownUsuario();
      }
    });
  }

  atualizarHeaderUsuario();

  // Inicialização
  carregarGeneros();
  carregarPopulares();
  carregarExplorar();
});