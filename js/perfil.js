document.addEventListener("DOMContentLoaded", () => {

  const CHAVE_AVALIACOES = "starcine_avaliacoes"; // mesma chave usada no script.js da home
  const CHAVE_PERFIL = "starcine_perfil";

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
  const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
  
if (logoHome) {
  logoHome.addEventListener("click", () => {
    window.location.href = "/pages/index.html";
  });
}
  function formatarData(isoOuDate) {
    const d = new Date(isoOuDate);
    return `${String(d.getDate()).padStart(2, "0")} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }

  /* ===== PERFIL (nome, foto, cor do card, data em que criou a conta) =====
     Guardado em "starcine_perfil": { nome, foto (base64), cor, membroDesde (ISO) }
     Na primeira vez que essa página é aberta, a data de "membro desde" é
     gravada e nunca mais muda. */
  function carregarPerfil() {
    let perfil;
    try {
      perfil = JSON.parse(localStorage.getItem(CHAVE_PERFIL));
    } catch {
      perfil = null;
    }

    if (!perfil) {
      perfil = {
        nome: "Usuário",
        foto: null,
        cor: "#1c1a17",
        membroDesde: new Date().toISOString()
      };
      localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfil));
    }

    return perfil;
  }

  function salvarPerfil(perfil) {
    localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfil));
  }

  let perfil = carregarPerfil();

  function aplicarPerfilNaTela() {
    perfilNome.textContent = perfil.nome;
    perfilNomeLista.textContent = perfil.nome;
    perfilMembroDesde.textContent = formatarData(perfil.membroDesde);
    if (perfil.foto) perfilFoto.src = perfil.foto;
    perfilBio.style.background = perfil.cor;
    inputNome.value = perfil.nome;
    inputCor.value = perfil.cor;
  }

  aplicarPerfilNaTela();

  /* ===== TROCAR FOTO DE PERFIL ===== */
  if (btnTrocarFoto) {
    btnTrocarFoto.addEventListener("click", () => inputFoto.click());
  }

  if (inputFoto) {
    inputFoto.addEventListener("change", () => {
      const arquivo = inputFoto.files[0];
      if (!arquivo) return;

      const leitor = new FileReader();
      leitor.onload = () => {
        perfil.foto = leitor.result; // salva a imagem em base64
        salvarPerfil(perfil);
        perfilFoto.src = perfil.foto;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  /* ===== PAINEL DE EDIÇÃO (nome + cor do card) ===== */
  function alternarPainel() {
    painelEditar.classList.toggle("ativo");
  }

  if (btnEditarBio) btnEditarBio.addEventListener("click", alternarPainel);
  if (btnEditarHeader) btnEditarHeader.addEventListener("click", alternarPainel);

  if (btnSalvarPerfil) {
    btnSalvarPerfil.addEventListener("click", () => {
      perfil.nome = inputNome.value.trim() || "Usuário";
      perfil.cor = inputCor.value;
      salvarPerfil(perfil);
      aplicarPerfilNaTela();
      painelEditar.classList.remove("ativo");
    });
  }


  /* ===== AVALIAÇÕES (lidas da mesma chave usada na home) ===== */
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

  function renderizarAvaliacoes() {
    const avaliacoes = carregarAvaliacoes().sort((a, b) => new Date(b.data) - new Date(a.data));

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
        <img class="avaliacao-item__poster" src="https://image.tmdb.org/t/p/w200${av.poster}" alt="${av.nome}">
        <div class="avaliacao-item__corpo">
          <span class="avaliacao-item__estrelas">${"★".repeat(av.nota)}${"☆".repeat(5 - av.nota)}</span>
          <p class="avaliacao-item__titulo">${av.nome}</p>
          <p class="avaliacao-item__comentario">${av.comentario ? av.comentario : "Sem comentário."}</p>
          <button class="avaliacao-item__remover" data-id="${av.id}" data-tipo="${av.tipo}">Remover avaliação</button>
        </div>
        <span class="avaliacao-item__data">${formatarData(av.data)}</span>
      `;
      listaAvaliacoes.appendChild(item);
    });

    listaAvaliacoes.querySelectorAll(".avaliacao-item__remover").forEach(botao => {
      botao.addEventListener("click", () => {
        const id = Number(botao.dataset.id);
        const tipo = botao.dataset.tipo;
        const novaLista = carregarAvaliacoes().filter(a => !(a.id === id && a.tipo === tipo));
        salvarAvaliacoes(novaLista);
        renderizarAvaliacoes();
      });
    });
  }

  renderizarAvaliacoes();

});