import { auth, db, googleProvider } from "/js/firebase-init.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

  // A chamada vai para a SUA função serverless (/api/tmdb), que guarda a
  // chave da TMDB no servidor (variável de ambiente TMDB_API_KEY). O
  // navegador nunca vê a chave da TMDB.
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

  let itemAberto = null;   // { id, tipo, nome, poster } do item atual no modal
  let notaSelecionada = 0;
  let usuarioAtual = null; // preenchido pelo onAuthStateChanged do Firebase

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

  /* ===== AVALIAÇÕES (Firestore, vinculadas ao usuário logado) =====
     Coleção "avaliacoes", um documento por (usuário + filme/série), com
     ID determinístico "uid_tipo_id" — assim salvar de novo sobre o mesmo
     item atualiza o documento em vez de duplicar. */
  function idAvaliacao(uid, tipo, id) {
    return `${uid}_${tipo}_${id}`;
  }

  async function buscarAvaliacaoExistente(id, tipo) {
    if (!usuarioAtual) return null;
    const ref = doc(db, "avaliacoes", idAvaliacao(usuarioAtual.uid, tipo, id));
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  async function salvarAvaliacao(registro) {
    const ref = doc(db, "avaliacoes", idAvaliacao(usuarioAtual.uid, registro.tipo, registro.id));
    await setDoc(ref, {
      ...registro,
      uid: usuarioAtual.uid,
      data: new Date().toISOString(),
      atualizadoEm: serverTimestamp()
    });
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
    btnSalvarAvaliacao.addEventListener("click", async () => {
      if (!itemAberto) return;

      if (!usuarioAtual) {
        modalSalvoMsg.style.color = "#e07a7a";
        modalSalvoMsg.textContent = "Faça login pra salvar sua avaliação.";
        return;
      }

      if (notaSelecionada === 0) {
        modalSalvoMsg.style.color = "#e07a7a";
        modalSalvoMsg.textContent = "Escolha de 1 a 5 estrelas antes de salvar.";
        return;
      }

      btnSalvarAvaliacao.disabled = true;
      try {
        await salvarAvaliacao({
          id: itemAberto.id,
          tipo: itemAberto.tipo,
          nome: itemAberto.nome,
          poster: itemAberto.poster,
          nota: notaSelecionada,
          comentario: modalComentario.value.trim()
        });
        modalSalvoMsg.style.color = "#6fcf6f";
        modalSalvoMsg.textContent = "Avaliação salva no seu perfil!";
      } catch (erro) {
        console.error("Erro ao salvar avaliação:", erro);
        modalSalvoMsg.style.color = "#e07a7a";
        modalSalvoMsg.textContent = "Não deu pra salvar agora, tenta de novo.";
      } finally {
        btnSalvarAvaliacao.disabled = false;
      }
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

    notaSelecionada = 0;
    if (modalComentario) modalComentario.value = "";
    if (modalSalvoMsg) modalSalvoMsg.textContent = "";
    pintarEstrelas(0);
    modal.classList.add("ativo");

    // busca a avaliação salva (se houver) depois de abrir o modal, sem
    // travar a exibição dos detalhes esperando o Firestore responder
    if (usuarioAtual) {
      const existente = await buscarAvaliacaoExistente(id, tipo);
      if (existente) {
        notaSelecionada = existente.nota;
        if (modalComentario) modalComentario.value = existente.comentario || "";
        pintarEstrelas(notaSelecionada);
      }
    }
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

  /* ===== MENU HAMBÚRGUER (mobile) ===== */
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

  /* ===== CARROSSEL DO BANNER PRINCIPAL ===== */
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

  /* ===== LOGIN COM GOOGLE (Firebase Authentication) =====
     Perfil (nome, foto, cor) fica salvo no Firestore, coleção "usuarios",
     um documento por uid — é o perfil.js que lê/escreve os detalhes; aqui
     no header a gente só precisa saber se tem alguém logado e mostrar o
     nome/foto básicos vindos direto da conta Google. */
  const headerUser = document.getElementById("headerUser");
  const userAvatar = document.getElementById("userAvatar");
  const userNomeEl = document.getElementById("userNome");
  const userDropdown = document.getElementById("userDropdown");
  const btnVerPerfil = document.getElementById("btnVerPerfil");
  const btnTrocarConta = document.getElementById("btnTrocarConta");
  const btnSair = document.getElementById("btnSair");

  const modalLogin = document.getElementById("modalLogin");
  const modalLoginOverlay = document.getElementById("modalLoginOverlay");
  const modalLoginFechar = document.getElementById("modalLoginFechar");
  const btnEntrarGoogle = document.getElementById("btnEntrarGoogle");

  function abrirModalLogin() {
    if (modalLogin) modalLogin.classList.add("ativo");
  }

  function fecharModalLogin() {
    if (modalLogin) modalLogin.classList.remove("ativo");
  }

  async function fazerLoginComGoogle() {
    try {
      await signInWithPopup(auth, googleProvider);
      fecharModalLogin();
    } catch (erro) {
      console.error("Erro no login com Google:", erro);
    }
  }

  if (btnEntrarGoogle) btnEntrarGoogle.addEventListener("click", fazerLoginComGoogle);
  if (modalLoginOverlay) modalLoginOverlay.addEventListener("click", fecharModalLogin);
  if (modalLoginFechar) modalLoginFechar.addEventListener("click", fecharModalLogin);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalLogin && modalLogin.classList.contains("ativo")) {
      fecharModalLogin();
    }
  });

  /* ===== DROPDOWN DO USUÁRIO (Meu perfil / Trocar de conta / Sair) ===== */
  function fecharDropdownUsuario() {
    if (userDropdown) userDropdown.classList.remove("aberto");
  }

  function abrirDropdownUsuario() {
    if (userDropdown) userDropdown.classList.add("aberto");
  }

  if (btnVerPerfil) {
    btnVerPerfil.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = "/pages/editar.html";
    });
  }

  if (btnSair) {
    btnSair.addEventListener("click", async (e) => {
      e.stopPropagation();
      await signOut(auth);
      fecharDropdownUsuario();
    });
  }

  if (btnTrocarConta) {
    btnTrocarConta.addEventListener("click", async (e) => {
      e.stopPropagation();
      fecharDropdownUsuario();
      await signOut(auth);
      // o provider já força o seletor de contas (prompt: "select_account")
      fazerLoginComGoogle();
    });
  }

  if (headerUser) {
    headerUser.addEventListener("click", () => {
      if (usuarioAtual) {
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

  // Busca o perfil salvo no Firestore (nome/foto editados manualmente) pra
  // não mostrar sempre a foto crua do Google se a pessoa já personalizou
  async function buscarPerfilFirestore(uid) {
    try {
      const snap = await getDoc(doc(db, "usuarios", uid));
      return snap.exists() ? snap.data() : null;
    } catch {
      return null;
    }
  }

  onAuthStateChanged(auth, async (user) => {
    usuarioAtual = user;

    if (!user) {
      userAvatar.src = "/svgs/user-icon.svg";
      userAvatar.classList.remove("header__user-img--logado");
      userNomeEl.textContent = "";
      fecharDropdownUsuario();
      return;
    }

    // grava/atualiza os dados básicos do Google no Firestore, sem
    // sobrescrever nome/foto que a pessoa já personalizou no perfil
    const perfilExistente = await buscarPerfilFirestore(user.uid);
    if (!perfilExistente) {
      await setDoc(doc(db, "usuarios", user.uid), {
        nome: user.displayName || "Usuário",
        foto: user.photoURL || "/svgs/user-icon.svg",
        cor: "#1c1a17",
        email: user.email || "",
        nomeManual: false,
        fotoManual: false,
        membroDesde: new Date().toISOString()
      });
    }

    const perfil = perfilExistente || await buscarPerfilFirestore(user.uid);
    userAvatar.src = (perfil && perfil.foto) ? perfil.foto : (user.photoURL || "/svgs/user-icon.svg");
    userAvatar.classList.add("header__user-img--logado");
    userNomeEl.textContent = (perfil && perfil.nome) ? perfil.nome : (user.displayName || "");
  });

});