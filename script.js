
const modo = document.getElementById("modo");
const marketplace = document.getElementById("marketplace");
const lote = document.getElementById("lote");

const mensagem = document.getElementById("mensagem");
const lista = document.getElementById("lista");
const busca = document.getElementById("busca");
const listaVazia = document.getElementById("listaVazia");

const abrirCamera = document.getElementById("abrirCamera");
const fecharCamera = document.getElementById("fecharCamera");
const areaCamera = document.getElementById("areaCamera");
const baixarLote = document.getElementById("baixarLote");

const operacaoAtual = document.getElementById("operacaoAtual");
const canalAtual = document.getElementById("canalAtual");

let volumes = [];

try {
  const dadosSalvos = JSON.parse(
    localStorage.getItem("bipVolumes") || "[]"
  );

  volumes = Array.isArray(dadosSalvos) ? dadosSalvos : [];
} catch (erro) {
  console.error("Erro ao ler volumes salvos:", erro);
  volumes = [];
}

let scanner = null;
let iniciandoCamera = false;
let processandoLeitura = false;
let cameraAtiva = false;

// Impede a leitura repetida do mesmo código em quadros consecutivos.
const leiturasRecentes = new Map();
const INTERVALO_ANTI_REPETICAO = 2500;

// Compatibilidade com os registros da versão anterior.
volumes = volumes.map(volume => ({
  ...volume,
  codigo: String(volume.codigo || ""),
  marketplace: volume.marketplace || "Sem categoria",
  lote: volume.lote || "Lote antigo",
  status: volume.status || "pendente"
}));

function salvar() {
  try {
    localStorage.setItem("bipVolumes", JSON.stringify(volumes));
    return true;
  } catch (erro) {
    console.error("Erro ao salvar volumes:", erro);
    avisar(
      "Não foi possível salvar. O armazenamento do navegador pode estar cheio.",
      "erro"
    );
    return false;
  }
}

function avisar(texto, tipo = "neutro") {
  mensagem.textContent = texto;
  mensagem.className = "mensagem";

  if (tipo === "sucesso") {
    mensagem.classList.add("sucesso");
  }

  if (tipo === "erro") {
    mensagem.classList.add("erro");
  }
}

function atualizarOperacao() {
  operacaoAtual.textContent =
    modo.value === "entrada"
      ? "ENTRADA DE VOLUMES"
      : "SAÍDA DE VOLUMES";

  canalAtual.textContent = marketplace.value;

  operacaoAtual.style.color =
    modo.value === "entrada" ? "#42e58b" : "#f4b454";
}

function desenhar() {
  const pendentes = volumes.filter(
    volume => volume.status === "pendente"
  ).length;

  const carregados = volumes.filter(
    volume => volume.status === "carregado"
  ).length;

  document.getElementById("pendentes").textContent = pendentes;
  document.getElementById("carregados").textContent = carregados;

  const termo = busca.value.trim().toUpperCase();

  const filtrados = volumes
    .filter(volume => {
      return (
        volume.codigo.toUpperCase().includes(termo) ||
        volume.lote.toUpperCase().includes(termo) ||
        volume.marketplace.toUpperCase().includes(termo)
      );
    })
    .slice()
    .reverse();

  lista.replaceChildren();
  listaVazia.hidden = filtrados.length !== 0;

  filtrados.forEach(volume => {
    const item = document.createElement("li");

    const info = document.createElement("div");
    info.className = "volume-info";
    info.textContent = volume.codigo;

    const detalhe = document.createElement("div");
    detalhe.className = "volume-detalhe";
    detalhe.textContent =
      `${volume.marketplace} · Lote: ${volume.lote}`;

    const status = document.createElement("span");
    status.className =
      volume.status === "pendente"
        ? "status status-pendente"
        : "status status-carregado";

    status.textContent =
      volume.status === "pendente"
        ? "PENDENTE NO BARRACÃO"
        : "CARREGADO";

    const acoes = document.createElement("div");
    acoes.className = "acoes-volume";

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "btn-excluir";
    excluir.textContent = "Excluir registro";

    excluir.addEventListener("click", () => {
      const confirmar = confirm(
        `Deseja excluir o registro ${volume.codigo}?`
      );

      if (!confirmar) return;

      volumes = volumes.filter(
        item => item.codigo !== volume.codigo
      );

      if (!salvar()) return;

      desenhar();
      avisar("Registro excluído.", "sucesso");
    });

    acoes.appendChild(excluir);
    item.append(info, detalhe, status, acoes);
    lista.appendChild(item);
  });
}

function registrarCodigo(codigoLido) {
  const codigo = String(codigoLido || "")
    .trim()
    .toUpperCase();

  const nomeLote = lote.value.trim();
  const canal = marketplace.value;

  if (!codigo) {
    return false;
  }

  if (!nomeLote) {
    avisar("Informe o lote antes de bipar.", "erro");
    return false;
  }

  const existente = volumes.find(
    volume => volume.codigo.toUpperCase() === codigo
  );

  if (modo.value === "entrada") {
    if (existente) {
      avisar(
        `ETIQUETA JÁ CADASTRADA: ${codigo}`,
        "erro"
      );
      return false;
    }

    const novoVolume = {
      codigo,
      marketplace: canal,
      lote: nomeLote,
      status: "pendente",
      entrada: new Date().toISOString(),
      saida: null
    };

    volumes.push(novoVolume);

    if (!salvar()) {
      volumes.pop();
      return false;
    }

    desenhar();
    avisar(`✓ ENTRADA REGISTRADA: ${codigo}`, "sucesso");
    return true;
  }

  if (!existente) {
    avisar(
      `CÓDIGO NÃO ENCONTRADO: ${codigo}. Registre a entrada primeiro.`,
      "erro"
    );
    return false;
  }

  if (existente.status === "carregado") {
    avisar(`ESTE VOLUME JÁ FOI CARREGADO: ${codigo}`, "erro");
    return false;
  }

  // Guarda os dados anteriores para poder desfazer se o salvamento falhar.
  const statusAnterior = existente.status;
  const saidaAnterior = existente.saida;

  existente.status = "carregado";
  existente.saida = new Date().toISOString();

  if (!salvar()) {
    existente.status = statusAnterior;
    existente.saida = saidaAnterior;
    return false;
  }

  desenhar();
  avisar(`✓ SAÍDA REGISTRADA: ${codigo}`, "sucesso");
  return true;
}

