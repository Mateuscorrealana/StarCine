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
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

  const perfilFoto = document.getElementById("perfilFoto");
  const btnTrocarFoto = document.getElementById("btnTrocarFoto");
  const inputFoto = document.getElementById("inputFoto");
  const perfilNome = document.getElementById("perfilNome");
  const perfilNomeLista = document.getElementById("perfilNomeLista");
  const perfilMembroDesde = document.getElementById("perfilMembroDesde");
  const statAvaliacoes = document.getElementById("statAvaliacoes");
  const statMedia = document.getElementById("statMedia");
  const perfilBio = document.getElementById("perfilBio");
  const btnEditarBio = document.getElementById("btnEditarBio");
  const btnEditarHeader = document.getElementById("btnEditarHeader");
  const painelEditar = document.getElementById("painelEditar");
  const inputNome = document.getElementById("inputNome");
  const inputCor = document.getElementById("inputCor");
  const btnSalvarPerfil = document.getElementById("btnSalvarPerfil");
  const listaAvaliacoes = document.getElementById("listaAvaliacoes");
  const logoHome = document.getElementById("logoHome");
  const btnMenuMobile = document.getElementById("btnMenuMobile");
  const headerMenu = document.getElementById("headerMenu");
  const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

  let usuarioAtual = null;
  let perfilAtual = null;

  if (logoHome) {
    logoHome.addEventListener("click", () => {
      window.location.href = "/index.html";
    });
  }

  function formatarData(isoOuDate) {
    const d = new Date(isoOuDate);
    return `${String(d.getDate()).padStart(2, "0")} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
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

  /* ===== LOGIN / DROPDOWN DO USUÁRIO (mesma lógica do script.js) ===== */
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

  function fecharDropdownUsuario() {
    if (userDropdown) userDropdown.classList.remove("aberto");
  }

  function abrirDropdownUsuario() {
    if (userDropdown) userDropdown.classList.add("aberto");
  }

  if (btnVerPerfil) {
    btnVerPerfil.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharDropdownUsuario();
    });
  }

  if (btnSair) {
    btnSair.addEventListener("click", async (e) => {
      e.stopPropagation();
      await signOut(auth);
      fecharDropdownUsuario();
      window.location.href = "/index.html";
    });
  }

  if (btnTrocarConta) {
    btnTrocarConta.addEventListener("click", async (e) => {
      e.stopPropagation();
      fecharDropdownUsuario();
      await signOut(auth);
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

  /* ===== REDIMENSIONAR FOTO ANTES DE SALVAR =====
     Encolhe a imagem pra no máximo 300px no lado maior antes de converter
     pra base64 — mantém o documento do Firestore pequeno (limite de 1MB
     por documento) e o upload rápido. */
  function redimensionarImagem(arquivo, tamanhoMax = 300, qualidade = 0.82) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > tamanhoMax) {
            height = Math.round(height * (tamanhoMax / width));
            width = tamanhoMax;
          } else if (height >= width && height > tamanhoMax) {
            width = Math.round(width * (tamanhoMax / height));
            height = tamanhoMax;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", qualidade));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      leitor.onerror = reject;
      leitor.readAsDataURL(arquivo);
    });
  }

  /* ===== PERFIL (Firestore: coleção "usuarios", documento = uid) ===== */
  async function buscarOuCriarPerfil(user) {
    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return { ref, dados: snap.data() };
    }

    const novo = {
      nome: user.displayName || "Usuário",
      foto: user.photoURL || "/svgs/user-icon.svg",
      cor: "#1c1a17",
      email: user.email || "",
      nomeManual: false,
      fotoManual: false,
      membroDesde: new Date().toISOString()
    };
    await setDoc(ref, novo);
    return { ref, dados: novo };
  }

  function aplicarPerfilNaTela(perfil) {
    perfilNome.textContent = perfil.nome;
    perfilNomeLista.textContent = perfil.nome;
    perfilMembroDesde.textContent = formatarData(perfil.membroDesde);
    if (perfil.foto) perfilFoto.src = perfil.foto;
    perfilBio.style.background = perfil.cor;
    inputNome.value = perfil.nome;
    inputCor.value = perfil.cor;

    if (userAvatar) {
      userAvatar.src = perfil.foto || "/svgs/user-icon.svg";
      userAvatar.classList.add("header__user-img--logado");
    }
    if (userNomeEl) userNomeEl.textContent = perfil.nome;
  }

  function mostrarEstadoDeslogado() {
    perfilNome.textContent = "Visitante";
    perfilNomeLista.textContent = "Visitante";
    perfilMembroDesde.textContent = "—";
    perfilFoto.src = "/svgs/user-icon.svg";
    perfilBio.style.background = "#1c1a17";
    statAvaliacoes.textContent = "0";
    statMedia.textContent = "0";
    listaAvaliacoes.innerHTML = `<p class="perfil-avaliacoes__vazio">Faça login pra ver e salvar suas avaliações.</p>`;

    if (userAvatar) {
      userAvatar.src = "/svgs/user-icon.svg";
      userAvatar.classList.remove("header__user-img--logado");
    }
    if (userNomeEl) userNomeEl.textContent = "";
  }

  /* ===== TROCAR FOTO DE PERFIL ===== */
  if (btnTrocarFoto) {
    btnTrocarFoto.addEventListener("click", () => {
      if (!usuarioAtual) {
        abrirModalLogin();
        return;
      }
      inputFoto.click();
    });
  }

  if (inputFoto) {
    inputFoto.addEventListener("change", async () => {
      const arquivo = inputFoto.files[0];
      if (!arquivo || !usuarioAtual) return;

      try {
        const fotoBase64 = await redimensionarImagem(arquivo);
        const ref = doc(db, "usuarios", usuarioAtual.uid);
        perfilAtual = { ...perfilAtual, foto: fotoBase64, fotoManual: true };
        await setDoc(ref, perfilAtual, { merge: true });
        aplicarPerfilNaTela(perfilAtual);
      } catch (erro) {
        console.error("Erro ao trocar foto:", erro);
      }
    });
  }

  /* ===== PAINEL DE EDIÇÃO (nome + cor do card) ===== */
  function alternarPainel() {
    if (!usuarioAtual) {
      abrirModalLogin();
      return;
    }
    painelEditar.classList.toggle("ativo");
  }

  if (btnEditarBio) btnEditarBio.addEventListener("click", alternarPainel);
  if (btnEditarHeader) btnEditarHeader.addEventListener("click", alternarPainel);

  if (btnSalvarPerfil) {
    btnSalvarPerfil.addEventListener("click", async () => {
      if (!usuarioAtual) return;

      const ref = doc(db, "usuarios", usuarioAtual.uid);
      perfilAtual = {
        ...perfilAtual,
        nome: inputNome.value.trim() || "Usuário",
        cor: inputCor.value,
        nomeManual: true
      };

      try {
        await setDoc(ref, perfilAtual, { merge: true });
        aplicarPerfilNaTela(perfilAtual);
        painelEditar.classList.remove("ativo");
      } catch (erro) {
        console.error("Erro ao salvar perfil:", erro);
      }
    });
  }

  /* ===== AVALIAÇÕES (Firestore: coleção "avaliacoes", filtradas por uid) ===== */
  async function carregarAvaliacoes(uid) {
    const q = query(collection(db, "avaliacoes"), where("uid", "==", uid));
    const snap = await getDocs(q);
    const lista = [];
    snap.forEach(docSnap => lista.push({ id: docSnap.id, ...docSnap.data() }));
    return lista.sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  async function renderizarAvaliacoes() {
    if (!usuarioAtual) return;

    const avaliacoes = await carregarAvaliacoes(usuarioAtual.uid);

    statAvaliacoes.textContent = avaliacoes.length;

    if (avaliacoes.length === 0) {
      statMedia.textContent = "0";
      listaAvaliacoes.innerHTML = `<p class="perfil-avaliacoes__vazio">Você ainda não avaliou nenhum filme ou série.</p>`;
      return;
    }

    const media = avaliacoes.reduce((soma, a) => soma + a.nota, 0) / avaliacoes.length;
    statMedia.textContent = media.toFixed(1);

    listaAvaliacoes.innerHTML = "";
    avaliacoes.forEach(av => {
      const item = document.createElement("div");
      item.className = "avaliacao-item";
      item.innerHTML = `
        <img class="avaliacao-item__poster" src="https://image.tmdb.org/t/p/w200${av.poster}" alt="${av.nome}" loading="lazy">
        <div class="avaliacao-item__corpo">
          <span class="avaliacao-item__estrelas">${"★".repeat(av.nota)}${"☆".repeat(5 - av.nota)}</span>
          <p class="avaliacao-item__titulo">${av.nome}</p>
          <p class="avaliacao-item__comentario">${av.comentario ? av.comentario : "Sem comentário."}</p>
          <button class="avaliacao-item__remover" data-doc-id="${av.id}">Remover avaliação</button>
        </div>
        <span class="avaliacao-item__data">${formatarData(av.data)}</span>
      `;
      listaAvaliacoes.appendChild(item);
    });

    listaAvaliacoes.querySelectorAll(".avaliacao-item__remover").forEach(botao => {
      botao.addEventListener("click", async () => {
        const docId = botao.dataset.docId;
        try {
          await deleteDoc(doc(db, "avaliacoes", docId));
          renderizarAvaliacoes();
        } catch (erro) {
          console.error("Erro ao remover avaliação:", erro);
        }
      });
    });
  }

  /* ===== ESTADO DE LOGIN (Firebase Authentication) ===== */
  onAuthStateChanged(auth, async (user) => {
    usuarioAtual = user;

    if (!user) {
      perfilAtual = null;
      mostrarEstadoDeslogado();
      return;
    }

    try {
      const { dados } = await buscarOuCriarPerfil(user);
      perfilAtual = dados;
      aplicarPerfilNaTela(perfilAtual);
      renderizarAvaliacoes();
    } catch (erro) {
      console.error("Erro ao carregar perfil:", erro);
    }
  });

});