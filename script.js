
const modo = document.getElementById("modo");
const marketplace = document.getElementById("marketplace");
const lote = document.getElementById("lote");
const mensagem = document.getElementById("mensagem");
const lista = document.getElementById("lista");
const busca = document.getElementById("busca");
const abrirCamera = document.getElementById("abrirCamera");
const fecharCamera = document.getElementById("fecharCamera");
const areaCamera = document.getElementById("areaCamera");
const baixarLote = document.getElementById("baixarLote");
const operacaoAtual = document.getElementById("operacaoAtual");
const canalAtual = document.getElementById("canalAtual");
const listaVazia = document.getElementById("listaVazia");

let volumes = JSON.parse(localStorage.getItem("bipVolumes") || "[]");
let scanner = null;
let iniciandoCamera = false;
let processandoLeitura = false;

// Impede que o mesmo código seja processado repetidamente
// em vários quadros consecutivos da câmera.
const leiturasRecentes = new Map();
const INTERVALO_ANTI_REPETICAO = 2500;

// Compatibilidade com os registros da versão anterior.
volumes = volumes.map(v => ({
  ...v,
  marketplace: v.marketplace || "Sem categoria",
  lote: v.lote || "Lote antigo"
}));

function salvar() {
  localStorage.setItem("bipVolumes", JSON.stringify(volumes));
}

function avisar(texto, tipo = "neutro") {
  mensagem.textContent = texto;
  mensagem.className = "mensagem";

  if (tipo === "sucesso") {
    mensagem.classList.add("sucesso");
  } else if (tipo === "erro") {
    mensagem.classList.add("erro");
  }
}

function atualizarOperacao() {
  operacaoAtual.textContent = modo.value === "entrada"
    ? "ENTRADA DE VOLUMES"
    : "SAÍDA DE VOLUMES";

  canalAtual.textContent = marketplace.value;

  operacaoAtual.style.color = modo.value === "entrada"
    ? "#42e58b"
    : "#f4b454";
}

function desenhar() {
  document.getElementById("pendentes").textContent =
    volumes.filter(v => v.status === "pendente").length;

  document.getElementById("carregados").textContent =
    volumes.filter(v => v.status === "carregado").length;

  const termo = busca.value.trim().toUpperCase();
  lista.innerHTML = "";

  const filtrados = volumes
    .filter(v =>
      v.codigo.toUpperCase().includes(termo) ||
      v.lote.toUpperCase().includes(termo) ||
      v.marketplace.toUpperCase().includes(termo)
    )
    .slice()
    .reverse();

  listaVazia.hidden = filtrados.length > 0;

  filtrados.forEach(volume => {
    const item = document.createElement("li");
    const info = document.createElement("div");
    const detalhe = document.createElement("div");
    const status = document.createElement("span");
    const acoes = document.createElement("div");
    const excluir = document.createElement("button");

    info.className = "volume-info";
    info.textContent = volume.codigo;

    detalhe.className = "volume-detalhe";
    detalhe.textContent =
      `${volume.marketplace} · Lote: ${volume.lote}`;

    status.className = volume.status === "pendente"
      ? "status status-pendente"
      : "status status-carregado";

    status.textContent = volume.status === "pendente"
      ? "PENDENTE NO BARRACÃO"
      : "CARREGADO";

    excluir.type = "button";
    excluir.className = "btn-excluir";
    excluir.textContent = "Excluir registro";

    excluir.addEventListener("click", () => {
      const confirmar = confirm(
        `Excluir o registro ${volume.codigo}?\n\n` +
        "Isso removerá o registro deste navegador."
      );

      if (!confirmar) return;

      volumes = volumes.filter(v => v.codigo !== volume.codigo);
      salvar();
      desenhar();
      avisar("Registro excluído.", "sucesso");
    });

    acoes.className = "acoes-volume";
    acoes.appendChild(excluir);

    item.append(info, detalhe, status, acoes);
    lista.appendChild(item);
  });
}

function registrarCodigo(codigoLido) {
  const valor = String(codigoLido || "").trim().toUpperCase();
  const canal = marketplace.value;
  const nomeLote = lote.value.trim();

  if (!valor) {
    avisar("Não foi possível ler o código. Tente novamente.", "erro");
    return false;
  }

  if (!nomeLote) {
    avisar("Informe a identificação do lote antes de bipar.", "erro");
    lote.focus();
    return false;
  }

  const existente = volumes.find(v => v.codigo === valor);

  if (modo.value === "entrada") {
    if (existente) {
      avisar(
        `ETIQUETA DUPLICADA: ${valor}. Nenhum novo registro foi criado.`,
        "erro"
      );
      return false;
    }

    volumes.push({
      codigo: valor,
      marketplace: canal,
      lote: nomeLote,
      status: "pendente",
      entrada: new Date().toISOString(),
      saida: null
    });

    salvar();
    desenhar();
    avisar(`ENTRADA REGISTRADA · ${valor}`, "sucesso");
    return true;
  }

  if (!existente) {
    avisar(
      `ETIQUETA NÃO ENCONTRADA: ${valor}. Registre a entrada primeiro.`,
      "erro"
    );
    return false;
  }

  if (existente.status === "carregado") {
    avisar(
      `JÁ CARREGADO: ${valor}. Nenhuma alteração realizada.`,
      "erro"
    );
    return false;
  }

  // A saída individual só baixa a etiqueta reconhecida.
  existente.status = "carregado";
  existente.saida = new Date().toISOString();

  salvar();
  desenhar();
  avisar(`SAÍDA REGISTRADA · ${valor}`, "sucesso");
  return true;
}

