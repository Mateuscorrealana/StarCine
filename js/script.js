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

  // A chamada agora vai para a SUA função serverless (/api/tmdb),
  // que guarda a chave da TMDB no servidor (variável de ambiente
  // TMDB_API_KEY). O navegador nunca vê a chave — dá pra conferir
  // na aba Rede do inspecionar: só aparece "/api/tmdb?...".
  const TMDB_BASE = "/api/tmdb";

  const grid = document.getElementById("grid-catalogo");
  const inputBusca = document.querySelector(".header__search-input");
  const contadorTitulos = document.getElementById("contadorTitulos");
  const botoesFiltro = document.querySelectorAll(".filtro");
  const selectGenero = document.getElementById("selectGenero");
  const selectOrdem = document.getElementById("selectOrdem");
  /* ===== MENU HAMBÚRGUER (mobile) ===== */
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

  const CHAVE_AVALIACOES = "starcine_avaliacoes";
  let itemAberto = null;   // { id, tipo, nome, poster } do item atual no modal
  let notaSelecionada = 0;

  let listaAtual = [];       // últimos resultados crus vindos da API
  let filtroTipoAtual = "todo"; // todo | filme | serie
  let generosMovie = {};     // { id: nome } - gêneros de filme
  let generosTV = {};        // { id: nome } - gêneros de série
  let timeout;
  let indiceAtual = 0;

  const imagensBanner = [
    "/img-principal/img-principal.png",
    "/img-principal/img-principal2.png",
    "/img-principal/img-principal3.png",
    "/img-principal/img-principal4.png",
  ];

  /* ===== GÊNEROS (popula o select) ===== */
  async function carregarGeneros() {
    try {
      const [rMovie, rTV] = await Promise.all([
        fetch(`${TMDB_BASE}?path=genre/movie/list&language=pt-BR`),
        fetch(`${TMDB_BASE}?path=genre/tv/list&language=pt-BR`)
      ]);
      const dMovie = await rMovie.json();
      const dTV = await rTV.json();

      dMovie.genres.forEach(g => generosMovie[g.id] = g.name);
      dTV.genres.forEach(g => generosTV[g.id] = g.name);

      const nomesUnicos = [...new Set([...Object.values(generosMovie), ...Object.values(generosTV)])].sort();

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

  function nomesGenerosDoItem(item, tipo) {
    const mapa = tipo === "serie" ? generosTV : generosMovie;
    return (item.genre_ids || []).map(id => mapa[id]).filter(Boolean);
  }

  /* ===== AVALIAÇÕES (localStorage) =====
     Guardadas em "starcine_avaliacoes" como um array de objetos:
     { id, tipo, nome, poster, nota, comentario, data }
     Sua futura página de perfil pode ler essa mesma chave do localStorage. */
  function carregarAvaliacoes() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_AVALIACOES)) || [];
    } catch {
      return [];
    }
  }

  function salvarAvaliacoes(lista) {
    localStorage.setItem(CHAVE_AVALIACOES, JSON.stringify(lista));
  }

  function buscarAvaliacaoExistente(id, tipo) {
    return carregarAvaliacoes().find(a => a.id === id && a.tipo === tipo);
  }

  function pintarEstrelas(nota) {
    if (!estrelasContainer) return;
    const estrelas = estrelasContainer.querySelectorAll("span");
    estrelas.forEach(estrela => {
      const valor = Number(estrela.dataset.valor);
      estrela.classList.toggle("preenchida", valor <= nota);
    });
  }

  if (estrelasContainer) {
    estrelasContainer.querySelectorAll("span").forEach(estrela => {
      estrela.addEventListener("click", () => {
        notaSelecionada = Number(estrela.dataset.valor);
        pintarEstrelas(notaSelecionada);
      });
      estrela.addEventListener("mouseenter", () => {
        pintarEstrelas(Number(estrela.dataset.valor));
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
        modalSalvoMsg.textContent = "Escolha de 1 a 5 estrelas antes de salvar.";
        modalSalvoMsg.style.color = "#e07a7a";
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
        comentario: modalComentario.value.trim(),
        data: new Date().toISOString()
      };

      if (existente >= 0) {
        avaliacoes[existente] = registro;
      } else {
        avaliacoes.push(registro);
      }

      salvarAvaliacoes(avaliacoes);
      modalSalvoMsg.style.color = "#6fcf6f";
      modalSalvoMsg.textContent = "Avaliação salva no seu perfil!";
    });
  }

  /* ===== MODAL DE DETALHES ===== */
  async function abrirModal(id, tipo) {
    const endpoint = tipo === "serie" ? "tv" : "movie";
    const url = `${TMDB_BASE}?path=${endpoint}/${id}&language=pt-BR`;
    const resposta = await fetch(url);
    const item = await resposta.json();

    const nome = item.title || item.name;
    const ano = (item.release_date || item.first_air_date || "").slice(0, 4);
    const generos = item.genres.map(g => g.name).join(", ");

    modalPoster.src = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
    modalPoster.alt = nome;
    modalTitulo.textContent = nome;
    modalMeta.textContent = `${ano} • ${generos} • ★ ${item.vote_average.toFixed(1)}`;
    modalDescricao.textContent = item.overview || "Sem descrição disponível.";

    itemAberto = { id, tipo, nome, poster: item.poster_path };

    // se já existe avaliação salva desse item, preenche de volta
    const existente = buscarAvaliacaoExistente(id, tipo);
    notaSelecionada = existente ? existente.nota : 0;
    if (modalComentario) modalComentario.value = existente ? existente.comentario : "";
    if (modalSalvoMsg) modalSalvoMsg.textContent = "";
    pintarEstrelas(notaSelecionada);

    modal.classList.add("ativo");
  }

  function fecharModal() {
    modal.classList.remove("ativo");
  }

  if (modalOverlay) modalOverlay.addEventListener("click", fecharModal);
  if (modalFechar) modalFechar.addEventListener("click", fecharModal);

  // Fecha o modal ao apertar Esc
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("ativo")) {
      fecharModal();
    }
  });

  /* ===== BUSCA / CATÁLOGO ===== */
  async function carregarPopulares() {
    const url = `${TMDB_BASE}?path=trending/all/week&language=pt-BR`;
    const resposta = await fetch(url);
    const dados = await resposta.json();
    listaAtual = dados.results.filter(item => item.media_type !== "person");
    aplicarFiltros();
  }

  async function buscar(termo) {
    const url = `${TMDB_BASE}?path=search/multi&language=pt-BR&query=${encodeURIComponent(termo)}`;
    const resposta = await fetch(url);
    const dados = await resposta.json();
    listaAtual = dados.results.filter(item => item.media_type !== "person");
    aplicarFiltros();
  }

  /* Aplica filtro de tipo (todo/filme/serie), gênero e ordenação sobre listaAtual,
     depois renderiza e atualiza o contador de títulos */
  function aplicarFiltros() {
    let lista = [...listaAtual];

    if (filtroTipoAtual !== "todo") {
      lista = lista.filter(item => {
        const tipo = item.media_type === "tv" ? "serie" : "filme";
        return tipo === filtroTipoAtual;
      });
    }

    const generoSelecionado = selectGenero.value;
    if (generoSelecionado !== "todos") {
      lista = lista.filter(item => {
        const tipo = item.media_type === "tv" ? "serie" : "filme";
        return nomesGenerosDoItem(item, tipo).includes(generoSelecionado);
      });
    }

    const ordem = selectOrdem.value;
    if (ordem === "recentes") {
      lista.sort((a, b) => new Date(b.release_date || b.first_air_date || 0) - new Date(a.release_date || a.first_air_date || 0));
    } else if (ordem === "antigos") {
      lista.sort((a, b) => new Date(a.release_date || a.first_air_date || 0) - new Date(b.release_date || b.first_air_date || 0));
    } else if (ordem === "avaliados") {
      lista.sort((a, b) => b.vote_average - a.vote_average);
    }

    // remove itens sem poster ANTES de contar, senão o contador conta um item
    // que depois não vira card nenhum
    lista = lista.filter(item => item.poster_path);

    renderizarCards(lista);

    if (contadorTitulos) {
      contadorTitulos.textContent = `${lista.length} Título${lista.length === 1 ? "" : "s"}`;
    }
  }

  function renderizarCards(lista) {
    grid.innerHTML = "";
    lista.forEach(item => {
      const tipo = item.media_type === "tv" ? "serie" : "filme";
      const nome = item.title || item.name;
      const ano = (item.release_date || item.first_air_date || "").slice(0, 4);

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card__poster-wrap">
          <img class="card__poster" src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${nome}" loading="lazy">
          <span class="card__selo">${tipo === "serie" ? "SÉRIE" : "FILME"}</span>
        </div>
        <div class="card__info">
          <p class="card__titulo">${nome}</p>
          <p class="card__meta">${ano}</p>
          <p class="card__nota">★ ${item.vote_average.toFixed(1)}</p>
        </div>
      `;

      card.addEventListener("click", () => abrirModal(item.id, tipo));
      grid.appendChild(card);
    });
  }

  /* ===== BUSCA: digitação (debounce), clique na lupa e Enter ===== */
  const iconeBusca = document.querySelector(".header__search-icon");

  function executarBusca() {
    const termo = inputBusca.value.trim();
    if (termo.length > 0) {
      buscar(termo);
    } else {
      carregarPopulares();
    }
  }

  if (inputBusca) {
    inputBusca.addEventListener("input", () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const termo = inputBusca.value.trim();
        if (termo.length > 2) buscar(termo);
        else carregarPopulares();
      }, 400);
    });

    inputBusca.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        clearTimeout(timeout);
        executarBusca();
      }
    });
  }

  if (iconeBusca) {
    iconeBusca.addEventListener("click", () => {
      clearTimeout(timeout);
      executarBusca();
    });
  }

  carregarGeneros();
  carregarPopulares();
  carregarExplorar();

  /* ===== EXPLORAR FILMES E SÉRIES (carrossel) ===== */
  async function carregarExplorar() {
    if (!explorarCarrossel) return;
    const url = `${TMDB_BASE}?path=movie/top_rated&language=pt-BR`;
    const resposta = await fetch(url);
    const dados = await resposta.json();
    const lista = dados.results.filter(item => item.poster_path);
    renderizarExplorar(lista);
  }

  function renderizarExplorar(lista) {
    explorarCarrossel.innerHTML = "";
    lista.forEach(item => {
      const tipo = "filme";
      const nome = item.title;
      const ano = (item.release_date || "").slice(0, 4);

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card__poster-wrap">
          <img class="card__poster" src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${nome}" loading="lazy">
          <span class="card__selo">FILME</span>
        </div>
        <div class="card__info">
          <p class="card__titulo">${nome}</p>
          <p class="card__meta">${ano}</p>
          <p class="card__nota">★ ${item.vote_average.toFixed(1)}</p>
        </div>
      `;

      card.addEventListener("click", () => abrirModal(item.id, tipo));
      explorarCarrossel.appendChild(card);
    });
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

  /* ===== FILTROS (Todo / Filmes / Séries) ===== */
  botoesFiltro.forEach(botao => {
    botao.addEventListener("click", () => {
      botoesFiltro.forEach(b => b.classList.remove("filtro--ativo"));
      botao.classList.add("filtro--ativo");
      filtroTipoAtual = botao.dataset.filtro;
      aplicarFiltros();
    });
  });

  /* ===== SELECTS DE GÊNERO E ORDENAÇÃO ===== */
  if (selectGenero) selectGenero.addEventListener("change", aplicarFiltros);
  if (selectOrdem) selectOrdem.addEventListener("change", aplicarFiltros);

  /* ===== LOGO: se tiver busca, apaga; senão recarrega a página (F5) ===== */
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

  /* ===== MENU HAMBÚRGUER (mobile): abre/fecha o painel com busca + editar perfil ===== */
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

    // fecha o menu se clicar fora dele
    document.addEventListener("click", (e) => {
      if (!headerMenu.contains(e.target) && !btnMenuMobile.contains(e.target)) {
        fecharMenuMobile();
      }
    });
  }

  /* ===== BOTÃO "EDITAR PERFIL" LEVA ATÉ A PÁGINA DE PERFIL ===== */
  if (btnIrParaPerfil) {
    btnIrParaPerfil.addEventListener("click", () => {
      window.location.href = "/pages/editar.html";
    });
  }

  /* ===== CARROSSEL DO BANNER PRINCIPAL =====
     As 4 imagens são pré-carregadas assim que a página abre, então quando
     o usuário clica em prev/next elas já estão em cache — sem espera pra
     baixar. A troca usa um fade suave (opacidade) em vez de trocar o src
     "a seco", que causava aquele salto/travada perceptível. */
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
      mostrarSlide(Number(dot.dataset.index));
    });
  });

  /* ===== BOTÃO VOLTAR AO TOPO ===== */
  const btnVoltarTopo = document.getElementById("btnVoltarTopo");

  if (btnVoltarTopo) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 400) {
        btnVoltarTopo.classList.add("visivel");
      } else {
        btnVoltarTopo.classList.remove("visivel");
      }
    });

    btnVoltarTopo.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ===== LOGIN COM GOOGLE =====
     Guarda o usuário logado em "starcine_usuario":
     { primeiroNome, nomeCompleto, email, foto, nomeEditado }
     "nomeEditado" fica null até o usuário mudar o nome na página de perfil;
     enquanto for null, mostramos o primeiro nome vindo do Google. */
  const GOOGLE_CLIENT_ID = "938643209629-plb7sdmh52qkuosl8hqnscfvu5u7kjdb.apps.googleusercontent.com";
  const CHAVE_USUARIO = "starcine_usuario";
  const CHAVE_PERFIL = "starcine_perfil"; // mesma chave usada no perfil.js

  function carregarPerfilLocal() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_PERFIL));
    } catch {
      return null;
    }
  }

  const headerUser = document.getElementById("headerUser");
  const userAvatar = document.getElementById("userAvatar");
  const userNomeEl = document.getElementById("userNome");

  function carregarUsuario() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_USUARIO));
    } catch {
      return null;
    }
  }

  function salvarUsuario(usuario) {
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
  }

  function atualizarHeaderUsuario() {
    const usuario = carregarUsuario();
    if (usuario) {
      const perfil = carregarPerfilLocal();
      const fotoParaMostrar = (perfil && perfil.fotoManual && perfil.foto) ? perfil.foto : usuario.foto;
      const nomeParaMostrar = (perfil && perfil.nomeManual && perfil.nome) ? perfil.nome : (usuario.nomeEditado || usuario.primeiroNome);

      userAvatar.src = fotoParaMostrar;
      userAvatar.classList.add("header__user-img--logado");
      userNomeEl.textContent = nomeParaMostrar;
    } else {
      userAvatar.src = "/svgs/user-icon.svg";
      userAvatar.classList.remove("header__user-img--logado");
      userNomeEl.textContent = "";
      fecharDropdownUsuario();
    }
  }

  // Decodifica o token JWT que o Google devolve (sem precisar de biblioteca extra)
  function decodificarJwt(token) {
    const payloadBase64 = token.split(".")[1];
    const payloadJson = decodeURIComponent(
      atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(payloadJson);
  }

  function aoLogarComGoogle(resposta) {
    const dados = decodificarJwt(resposta.credential);
    const usuarioExistente = carregarUsuario();

    const usuario = {
      primeiroNome: dados.given_name || (dados.name ? dados.name.split(" ")[0] : "Usuário"),
      nomeCompleto: dados.name || "",
      email: dados.email || "",
      foto: dados.picture || "/svgs/user-icon.svg",
      // preserva qualquer edição manual feita antes na página de perfil
      nomeEditado: usuarioExistente ? usuarioExistente.nomeEditado : null
    };

    salvarUsuario(usuario);
    atualizarHeaderUsuario();

    const modalLoginAtual = document.getElementById("modalLogin");
    if (modalLoginAtual) modalLoginAtual.classList.remove("ativo");
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
      // biblioteca do Google ainda não carregou (rede lenta, bloqueador etc.)
      if (googleButtonContainer) {
        googleButtonContainer.textContent = "Carregando login do Google...";
      }
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

  /* ===== DROPDOWN DO USUÁRIO (Meu perfil / Trocar de conta / Sair) ===== */
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
    localStorage.removeItem(CHAVE_USUARIO);
    // impede que o Google faça login automático de novo com a última conta
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
      // reabre o login pra escolher outra conta — se o navegador tiver mais
      // de uma conta Google logada, o seletor de contas aparece de novo
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

});