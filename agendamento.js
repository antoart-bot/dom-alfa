
import {
    ref,
    get,
    update,
    push,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import {
    auth,
    db
} from "./firebase.js";

import {
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { CONFIG } from "./config.js";

// ========================================
// ELEMENTOS
// ========================================

const campoTelefone = document.getElementById("telefoneCliente");
const dataInput = document.getElementById("dataCliente");
const listaHorarios = document.getElementById("listaHorarios");
const confirmar = document.getElementById("confirmarAgendamento");
const mensagem = document.getElementById("mensagemAgendamento");
const abrirAgendamento = document.getElementById("abrirAgendamento");

let horarioSelecionado = null;

// ========================================
// MÁSCARA DO TELEFONE
// ========================================

campoTelefone.addEventListener("input", () => {
    let numeros = campoTelefone.value.replace(/\D/g, "");

    numeros = numeros.substring(0, 11);

    if (numeros.length > 7) {
        numeros = numeros.replace(
            /^(\d{2})(\d{5})(\d{0,4})$/,
            "($1) $2-$3"
        );
    } else if (numeros.length > 2) {
        numeros = numeros.replace(
            /^(\d{2})(\d{0,5})$/,
            "($1) $2"
        );
    } else if (numeros.length > 0) {
        numeros = numeros.replace(
            /^(\d*)$/,
            "($1"
        );
    }

    campoTelefone.value = numeros;
});

// ========================================
// CONFIGURAÇÃO DO CLIENTE
// ========================================

let CONFIG_CLIENTE = {
    ...CONFIG
};

let CAMINHO_BARBEIRO = `barbeiros/${CONFIG.id}`;

// ========================================
// DESCOBRIR CLIENTE PELA URL
// ========================================

function descobrirCliente() {
    const parametros = new URLSearchParams(window.location.search);

    return parametros.get("cliente") || CONFIG.id;
}

// ========================================
// CARREGAR CONFIGURAÇÃO DO CLIENTE
// ========================================

async function carregarConfiguracaoCliente() {

    const clienteId = descobrirCliente();

    CAMINHO_BARBEIRO = `barbeiros/${clienteId}`;

    console.log("CLIENTE DO AGENDAMENTO:", clienteId);
    console.log("CAMINHO DO AGENDAMENTO:", CAMINHO_BARBEIRO);

    try {

        const configuracoesRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/configuracoes`
        );

        const snapshot = await get(configuracoesRef);

        if (snapshot.exists()) {
            CONFIG_CLIENTE = {
                ...CONFIG,
                ...snapshot.val()
            };
        } else {
            CONFIG_CLIENTE = { ...CONFIG };
        }

        console.log("CONFIGURAÇÃO:", CONFIG_CLIENTE);

    } catch (erro) {

        console.error("Erro ao carregar configuração:", erro);

        CONFIG_CLIENTE = { ...CONFIG };
    }
}

// ========================================
// DATA ATUAL
// ========================================

function obterDataHoje() {

    const hoje = new Date();

    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}

dataInput.min = obterDataHoje();
dataInput.value = obterDataHoje();

// ========================================
// FORMATAR DATA
// ========================================

function formatarData(data) {

    const partes = data.split("-");

    if (partes.length !== 3) {
        return data;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// ========================================
// MODAL DE CONFIRMAÇÃO
// ========================================

function mostrarConfirmacao({
    nome,
    servico,
    data,
    horario
}) {

    return new Promise((resolve) => {

        const modal = document.createElement("div");

        modal.className = "modal-confirmacao";

        modal.innerHTML = `
            <div class="modal-confirmacao-conteudo">

                <button
                    type="button"
                    class="modal-fechar"
                    aria-label="Fechar"
                >
                    ×
                </button>

                <div class="modal-icone">✂</div>

                <h3>Confirmar agendamento?</h3>

                <p class="modal-subtitulo">
                    Confira os dados antes de finalizar.
                </p>

                <div class="resumo-agendamento">

                    <div class="resumo-item">
                        <span>Cliente</span>
                        <strong class="resumo-nome"></strong>
                    </div>

                    <div class="resumo-item">
                        <span>Serviço</span>
                        <strong class="resumo-servico"></strong>
                    </div>

                    <div class="resumo-item">
                        <span>Data</span>
                        <strong class="resumo-data"></strong>
                    </div>

                    <div class="resumo-item">
                        <span>Horário</span>
                        <strong class="resumo-horario"></strong>
                    </div>

                </div>

                <div class="modal-acoes">

                    <button
                        type="button"
                        class="modal-cancelar"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        class="modal-confirmar"
                    >
                        Confirmar
                    </button>

                </div>

            </div>
        `;

        modal.querySelector(".resumo-nome").textContent = nome;
        modal.querySelector(".resumo-servico").textContent = servico;
        modal.querySelector(".resumo-data").textContent = formatarData(data);
        modal.querySelector(".resumo-horario").textContent = horario;

        document.body.appendChild(modal);

        requestAnimationFrame(() => {
            modal.classList.add("ativo");
        });

        const fechar = (resultado) => {

            modal.classList.remove("ativo");

            setTimeout(() => {
                modal.remove();
            }, 200);

            resolve(resultado);
        };

        modal.querySelector(".modal-fechar")
            .addEventListener("click", () => fechar(false));

        modal.querySelector(".modal-cancelar")
            .addEventListener("click", () => fechar(false));

        modal.querySelector(".modal-confirmar")
            .addEventListener("click", () => fechar(true));

        modal.addEventListener("click", (e) => {

            if (e.target === modal) {
                fechar(false);
            }
        });

    });
}

// ========================================
// MENSAGEM DE SUCESSO
// ========================================

function mostrarSucesso({
    nome,
    telefone,
    servico,
    data,
    horario
}) {

    const nomeBarbearia = String(
        CONFIG_CLIENTE.nome || CONFIG.nome
    );

    const mensagemWhatsApp = encodeURIComponent(
        `*${nomeBarbearia.toUpperCase()}*\n` +
        `================================\n\n` +
        `Olá! Tudo bem?\n\n` +
        `Acabei de realizar um agendamento pelo site e estou enviando os detalhes.\n\n` +
        `*DADOS DO AGENDAMENTO*\n\n` +
        `*Cliente:* ${nome}\n` +
        `*Serviço:* ${servico}\n` +
        `*Data:* ${formatarData(data)}\n` +
        `*Horário:* ${horario}\n` +
        `*Contato:* ${telefone}\n\n` +
        `================================\n` +
        `Agendamento realizado pelo site.\n\n` +
        `Obrigado! Até breve.`
    );

    const numeroWhatsApp =
        CONFIG_CLIENTE.whatsapp || CONFIG.whatsapp;

    const linkWhatsApp =
        `https://wa.me/${numeroWhatsApp}?text=${mensagemWhatsApp}`;

    mensagem.innerHTML = `
        <div class="sucesso-agendamento">

            <div class="sucesso-icone">
                ✓
            </div>

            <h3>
                Agendamento confirmado!
            </h3>

            <p>
                Seu horário foi reservado com sucesso.
            </p>

            <strong class="sucesso-data"></strong>

            <p>
                Serviço:
                <strong class="sucesso-servico"></strong>
            </p>

            <span class="sucesso-barbearia"></span>

            <a
                target="_blank"
                rel="noopener noreferrer"
                class="botao-whatsapp-agendamento"
            >
                💬 Enviar mensagem pelo WhatsApp
            </a>

        </div>
    `;

    mensagem.querySelector(".sucesso-data").textContent =
        `${formatarData(data)} às ${horario}`;

    mensagem.querySelector(".sucesso-servico").textContent =
        servico;

    mensagem.querySelector(".sucesso-barbearia").textContent =
        `Aguardamos você na ${nomeBarbearia}. ✂️`;

    const link = mensagem.querySelector(
        ".botao-whatsapp-agendamento"
    );

    link.href = linkWhatsApp;
}

// ========================================
// CARREGAR HORÁRIOS
// ========================================

async function carregarHorarios() {

    const data = dataInput.value;

    horarioSelecionado = null;
    listaHorarios.innerHTML = "";

    if (!data) {

        listaHorarios.innerHTML =
            "<p>Escolha uma data.</p>";

        return;
    }

    listaHorarios.innerHTML =
        "<p>Carregando horários...</p>";

    try {

        const horariosRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/horarios/${data}`
        );

        const snapshot = await get(horariosRef);

        if (!snapshot.exists()) {

            listaHorarios.innerHTML =
                "<p>Nenhum horário disponível para esta data.</p>";

            return;
        }

        const horarios = snapshot.val();

        const horariosOrdenados = Object.entries(horarios).sort(
            ([horarioA], [horarioB]) => {

                const [horaA, minutoA] = horarioA.split(":").map(Number);
                const [horaB, minutoB] = horarioB.split(":").map(Number);

                return (
                    horaA * 60 + minutoA -
                    (horaB * 60 + minutoB)
                );
            }
        );

        listaHorarios.innerHTML = "";

        let encontrouHorario = false;

        horariosOrdenados.forEach(([horario, dados]) => {

            if (!dados || dados.disponivel !== true) {
                return;
            }

            encontrouHorario = true;

            const botao = document.createElement("button");

            botao.type = "button";
            botao.className = "horario";
            botao.textContent = horario;

            botao.addEventListener("click", () => {

                document.querySelectorAll(".horario").forEach((btn) => {
                    btn.classList.remove("selecionado");
                });

                botao.classList.add("selecionado");

                horarioSelecionado = horario;

                mensagem.innerHTML = "";
            });

            listaHorarios.appendChild(botao);
        });

        if (!encontrouHorario) {

            listaHorarios.innerHTML =
                "<p>Não há horários disponíveis para esta data.</p>";
        }

    } catch (erro) {

        console.error("Erro ao carregar horários:", erro);

        listaHorarios.innerHTML =
            "<p>Erro ao carregar os horários.</p>";
    }
}

// ========================================
// TROCAR DATA
// ========================================

dataInput.addEventListener("change", carregarHorarios);

// ========================================
// ABRIR AGENDAMENTO
// ========================================

if (abrirAgendamento) {

    abrirAgendamento.addEventListener("click", () => {

        const secaoAgendamento =
            document.getElementById("agendamento");

        if (secaoAgendamento) {

            secaoAgendamento.scrollIntoView({
                behavior: "smooth"
            });
        }

        carregarHorarios();
    });
}

// ========================================
// REALIZAR AGENDAMENTO
// ========================================

confirmar.addEventListener("click", async () => {

    if (confirmar.disabled) {
        return;
    }

    const nome = document
        .getElementById("nomeCliente")
        .value
        .trim();

    const telefone = document
        .getElementById("telefoneCliente")
        .value
        .trim();

    const selectServico =
        document.getElementById("servicoCliente");

    const opcaoServico =
        selectServico.selectedOptions[0];

    const servicoId = selectServico.value;

    const servico =
        opcaoServico?.dataset.nomeServico ||
        opcaoServico?.textContent ||
        "";

    const data = dataInput.value;

    // ========================================
    // VALIDAR CAMPOS
    // ========================================

    if (
        !nome ||
        !telefone ||
        !servico ||
        !data ||
        !horarioSelecionado
    ) {

        mensagem.textContent =
            "Preencha todos os campos e escolha um horário.";

        return;
    }

    const horario = horarioSelecionado;

    // ========================================
    // CONFIRMAÇÃO DO CLIENTE
    // ========================================

    const usuarioConfirmou = await mostrarConfirmacao({
        nome,
        servico,
        data,
        horario
    });

    if (!usuarioConfirmou) {

        mensagem.textContent = "Agendamento cancelado.";

        return;
    }

    mensagem.textContent =
        "Confirmando seu agendamento...";

    confirmar.disabled = true;

    let uidCliente = null;
    let horarioFoiReservado = false;
    let referenciaHorario = null;
    let novoAgendamento = null;

    try {

        // ========================================
        // AUTENTICAÇÃO ANÔNIMA
        // ========================================

        const credencial = auth.currentUser
            ? { user: auth.currentUser }
            : await signInAnonymously(auth);

        uidCliente = credencial.user.uid;

        console.log("CLIENTE AUTENTICADO:", uidCliente);

        // ========================================
        // CRIAR ID DO AGENDAMENTO ANTES DA RESERVA
        // ========================================

        const agendamentosRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/agendamentos`
        );

        novoAgendamento = push(agendamentosRef);

        console.log(
            "ID DO AGENDAMENTO:",
            novoAgendamento.key
        );

        // ========================================
        // REFERÊNCIA DO HORÁRIO
        // ========================================

        referenciaHorario = ref(
            db,
            `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}`
        );

        console.log(
            "CAMINHO DA RESERVA:",
            `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}`
        );

        // ========================================
        // LER HORÁRIO NO FIREBASE
        // ========================================

        console.log("INICIANDO LEITURA:", data, horario);

        const teste = await get(referenciaHorario);

        console.log("LEITURA DO HORÁRIO:", {
            existe: teste.exists(),
            dados: teste.val(),
            disponivel: teste.val()?.disponivel,
            tipoDisponivel: typeof teste.val()?.disponivel
        });

        if (
            !teste.exists() ||
            teste.val()?.disponivel !== true
        ) {

            mensagem.textContent =
                "Esse horário não está mais disponível. Escolha outro.";

            await carregarHorarios();

            return;
        }

        const horarioBase = teste.val();

        // ========================================
        // RESERVAR HORÁRIO COM TRANSAÇÃO
        // ========================================

        console.log("INICIANDO TRANSAÇÃO:", horarioBase);

        const resultado = await runTransaction(
            referenciaHorario,
            (horarioAtual) => {

                console.log(
                    "DADOS RECEBIDOS PELA TRANSAÇÃO:",
                    horarioAtual
                );

                const horarioAtualizado =
                    horarioAtual ?? horarioBase;

                if (
                    !horarioAtualizado ||
                    horarioAtualizado.disponivel !== true
                ) {

                    console.log(
                        "HORÁRIO INDISPONÍVEL NA TRANSAÇÃO"
                    );

                    return;
                }

                console.log(
                    "TENTANDO RESERVAR:",
                    horarioAtualizado
                );

                return {
                    ...horarioAtualizado,
                    disponivel: false,
                    reservadoPor: uidCliente,
                    agendamentoId: novoAgendamento.key
                };
            }
        );

        console.log("TRANSAÇÃO FINALIZADA:", resultado);

        if (!resultado.committed) {

            mensagem.textContent =
                "Não foi possível reservar esse horário. Tente escolher outro.";

            await carregarHorarios();

            return;
        }

        // ========================================
        // HORÁRIO RESERVADO
        // ========================================

        horarioFoiReservado = true;

        console.log("HORÁRIO RESERVADO:", horario);

        // ========================================
        // CRIAR AGENDAMENTO CONFIRMADO
        // ========================================

        const agora = new Date().toISOString();

        console.log(
            "TENTANDO GRAVAR AGENDAMENTO:",
            novoAgendamento.key
        );

        await update(novoAgendamento, {

            nome: nome,
            telefone: telefone,

            servico: servico,
            servicoId: servicoId,

            data: data,
            horario: horario,

            status: "confirmado",

            clienteUid: uidCliente,

            criadoEm: agora,
            confirmadoEm: agora

        });

        console.log("GRAVAÇÃO CONCLUÍDA!");

        horarioFoiReservado = false;

        console.log(
            "AGENDAMENTO CONFIRMADO:",
            novoAgendamento.key
        );

        // ========================================
        // SUCESSO
        // ========================================

        mostrarSucesso({
            nome,
            telefone,
            servico,
            data,
            horario
        });

        // ========================================
        // LIMPAR CAMPOS
        // ========================================

        document.getElementById("nomeCliente").value = "";
        document.getElementById("telefoneCliente").value = "";
        document.getElementById("servicoCliente").value = "";

        horarioSelecionado = null;

        // ========================================
        // ATUALIZAR HORÁRIOS
        // ========================================

        await carregarHorarios();

    } catch (erro) {

        console.error("ERRO COMPLETO:", erro);
        console.error("CÓDIGO:", erro.code);
        console.error("MENSAGEM:", erro.message);

        alert(
            "ERRO AO AGENDAR:\n" +
            (erro.code || "") +
            "\n" +
            erro.message
        );

        // ========================================
        // LIBERAR HORÁRIO SE A GRAVAÇÃO FALHAR
        // ========================================

        if (
            horarioFoiReservado &&
            referenciaHorario &&
            uidCliente
        ) {

            try {

    const resultadoLiberacao = await runTransaction(
        referenciaHorario,
        (horarioAtual) => {

            if (
                !horarioAtual ||
                horarioAtual.reservadoPor !== uidCliente ||
                horarioAtual.disponivel !== false ||
                horarioAtual.agendamentoId !== novoAgendamento.key
            ) {
                return;
            }

            const horarioLiberado = {
                ...horarioAtual
            };

            delete horarioLiberado.reservadoPor;
            delete horarioLiberado.agendamentoId;

            horarioLiberado.disponivel = true;

            return horarioLiberado;
        }
    );

    if (resultadoLiberacao.committed) {

        console.log("HORÁRIO LIBERADO APÓS ERRO.");

    } else {

        console.log(
            "HORÁRIO NÃO LIBERADO: reserva não pôde ser alterada."
        );
    }

} catch (erroLiberacao) {

    console.error(
        "ERRO AO LIBERAR HORÁRIO:",
        erroLiberacao
    );
}
        }

        mensagem.textContent =
            "Erro ao agendar: " +
            (erro.code || erro.message);

    } finally {

        confirmar.disabled = false;
    }

});

// ========================================
// INICIAR SITE
// ========================================

async function iniciarAgendamento() {

    await carregarConfiguracaoCliente();

    await carregarHorarios();
}

iniciarAgendamento();