function processarLeitura(texto) {
  const valor = String(texto || "").trim().toUpperCase();

  if (!valor || processandoLeitura) return;

  const agora = Date.now();
  const ultimaLeitura = leiturasRecentes.get(valor) || 0;

  // A câmera pode reconhecer o mesmo código em muitos quadros.
  if (agora - ultimaLeitura < INTERVALO_ANTI_REPETICAO) {
    return;
  }

  leiturasRecentes.set(valor, agora);
  processandoLeitura = true;

  try {
    registrarCodigo(valor);
  } catch (erro) {
    console.error("Erro ao registrar código:", erro);
    avisar("Ocorreu um erro ao registrar. Confira os dados.", "erro");
  } finally {
    // Pequena pausa entre leituras para evitar processamento simultâneo.
    setTimeout(() => {
      processandoLeitura = false;
    }, 500);
  }

  // Limita o tamanho do mapa de leituras recentes.
  if (leiturasRecentes.size > 100) {
    for (const [codigo, horario] of leiturasRecentes) {
      if (agora - horario > 30000) {
        leiturasRecentes.delete(codigo);
      }
    }
  }
}

busca.addEventListener("input", desenhar);
modo.addEventListener("change", atualizarOperacao);
marketplace.addEventListener("change", atualizarOperacao);

baixarLote.addEventListener("click", () => {
  const canal = marketplace.value;
  const nomeLote = lote.value.trim();

  if (!nomeLote) {
    avisar("Informe o lote que será carregado.", "erro");
    lote.focus();
    return;
  }

  const pendentes = volumes.filter(v =>
    v.status === "pendente" &&
    v.marketplace === canal &&
    v.lote.toUpperCase() === nomeLote.toUpperCase()
  );

  if (pendentes.length === 0) {
    avisar("Não há volumes pendentes nesse lote.", "erro");
    return;
  }

  const confirmar = confirm(
    `Marketplace: ${canal}\n` +
    `Lote: ${nomeLote}\n` +
    `Volumes pendentes: ${pendentes.length}\n\n` +
    "Confirma que TODOS esses volumes foram carregados?"
  );

  if (!confirmar) return;

  const agora = new Date().toISOString();

  pendentes.forEach(v => {
    v.status = "carregado";
    v.saida = agora;
  });

  salvar();
  desenhar();
  avisar(`${pendentes.length} volumes baixados do lote.`, "sucesso");
});

async function pararCamera() {
  if (scanner) {
    const atual = scanner;
    scanner = null;

    try {
      await atual.stop();
    } catch (erro) {
      console.warn("A câmera já estava parada.", erro);
    }

    try {
      await atual.clear();
    } catch (erro) {
      console.warn("Não foi necessário limpar o leitor.", erro);
    }
  }

  areaCamera.hidden = true;
  abrirCamera.disabled = false;
  iniciandoCamera = false;
  processandoLeitura = false;
}

abrirCamera.addEventListener("click", async () => {
  if (iniciandoCamera || scanner) return;

  if (!lote.value.trim()) {
    avisar("Informe o lote antes de ativar a câmera.", "erro");
    lote.focus();
    return;
  }

  if (!window.Html5Qrcode) {
    avisar("Biblioteca de leitura não carregada. Confira a internet.", "erro");
    return;
  }

  iniciandoCamera = true;
  abrirCamera.disabled = true;
  areaCamera.hidden = false;
  avisar("Iniciando câmera...", "neutro");

  try {
    scanner = new Html5Qrcode("leitor-camera");

    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 280, height: 130 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      },
      texto => {
        // Registra o código e mantém a câmera ativa.
        processarLeitura(texto);
      },
      () => {
        // Leituras não reconhecidas são normais durante a busca.
      }
    );

    iniciandoCamera = false;
    avisar("Câmera ativa. Aponte para a próxima etiqueta.", "sucesso");
  } catch (erro) {
    console.error("Falha ao abrir a câmera:", erro);
    await pararCamera();
    avisar(
      "Não foi possível abrir a câmera. Confira as permissões do navegador.",
      "erro"
    );
  }
});

fecharCamera.addEventListener("click", pararCamera);

window.addEventListener("beforeunload", () => {
  if (scanner) {
    scanner.stop().catch(() => {});
  }
});

salvar();
desenhar();
atualizarOperacao();


// ==========================================
// PORTAL DE COLETA - CONEXÃO SUPABASE
// ==========================================

const SUPABASE_URL = "https://oppsnjqnctbalzsqrbnv.supabase.co";

