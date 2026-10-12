
const codigo = document.getElementById("codigo");
const modo = document.getElementById("modo");
const marketplace = document.getElementById("marketplace");
const lote = document.getElementById("lote");
const botao = document.getElementById("registrar");
const mensagem = document.getElementById("mensagem");
const lista = document.getElementById("lista");
const busca = document.getElementById("busca");
const abrirCamera = document.getElementById("abrirCamera");
const fecharCamera = document.getElementById("fecharCamera");
const areaCamera = document.getElementById("areaCamera");
const baixarLote = document.getElementById("baixarLote");

let volumes = JSON.parse(localStorage.getItem("bipVolumes") || "[]");
let scanner = null;
let iniciandoCamera = false;

// Compatibilidade com os registros da versão anterior.
volumes = volumes.map(v => ({
  ...v,
  marketplace: v.marketplace || "Sem categoria",
  lote: v.lote || "Lote antigo"
}));

function salvar() {
  localStorage.setItem("bipVolumes", JSON.stringify(volumes));
}

function avisar(texto, sucesso = true) {
  mensagem.textContent = texto;
  mensagem.style.color = sucesso ? "#15803d" : "#dc2626";
}

function desenhar() {
  document.getElementById("pendentes").textContent =
    volumes.filter(v => v.status === "pendente").length;

  document.getElementById("carregados").textContent =
    volumes.filter(v => v.status === "carregado").length;

  const termo = busca.value.trim().toUpperCase();
  lista.innerHTML = "";

  volumes
    .filter(v =>
      v.codigo.toUpperCase().includes(termo) ||
      v.lote.toUpperCase().includes(termo) ||
      v.marketplace.toUpperCase().includes(termo)
    )
    .slice()
    .reverse()
    .forEach(volume => {
      const item = document.createElement("li");
      const info = document.createElement("div");
      const status = document.createElement("span");
      const acoes = document.createElement("div");
      const excluir = document.createElement("button");

      info.textContent =
        `${volume.codigo} | ${volume.marketplace} | ${volume.lote}`;

      status.className = "status";
      status.textContent = volume.status === "pendente"
        ? "PENDENTE NO BARRACÃO"
        : "CARREGADO";

      status.style.color = volume.status === "pendente"
        ? "#b45309"
        : "#15803d";

      excluir.type = "button";
      excluir.className = "btn-excluir";
      excluir.textContent = "🗑️ Excluir";

      excluir.addEventListener("click", () => {
        if (!confirm(
          `Excluir o registro ${volume.codigo}?\n` +
          "Isso removerá seu histórico deste navegador."
        )) return;

        volumes = volumes.filter(v => v.codigo !== volume.codigo);
        salvar();
        desenhar();
        avisar("Registro excluído.");
      });

      acoes.className = "acoes-volume";
      acoes.appendChild(excluir);
      item.append(info, status, acoes);
      lista.appendChild(item);
    });
}

function registrar() {
  const valor = codigo.value.trim().toUpperCase();
  const canal = marketplace.value;
  const nomeLote = lote.value.trim();

  if (!valor) {
    avisar("Leia ou digite um código primeiro.", false);
    codigo.focus();
    return;
  }

  if (!nomeLote) {
    avisar("Informe o lote antes de registrar.", false);
    lote.focus();
    return;
  }

  const existente = volumes.find(v => v.codigo === valor);

  if (modo.value === "entrada") {
    if (existente) {
      avisar("Essa etiqueta já está registrada.", false);
      codigo.select();
      return;
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
    avisar("Entrada registrada!");
  } else {
    if (!existente) {
      avisar("Etiqueta não encontrada na entrada.", false);
      return;
    }

    if (existente.status === "carregado") {
      avisar("Essa etiqueta já teve baixa.", false);
      return;
    }

    existente.status = "carregado";
    existente.saida = new Date().toISOString();

    salvar();
    desenhar();
    avisar("Saída registrada!");
  }

  codigo.value = "";
  codigo.focus();
}

botao.addEventListener("click", registrar);

codigo.addEventListener("keydown", evento => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    registrar();
  }
});

busca.addEventListener("input", desenhar);

baixarLote.addEventListener("click", () => {
  const canal = marketplace.value;
  const nomeLote = lote.value.trim();

  if (!nomeLote) {
    avisar("Informe o lote que será carregado.", false);
    lote.focus();
    return;
  }

  const pendentes = volumes.filter(v =>
    v.status === "pendente" &&
    v.marketplace === canal &&
    v.lote.toUpperCase() === nomeLote.toUpperCase()
  );

  if (pendentes.length === 0) {
    avisar("Não há volumes pendentes nesse lote.", false);
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
  avisar(`${pendentes.length} volumes baixados do lote.`);
});

async function pararCamera() {
  if (scanner) {
    const atual = scanner;
    scanner = null;

    try {
      await atual.stop();
    } catch (erro) {}

    try {
      await atual.clear();
    } catch (erro) {}
  }

  areaCamera.hidden = true;
  abrirCamera.disabled = false;
  iniciandoCamera = false;
}

abrirCamera.addEventListener("click", async () => {
  if (iniciandoCamera || scanner) return;

  if (!window.Html5Qrcode) {
    avisar("Biblioteca não carregada. Confira a internet.", false);
    return;
  }

  iniciandoCamera = true;
  abrirCamera.disabled = true;
  areaCamera.hidden = false;

  try {
    scanner = new Html5Qrcode("leitor-camera");

    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 120 },
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
      async texto => {
        codigo.value = texto.trim();
        await pararCamera();
        avisar("Código lido. Confira e registre o bip.");
        codigo.focus();
      },
      () => {}
    );

    iniciandoCamera = false;
  } catch (erro) {
    await pararCamera();
    avisar("Não abriu a câmera. Confira as permissões e o HTTPS.", false);
  }
});

fecharCamera.addEventListener("click", pararCamera);

window.addEventListener("beforeunload", () => {
  if (scanner) scanner.stop().catch(() => {});
});

salvar();
desenhar();