function processarLeitura(texto) {
  const codigo = String(texto || "").trim().toUpperCase();

  if (!codigo || processandoLeitura) return;

  const agora = Date.now();
  const ultimaLeitura = leiturasRecentes.get(codigo) || 0;

  if (agora - ultimaLeitura < INTERVALO_ANTI_REPETICAO) {
    return;
  }

  // Registra o horário antes do processamento para evitar leituras
  // repetidas enquanto o código continua visível para a câmera.
  leiturasRecentes.set(codigo, agora);
  processandoLeitura = true;

  try {
    registrarCodigo(codigo);
  } catch (erro) {
    console.error("Erro durante a leitura:", erro);
    avisar("Erro ao processar a etiqueta. Tente novamente.", "erro");
  } finally {
    setTimeout(() => {
      processandoLeitura = false;
    }, 500);
  }

  // Limpa leituras antigas para evitar crescimento indefinido do mapa.
  if (leiturasRecentes.size > 100) {
    for (const [chave, horario] of leiturasRecentes) {
      if (agora - horario > 30000) {
        leiturasRecentes.delete(chave);
      }
    }
  }
}

busca.addEventListener("input", desenhar);

modo.addEventListener("change", () => {
  atualizarOperacao();
  avisar("Operação alterada. Confira o modo antes de continuar.");
});

marketplace.addEventListener("change", atualizarOperacao);

baixarLote.addEventListener("click", () => {
  const nomeLote = lote.value.trim();
  const canal = marketplace.value;

  if (!nomeLote) {
    avisar("Informe a identificação do lote.", "erro");
    lote.focus();
    return;
  }

  const pendentes = volumes.filter(volume =>
    volume.status === "pendente" &&
    volume.marketplace === canal &&
    volume.lote.toUpperCase() === nomeLote.toUpperCase()
  );

  if (pendentes.length === 0) {
    avisar("Nenhum volume pendente encontrado nesse lote.", "erro");
    return;
  }

  const confirmar = confirm(
    `Marketplace: ${canal}\n` +
    `Lote: ${nomeLote}\n` +
    `Volumes: ${pendentes.length}\n\n` +
    "Confirma que TODOS esses volumes foram carregados?"
  );

  if (!confirmar) return;

  const agora = new Date().toISOString();

  pendentes.forEach(volume => {
    volume.status = "carregado";
    volume.saida = agora;
  });

  if (!salvar()) {
    pendentes.forEach(volume => {
      volume.status = "pendente";
      volume.saida = null;
    });
    return;
  }

  desenhar();
  avisar(
    `✓ ${pendentes.length} volumes baixados do lote.`,
    "sucesso"
  );
});

async function pararCamera() {
  const leitor = scanner;

  scanner = null;
  cameraAtiva = false;

  if (leitor) {
    try {
      await leitor.stop();
    } catch (erro) {
      console.warn("A câmera já estava parada:", erro);
    }

    try {
      await leitor.clear();
    } catch (erro) {
      console.warn("Limpeza do leitor:", erro);
    }
  }

  areaCamera.hidden = true;
  abrirCamera.disabled = false;
  iniciandoCamera = false;
  processandoLeitura = false;
}

abrirCamera.addEventListener("click", async () => {
  if (iniciandoCamera || cameraAtiva) return;

  if (!lote.value.trim()) {
    avisar("Informe o lote antes de abrir a câmera.", "erro");
    lote.focus();
    return;
  }

  if (!window.Html5Qrcode) {
    avisar(
      "O leitor não carregou. Verifique a conexão com a internet.",
      "erro"
    );
    return;
  }

  iniciandoCamera = true;
  abrirCamera.disabled = true;
  areaCamera.hidden = false;

  avisar("Solicitando acesso à câmera...");

  try {
    const leitor = new Html5Qrcode("leitor-camera", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE
      ],
      verbose: false
    });

    scanner = leitor;

    await leitor.start(
      { facingMode: "environment" },
      {
        fps: 15,
        aspectRatio: 1.777778
      },
      codigo => {
        processarLeitura(codigo);
      },
      () => {
        // É normal não encontrar um código em todos os quadros.
      }
    );

    cameraAtiva = true;
    iniciandoCamera = false;

    avisar(
      "Câmera ativa. Aponte para o código de barras; o registro é automático.",
      "sucesso"
    );
  } catch (erro) {
    console.error("Erro ao iniciar a câmera:", erro);

    await pararCamera();

    avisar(
      "Não foi possível iniciar a câmera. Confira a permissão do Safari e tente novamente.",
      "erro"
    );
  }
});

fecharCamera.addEventListener("click", pararCamera);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && scanner) {
    pararCamera();
  }
});

// Inicialização: mantém os registros já existentes.
desenhar();
atualizarOperacao();