const SUPABASE_KEY = "sb_publishable_U9y7jGfxtpd7xapMUwX6Xg_oNGl3dDW";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const areaLogin = document.getElementById("areaLogin");
const areaAdmin = document.getElementById("areaAdmin");
const emailAdmin = document.getElementById("emailAdmin");
const senhaAdmin = document.getElementById("senhaAdmin");
const entrarAdmin = document.getElementById("entrarAdmin");
const sairAdmin = document.getElementById("sairAdmin");
const compartilharLote = document.getElementById("compartilharLote");
const linkGerado = document.getElementById("linkGerado");
const statusAdmin = document.getElementById("statusAdmin");

// Verificar login
async function atualizarPainelAdmin() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    statusAdmin.textContent = "Erro ao verificar login.";
    return;
  }

  const sessao = data.session;

  areaLogin.hidden = Boolean(sessao);
  areaAdmin.hidden = !sessao;

  if (sessao) {
    statusAdmin.textContent =
      "Conectado como " + sessao.user.email;

    listarCompartilhamentos();
  }
}

// Entrar
entrarAdmin.addEventListener("click", async () => {
  const email = emailAdmin.value.trim();
  const senha = senhaAdmin.value;

  if (!email || !senha) {
    alert("Informe e-mail e senha.");
    return;
  }

  entrarAdmin.disabled = true;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password: senha
  });

  entrarAdmin.disabled = false;

  if (error) {
    alert("Erro no login. Confira seus dados.");
    console.error(error);
    return;
  }

  senhaAdmin.value = "";
  atualizarPainelAdmin();
});

// Sair
sairAdmin.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  linkGerado.hidden = true;
  atualizarPainelAdmin();
});

// Compartilhar lote
compartilharLote.addEventListener("click", async () => {
  const nomeLote = lote.value.trim();
  const canal = marketplace.value;

  if (!nomeLote) {
    alert("Informe o nome do lote.");
    return;
  }

  const codigos = volumes
    .filter(v =>
      v.marketplace === canal &&
      v.lote.toUpperCase() === nomeLote.toUpperCase()
    )
    .map(v => v.codigo);

  const codigosUnicos = [...new Set(codigos)];

  if (!codigosUnicos.length) {
    alert("Nenhum volume encontrado nesse lote.");
    return;
  }

  const { data: sessaoData } =
    await supabaseClient.auth.getSession();

  if (!sessaoData.session) {
    alert("Faça login novamente.");
    return;
  }

  compartilharLote.disabled = true;

  const { data, error } = await supabaseClient
    .from("lotes_compartilhados")
    .insert({
      owner_id: sessaoData.session.user.id,
      marketplace: canal,
      nome_lote: nomeLote,
      codigos: codigosUnicos,
      ativo: true
    })
    .select("token")
    .single();

  compartilharLote.disabled = false;

  if (error) {
    console.error(error);
    alert("Erro ao criar compartilhamento.");
    return;
  }

  const url = new URL("portal-coleta.html", location.href);
  url.searchParams.set("token", data.token);

  linkGerado.hidden = false;
  linkGerado.innerHTML = "";

  const texto = document.createElement("p");
  texto.textContent = "Link criado para " + nomeLote;

  const campo = document.createElement("input");
  campo.value = url.href;
  campo.readOnly = true;

  const copiar = document.createElement("button");
  copiar.type = "button";
  copiar.className = "btn-camera";
  copiar.textContent = "Copiar link";

  copiar.addEventListener("click", async () => {
    await navigator.clipboard.writeText(url.href);
    copiar.textContent = "Link copiado!";
  });

  linkGerado.append(texto, campo, copiar);

  listarCompartilhamentos();
});

// Listar e revogar links
async function listarCompartilhamentos() {
  let painel = document.getElementById("listaCompartilhamentos");

  if (!painel) {
    painel = document.createElement("div");
    painel.id = "listaCompartilhamentos";
    areaAdmin.appendChild(painel);
  }

  const { data, error } = await supabaseClient
    .from("lotes_compartilhados")
    .select("id, marketplace, nome_lote, ativo")
    .order("criado_em", { ascending: false });

  if (error) {
    painel.textContent = "Erro ao carregar links.";
    console.error(error);
    return;
  }

  painel.innerHTML = "<h3>Links de coleta</h3>";

  data.forEach(item => {
    const bloco = document.createElement("div");
    const texto = document.createElement("p");

    texto.textContent =
      item.marketplace + " - " + item.nome_lote +
      (item.ativo ? " - ATIVO" : " - REVOGADO");

    bloco.appendChild(texto);

    if (item.ativo) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn-secundario";
      botao.textContent = "Revogar link";

      botao.addEventListener("click", async () => {
        if (!confirm("Deseja revogar este link?")) return;

        const { error } = await supabaseClient
          .from("lotes_compartilhados")
          .update({ ativo: false })
          .eq("id", item.id);

        if (error) {
          alert("Erro ao revogar.");
          return;
        }

        listarCompartilhamentos();
      });

      bloco.appendChild(botao);
    }

    painel.appendChild(bloco);
  });
}

atualizarPainelAdmin();
