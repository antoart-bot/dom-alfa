
import {
    ref,
    get,
    update,
    remove,
    onValue,
    push
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { db, auth } from "./firebase.js";
import { CONFIG } from "./config.js";

import { descobrirCliente } from "./cliente.js";


// =========================================================
// CAMINHO DO CLIENTE
// =========================================================

let CAMINHO_BARBEIRO = null;
let CONFIG_CLIENTE = null;


// =========================================================
// ELEMENTOS
// =========================================================

const dataPainel = document.getElementById("dataPainel");
const atualizar = document.getElementById("atualizar");

const totalAgendados = document.getElementById("totalAgendados");
const totalDisponiveis = document.getElementById("totalDisponiveis");
const totalOcupados = document.getElementById("totalOcupados");

const listaAgendamentos = document.getElementById("listaAgendamentos");

let abaAtualAgendamentos = "ativos";

const botoesAbasAgendamentos =
    document.querySelectorAll(".aba-agendamentos");

botoesAbasAgendamentos.forEach(botao => {
    botao.addEventListener("click", () => {
        abaAtualAgendamentos = botao.dataset.aba;

        botoesAbasAgendamentos.forEach(aba => {
            aba.classList.remove("ativa");
        });

        botao.classList.add("ativa");

        carregarAgendamentos();
    });
});

const listaHorarios = document.getElementById("listaHorarios");
const novoHorario = document.getElementById("novoHorario");
const adicionarHorario = document.getElementById("adicionarHorario");
const mensagem = document.getElementById("mensagem");
const sair = document.getElementById("sair");

const horaInicio = document.getElementById("horaInicio");
const horaFim = document.getElementById("horaFim");
const intervaloHorario = document.getElementById("intervaloHorario");
const pausaInicio = document.getElementById("pausaInicio");
const pausaFim = document.getElementById("pausaFim");
const gerarHorarios = document.getElementById("gerarHorarios");

const nomeBarbearia = document.getElementById("nomeBarbearia");

const formCategoria = document.getElementById("formCategoria");
const nomeCategoria = document.getElementById("nomeCategoria");
const salvarCategoria = document.getElementById("salvarCategoria");

const formServico = document.getElementById("formServico");
const categoriaServico = document.getElementById("categoriaServico");
const nomeServico = document.getElementById("nomeServico");
const precoServico = document.getElementById("precoServico");
const salvarServico = document.getElementById("salvarServico");

const listaServicos = document.getElementById("listaServicos");
const mensagemServicos = document.getElementById("mensagemServicos");


// =========================================================
// CONFIGURAÇÃO DA BARBEARIA
// =========================================================

function aplicarConfiguracaoCliente() {
    if (!CONFIG_CLIENTE) return;

    const nome =
        CONFIG_CLIENTE.nome ||
        CONFIG.nome ||
        "Painel";

    if (nomeBarbearia) {
        nomeBarbearia.textContent = nome;
    }

    document.title = `Painel — ${nome}`;
}


// =========================================================
// CARREGAR CONFIGURAÇÃO DO CLIENTE
// =========================================================

async function carregarConfiguracaoCliente() {
    if (!CAMINHO_BARBEIRO) return;

    try {
        const configuracoesRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/configuracoes`
        );

        const snapshot = await get(configuracoesRef);

        if (!snapshot.exists()) {
            console.warn(
                "Nenhuma configuração encontrada para este cliente."
            );

            CONFIG_CLIENTE = {
                nome: CONFIG.nome
            };

            return;
        }

        CONFIG_CLIENTE = snapshot.val();

        console.log(
            "CONFIGURAÇÃO DO CLIENTE:",
            CONFIG_CLIENTE
        );

    } catch (erro) {
        console.error(
            "Erro ao carregar configuração do cliente:",
            erro
        );

        CONFIG_CLIENTE = {
            nome: CONFIG.nome
        };
    }
}


// =========================================================
// DATA DE HOJE
// =========================================================

function obterDataHoje() {
    const hoje = new Date();

    const ano = hoje.getFullYear();

    const mes = String(
        hoje.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
        hoje.getDate()
    ).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}

const dataHoje = obterDataHoje();

if (dataPainel) {
    dataPainel.min = dataHoje;
    dataPainel.value = dataHoje;
}


// =========================================================
// LIMPAR HORÁRIOS DE DIAS PASSADOS
// NÃO APAGA AGENDAMENTOS
// =========================================================

async function limparHorariosPassados() {
    if (!CAMINHO_BARBEIRO) return;

    const hoje = obterDataHoje();

    try {
        const horariosRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/horarios`
        );

        const snapshot = await get(horariosRef);

        if (!snapshot.exists()) return;

        const horarios = snapshot.val();
        const exclusoes = {};

        Object.keys(horarios).forEach(data => {
            if (data < hoje) {
                exclusoes[data] = null;
            }
        });

        if (Object.keys(exclusoes).length === 0) return;

        await update(horariosRef, exclusoes);

        console.log(
            "Horários de dias passados removidos."
        );

    } catch (erro) {
        console.error(
            "Erro ao limpar horários passados:",
            erro
        );
    }
}


// =========================================================
// NOTIFICAÇÕES
// =========================================================

let idsAgendamentosConhecidos = new Set();
let primeiraLeituraAgendamentos = true;
let notificacoesAtivas = false;


// =========================================================
// PEDIR PERMISSÃO PARA NOTIFICAÇÕES
// =========================================================

async function prepararNotificacoes() {
    if (!("Notification" in window)) {
        console.log(
            "Este navegador não suporta notificações."
        );

        return;
    }

    if (Notification.permission === "default") {
        const permissao =
            await Notification.requestPermission();

        console.log(
            "Permissão para notificações:",
            permissao
        );
    }

    notificacoesAtivas =
        Notification.permission === "granted";

    console.log(
        "NOTIFICAÇÕES ATIVAS:",
        notificacoesAtivas
    );

    console.log(
        "PERMISSÃO:",
        Notification.permission
    );
}


// =========================================================
// GESTÃO DE CATEGORIAS E SERVIÇOS
// =========================================================

let categoriasServicos = {};
let itensServicos = {};
let servicosAntigosPainel = {};


function identificarCategoriaAntiga(nomeServico) {
    const nome = String(nomeServico || "")
        .trim()
        .toLocaleLowerCase("pt-BR");

    if (
        nome.includes("corte") &&
        nome.includes("barba")
    ) {
        return "Combos";
    }

    if (nome.includes("barba")) {
        return "Barba";
    }

    if (
        nome.includes("acabamento") ||
        nome.includes("pezinho") ||
        nome.includes("sobrancelha")
    ) {
        return "Acabamentos";
    }

    if (
        nome.includes("corte") ||
        nome.includes("degradê") ||
        nome.includes("social") ||
        nome.includes("infantil") ||
        nome.includes("máquina")
    ) {
        return "Cortes";
    }

    return "Outros";
}


function caminhoCategorias() {
    return `${CAMINHO_BARBEIRO}/servicos/categorias`;
}

function caminhoItensServicos() {
    return `${CAMINHO_BARBEIRO}/servicos/itens`;
}


async function garantirCategoriasAntigasNoFirebase() {
    const nomesExistentes = new Set(
        Object.values(categoriasServicos)
            .filter(Boolean)
            .map(categoria =>
                String(categoria.nome || "")
                    .trim()
                    .toLocaleLowerCase("pt-BR")
            )
    );

    for (const nome of Object.keys(servicosAntigosPainel)) {
        const nomeNormalizado = nome
            .trim()
            .toLocaleLowerCase("pt-BR");

        if (nomesExistentes.has(nomeNormalizado)) {
            continue;
        }

        const novaCategoriaRef = push(
            ref(db, caminhoCategorias())
        );

        const novaCategoria = {
            nome,
            criadoEm: new Date().toISOString()
        };

        await update(novaCategoriaRef, novaCategoria);

        categoriasServicos[novaCategoriaRef.key] =
            novaCategoria;

        nomesExistentes.add(nomeNormalizado);

        console.log("Categoria criada:", nome);
    }
}


function mostrarMensagemServicos(texto, erro = false) {
    if (!mensagemServicos) return;

    mensagemServicos.textContent = texto;
    mensagemServicos.style.color = erro ? "#d9534f" : "";
}


function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);

    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;

    return elemento;
}

function escaparHTML(valor) {
    return String(valor).replace(/[&<>"']/g, caractere => {
        const caracteres = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return caracteres[caractere];
    });
}


function formatarPreco(preco) {
    return Number(preco || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}


// =========================================================
// CARREGAR SERVIÇOS
// =========================================================

async function carregarServicos() {
    if (!CAMINHO_BARBEIRO || !listaServicos) return;

    listaServicos.textContent = "Carregando serviços...";

    try {
        const [
            categoriasSnapshot,
            itensSnapshot
        ] = await Promise.all([
            get(ref(db, caminhoCategorias())),
            get(ref(db, caminhoItensServicos()))
        ]);

        categoriasServicos = categoriasSnapshot.exists()
            ? categoriasSnapshot.val()
            : {};

        itensServicos = itensSnapshot.exists()
            ? itensSnapshot.val()
            : {};

        let origemAntiga = [];

        if (Array.isArray(CONFIG_CLIENTE?.servicos)) {
            origemAntiga = CONFIG_CLIENTE.servicos;

        } else if (
            CAMINHO_BARBEIRO === `barbeiros/${CONFIG.id}`
        ) {
            origemAntiga = Array.isArray(CONFIG.servicos)
                ? CONFIG.servicos
                : [];
        }

        const nomesNovos = new Set(
            Object.values(itensServicos)
                .filter(Boolean)
                .map(servico =>
                    String(servico.nome || "")
                        .trim()
                        .toLocaleLowerCase("pt-BR")
                )
        );

        servicosAntigosPainel = {};

        origemAntiga.forEach((servico, indice) => {
            if (!servico?.nome) return;

            const nomeNormalizado = String(servico.nome)
                .trim()
                .toLocaleLowerCase("pt-BR");

            if (nomesNovos.has(nomeNormalizado)) return;

            const categoria = identificarCategoriaAntiga(
                servico.nome
            );

            if (!servicosAntigosPainel[categoria]) {
                servicosAntigosPainel[categoria] = [];
            }

            servicosAntigosPainel[categoria].push({
                id: `antigo-${indice}`,
                nome: servico.nome,
                preco: Number(servico.preco) || 0
            });
        });

        await garantirCategoriasAntigasNoFirebase();

        atualizarSeletorCategorias();
        renderizarServicos();

    } catch (erro) {
        console.error("Erro ao carregar serviços:", erro);

        listaServicos.textContent =
            "Não foi possível carregar os serviços.";

        mostrarMensagemServicos(
            "Erro ao carregar. Verifique a conexão e as permissões do Firebase.",
            true
        );
    }
}


// =========================================================
// SELETOR DE CATEGORIAS
// =========================================================

function atualizarSeletorCategorias() {
    if (!categoriaServico) return;

    categoriaServico.replaceChildren();

    const opcaoInicial = document.createElement("option");
    opcaoInicial.value = "";
    opcaoInicial.textContent = "Selecione uma categoria";

    categoriaServico.appendChild(opcaoInicial);

    Object.entries(categoriasServicos)
        .sort((a, b) =>
            String(a[1]?.nome || "").localeCompare(
                String(b[1]?.nome || ""),
                "pt-BR"
            )
        )
        .forEach(([id, categoria]) => {
            const opcao = document.createElement("option");

            opcao.value = id;
            opcao.textContent =
                categoria.nome || "Categoria sem nome";

            categoriaServico.appendChild(opcao);
        });

    if (salvarServico) {
        salvarServico.disabled =
            Object.keys(categoriasServicos).length === 0;
    }
}


// =========================================================
// RENDERIZAR SERVIÇOS
// =========================================================

function renderizarServicos() {
    if (!listaServicos) return;

    listaServicos.replaceChildren();

    const categorias = Object.entries(categoriasServicos)
        .map(([id, categoria]) => ({
            id,
            nome: categoria.nome || "Sem nome",
            antiga: false
        }));

    Object.keys(servicosAntigosPainel).forEach(nomeCategoria => {
        const jaExiste = categorias.some(categoria =>
            categoria.nome.trim().toLocaleLowerCase("pt-BR") ===
            nomeCategoria.toLocaleLowerCase("pt-BR")
        );

        if (!jaExiste) {
            categorias.push({
                id: `antiga-${nomeCategoria}`,
                nome: nomeCategoria,
                antiga: true
            });
        }
    });

    categorias.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR")
    );

    if (categorias.length === 0) {
        listaServicos.appendChild(
            criarElemento(
                "p",
                "vazio",
                "Nenhum serviço cadastrado."
            )
        );

        return;
    }

    categorias.forEach(categoria => {
        const grupo = criarElemento(
            "div",
            "categoria-servicos"
        );

        const cabecalho = criarElemento(
            "div",
            "cabecalho-categoria"
        );

        const titulo = criarElemento(
            "h3",
            "",
            categoria.nome
        );

        const botoesCategoria = criarElemento(
            "div",
            "acoes-categoria"
        );

        if (!categoria.antiga) {
            const editarCategoria = criarElemento(
                "button",
                "editar-categoria",
                "Editar"
            );

            editarCategoria.type = "button";

            editarCategoria.addEventListener("click", () => {
                editarCategoriaServico(categoria.id);
            });

            const excluirCategoria = criarElemento(
                "button",
                "excluir-categoria",
                "Excluir"
            );

            excluirCategoria.type = "button";

            excluirCategoria.addEventListener("click", () => {
                excluirCategoriaServico(categoria.id);
            });

            botoesCategoria.append(
                editarCategoria,
                excluirCategoria
            );
        }

        cabecalho.append(titulo, botoesCategoria);
        grupo.appendChild(cabecalho);

        const servicosDaCategoria = categoria.antiga
            ? []
            : Object.entries(itensServicos)
                .filter(([, servico]) =>
                    servico &&
                    servico.categoriaId === categoria.id
                )
                .map(([id, servico]) => ({
                    id,
                    nome: servico.nome || "Sem nome",
                    preco: servico.preco,
                    antigo: false
                }));

        const categoriaAntigaCorrespondente =
            Object.keys(servicosAntigosPainel).find(nome =>
                nome.toLocaleLowerCase("pt-BR") ===
                categoria.nome.trim().toLocaleLowerCase("pt-BR")
            );

        if (categoria.antiga) {
            servicosDaCategoria.push(
                ...(servicosAntigosPainel[categoria.nome] || [])
                    .map(servico => ({
                        ...servico,
                        antigo: true
                    }))
            );

        } else if (categoriaAntigaCorrespondente) {
            servicosDaCategoria.push(
                ...(servicosAntigosPainel[
                    categoriaAntigaCorrespondente
                ] || []).map(servico => ({
                    ...servico,
                    antigo: true
                }))
            );
        }

        servicosDaCategoria.sort((a, b) =>
            a.nome.localeCompare(b.nome, "pt-BR")
        );

        if (servicosDaCategoria.length === 0) {
            grupo.appendChild(
                criarElemento(
                    "p",
                    "vazio",
                    "Nenhum serviço nesta categoria."
                )
            );
        }

        servicosDaCategoria.forEach(servico => {
            const linha = criarElemento(
                "div",
                "item-servico"
            );

            const informacoes = criarElemento(
                "div",
                "info-servico"
            );

            const nome = criarElemento(
                "strong",
                "",
                servico.nome
            );

            const preco = criarElemento(
                "span",
                "preco-servico",
                formatarPreco(servico.preco)
            );

            informacoes.append(nome, preco);
            linha.appendChild(informacoes);

            if (servico.antigo) {
                linha.appendChild(
                    criarElemento(
                        "span",
                        "servico-legado",
                        "Serviço existente"
                    )
                );

            } else {
                const acoes = criarElemento(
                    "div",
                    "acoes-servico"
                );

                const editar = criarElemento(
                    "button",
                    "editar-servico",
                    "Editar"
                );

                const excluir = criarElemento(
                    "button",
                    "excluir-servico",
                    "Excluir"
                );

                editar.type = "button";
                excluir.type = "button";

                editar.addEventListener("click", () => {
                    editarItemServico(servico.id);
                });

                excluir.addEventListener("click", () => {
                    excluirItemServico(servico.id);
                });

                acoes.append(editar, excluir);
                linha.appendChild(acoes);
            }

            grupo.appendChild(linha);
        });

        listaServicos.appendChild(grupo);
    });
}


// =========================================================
// CRIAR CATEGORIA
// =========================================================

if (formCategoria) {
    formCategoria.addEventListener("submit", async evento => {
        evento.preventDefault();

        if (!CAMINHO_BARBEIRO) return;

        const nome = nomeCategoria.value.trim();

        if (!nome) {
            mostrarMensagemServicos(
                "Informe o nome da categoria.",
                true
            );

            return;
        }

        const duplicada = Object.values(categoriasServicos).some(
            categoria =>
                String(categoria?.nome || "")
                    .trim()
                    .toLocaleLowerCase("pt-BR") ===
                nome.toLocaleLowerCase("pt-BR")
        );

        if (duplicada) {
            mostrarMensagemServicos(
                "Já existe uma categoria com esse nome.",
                true
            );

            return;
        }

        salvarCategoria.disabled = true;

        try {
            await push(ref(db, caminhoCategorias()), {
                nome,
                criadoEm: new Date().toISOString()
            });

            formCategoria.reset();

            mostrarMensagemServicos(
                "Categoria criada com sucesso."
            );

            await carregarServicos();

        } catch (erro) {
            console.error("Erro ao criar categoria:", erro);

            mostrarMensagemServicos(
                "Não foi possível criar a categoria. Verifique as permissões.",
                true
            );

        } finally {
            salvarCategoria.disabled = false;
        }
    });
}


// =========================================================
// EDITAR CATEGORIA
// =========================================================

async function editarCategoriaServico(categoriaId) {
    const categoria = categoriasServicos[categoriaId];

    if (!categoria) return;

    const novoNome = prompt(
        "Novo nome da categoria:",
        categoria.nome || ""
    );

    if (novoNome === null) return;

    const nome = novoNome.trim();

    if (!nome) {
        mostrarMensagemServicos(
            "O nome não pode ficar vazio.",
            true
        );

        return;
    }

    const duplicada = Object.entries(categoriasServicos).some(
        ([id, item]) =>
            id !== categoriaId &&
            String(item?.nome || "")
                .trim()
                .toLocaleLowerCase("pt-BR") ===
            nome.toLocaleLowerCase("pt-BR")
    );

    if (duplicada) {
        mostrarMensagemServicos(
            "Já existe uma categoria com esse nome.",
            true
        );

        return;
    }

    try {
        await update(
            ref(db, `${caminhoCategorias()}/${categoriaId}`),
            { nome }
        );

        mostrarMensagemServicos("Categoria atualizada.");

        await carregarServicos();

    } catch (erro) {
        console.error("Erro ao editar categoria:", erro);

        mostrarMensagemServicos(
            "Não foi possível editar a categoria.",
            true
        );
    }
}


// =========================================================
// EXCLUIR CATEGORIA
// =========================================================

async function excluirCategoriaServico(categoriaId) {
    const categoria = categoriasServicos[categoriaId];

    if (!categoria) return;

    const possuiServicos = Object.values(itensServicos).some(
        servico => servico?.categoriaId === categoriaId
    );

    if (possuiServicos) {
        mostrarMensagemServicos(
            "Mova ou exclua os serviços desta categoria antes de excluí-la.",
            true
        );

        return;
    }

    if (!confirm(`Excluir a categoria "${categoria.nome}"?`)) {
        return;
    }

    try {
        await remove(
            ref(db, `${caminhoCategorias()}/${categoriaId}`)
        );

        mostrarMensagemServicos("Categoria excluída.");

        await carregarServicos();

    } catch (erro) {
        console.error("Erro ao excluir categoria:", erro);

        mostrarMensagemServicos(
            "Não foi possível excluir a categoria.",
            true
        );
    }
}


// =========================================================
// CRIAR SERVIÇO
// =========================================================

if (formServico) {
    formServico.addEventListener("submit", async evento => {
        evento.preventDefault();

        if (!CAMINHO_BARBEIRO) return;

        const categoriaId = categoriaServico.value;
        const nome = nomeServico.value.trim();
        const preco = Number(precoServico.value);

        if (!categoriasServicos[categoriaId]) {
            mostrarMensagemServicos(
                "Selecione uma categoria válida.",
                true
            );

            return;
        }

        if (
            !nome ||
            !Number.isFinite(preco) ||
            preco < 0 ||
            preco > 99999
        ) {
            mostrarMensagemServicos(
                "Confira o nome e o preço informado.",
                true
            );

            return;
        }

        salvarServico.disabled = true;

        try {
            await push(ref(db, caminhoItensServicos()), {
                nome,
                preco,
                categoriaId,
                criadoEm: new Date().toISOString()
            });

            formServico.reset();

            atualizarSeletorCategorias();

            mostrarMensagemServicos(
                "Serviço adicionado com sucesso."
            );

            await carregarServicos();

        } catch (erro) {
            console.error("Erro ao criar serviço:", erro);

            mostrarMensagemServicos(
                "Não foi possível adicionar o serviço. Verifique as permissões.",
                true
            );

        } finally {
            salvarServico.disabled =
                Object.keys(categoriasServicos).length === 0;
        }
    });
}


// =========================================================
// EDITAR SERVIÇO
// =========================================================

async function editarItemServico(servicoId) {
    const servico = itensServicos[servicoId];

    if (!servico) return;

    const novoNome = prompt(
        "Nome do serviço:",
        servico.nome || ""
    );

    if (novoNome === null) return;

    const nome = novoNome.trim();

    if (!nome) {
        mostrarMensagemServicos(
            "O nome não pode ficar vazio.",
            true
        );

        return;
    }

    const precoAtual = Number(servico.preco || 0);

    const novoPrecoTexto = prompt(
        "Preço do serviço (use ponto para centavos, se necessário):",
        String(precoAtual)
    );

    if (novoPrecoTexto === null) return;

    const preco = Number(novoPrecoTexto);

    if (
        !Number.isFinite(preco) ||
        preco < 0 ||
        preco > 99999
    ) {
        mostrarMensagemServicos(
            "Informe um preço válido.",
            true
        );

        return;
    }

    try {
        await update(
            ref(db, `${caminhoItensServicos()}/${servicoId}`),
            {
                nome,
                preco
            }
        );

        mostrarMensagemServicos("Serviço atualizado.");

        await carregarServicos();

    } catch (erro) {
        console.error("Erro ao editar serviço:", erro);

        mostrarMensagemServicos(
            "Não foi possível editar o serviço.",
            true
        );
    }
}


// =========================================================
// EXCLUIR SERVIÇO
// =========================================================

async function excluirItemServico(servicoId) {
    const servico = itensServicos[servicoId];

    if (!servico) return;

    if (!confirm(`Excluir o serviço "${servico.nome}"?`)) {
        return;
    }

    try {
        await remove(
            ref(db, `${caminhoItensServicos()}/${servicoId}`)
        );

        mostrarMensagemServicos("Serviço excluído.");

        await carregarServicos();

    } catch (erro) {
        console.error("Erro ao excluir serviço:", erro);

        mostrarMensagemServicos(
            "Não foi possível excluir o serviço.",
            true
        );
    }
}


// =========================================================
// AUTENTICAÇÃO
// =========================================================

onAuthStateChanged(auth, async usuario => {
    if (!usuario) {
        window.location.href = "login.html";
        return;
    }

    try {
        const clienteId = await descobrirCliente();

        console.log("CLIENTE IDENTIFICADO:", clienteId);

        CAMINHO_BARBEIRO = `barbeiros/${clienteId}`;

        console.log("CAMINHO DO CLIENTE:", CAMINHO_BARBEIRO);

        await carregarConfiguracaoCliente();
        aplicarConfiguracaoCliente();
        await carregarServicos();
        await prepararNotificacoes();

        console.log("AUTH OK — preparando painel e notificações");
        console.log("TESTE NOTIFICAÇÃO:", Notification.permission);
        console.log("notificacoesAtivas:", notificacoesAtivas);

        await limparHorariosPassados();
        await carregarAgendamentos();
        await carregarHorarios();

        monitorarNovosAgendamentos();

    } catch (erro) {
        console.error("Erro ao identificar cliente:", erro);

        if (mensagem) {
            mensagem.textContent = "Erro ao identificar cliente.";
        }
    }
});


// =========================================================
// MOSTRAR NOTIFICAÇÃO
// =========================================================

function mostrarNotificacaoAgendamento(agendamento) {
    if (!notificacoesAtivas) {
        console.log("NOTIFICAÇÕES DESATIVADAS");
        return;
    }

    console.log(
        "MOSTRANDO NOTIFICAÇÃO REAL:",
        agendamento
    );

    try {
        const nomeBarbeariaAtual =
            CONFIG_CLIENTE?.nome ||
            CONFIG.nome ||
            "Barbearia";

        const titulo =
            `✂️ Novo agendamento — ${nomeBarbeariaAtual}`;

        const corpo =
            `${agendamento.nome || "Cliente"} agendou ${agendamento.servico || "um serviço"} às ${agendamento.horario || "--:--"}.`;

        const notificacao = new Notification(
            titulo,
            {
                body: corpo,
                tag: `novo-${agendamento.data}-${agendamento.horario}-${Date.now()}`,
                renotify: true
            }
        );

        console.log(
            "NOTIFICAÇÃO CRIADA:",
            notificacao
        );

        notificacao.onclick = () => {
            window.focus();
            notificacao.close();
        };

    } catch (erro) {
        console.error(
            "ERRO AO CRIAR NOTIFICAÇÃO:",
            erro
        );
    }
}


// =========================================================
// MONITORAR NOVOS AGENDAMENTOS
// =========================================================

function monitorarNovosAgendamentos() {
    if (!CAMINHO_BARBEIRO) return;

    const agendamentosRef = ref(
        db,
        `${CAMINHO_BARBEIRO}/agendamentos`
    );

    onValue(
        agendamentosRef,
        snapshot => {
            if (!snapshot.exists()) {
                idsAgendamentosConhecidos = new Set();
                primeiraLeituraAgendamentos = false;

                console.log(
                    "Nenhum agendamento encontrado."
                );

                return;
            }

            const dados = snapshot.val();

            const idsAtuais = new Set(
                Object.keys(dados)
            );

            if (primeiraLeituraAgendamentos) {
                idsAgendamentosConhecidos = idsAtuais;
                primeiraLeituraAgendamentos = false;

                console.log(
                    "Monitoramento de agendamentos iniciado."
                );

                return;
            }

            idsAtuais.forEach(id => {
                if (!idsAgendamentosConhecidos.has(id)) {
                    const agendamento = dados[id];

                    if (
                        agendamento &&
                        ["pendente", "confirmado"].includes(
                            String(agendamento.status || "").toLowerCase()
                        )
                    ) {
                        console.log(
                            "NOVO AGENDAMENTO:",
                            agendamento
                        );

                        mostrarNotificacaoAgendamento(
                            agendamento
                        );

                        carregarAgendamentos();
                        carregarHorarios();
                    }
                }
            });

            idsAgendamentosConhecidos = idsAtuais;
        },

        erro => {
            console.error(
                "Erro ao monitorar agendamentos:",
                erro
            );
        }
    );
}


// =========================================================
// SAIR
// =========================================================

if (sair) {
    sair.addEventListener("click", async () => {
        try {
            await signOut(auth);

            window.location.href = "index.html";

        } catch (erro) {
            console.error("Erro ao sair:", erro);

            if (mensagem) {
                mensagem.textContent =
                    "Erro ao sair da conta.";
            }
        }
    });
}


// =========================================================
// CARREGAR AGENDAMENTOS
// =========================================================

async function carregarAgendamentos() {
    if (!CAMINHO_BARBEIRO) return;

    const data = String(
        dataPainel?.value || obterDataHoje()
    );

    if (listaAgendamentos) {
        listaAgendamentos.innerHTML =
            "<p class='vazio'>Carregando...</p>";
    }

    try {
        const snapshot = await get(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/agendamentos`
            )
        );

        console.log("=== DEBUG AGENDAMENTOS ===");

        console.log(
            "CAMINHO:",
            `${CAMINHO_BARBEIRO}/agendamentos`
        );

        console.log("DATA SELECIONADA:", data);
        console.log("SNAPSHOT EXISTE:", snapshot.exists());
        console.log("DADOS RECEBIDOS:", snapshot.val());

        if (!snapshot.exists()) {
            if (listaAgendamentos) {
                listaAgendamentos.innerHTML =
                    "<p class='vazio'>Nenhum agendamento para esta data.</p>";
            }


            return;
        }

        const dados = snapshot.val();

        const todosAgendamentos =
            Object.entries(dados);

        const agendamentos = todosAgendamentos.filter(
            ([id, agendamento]) => {
                if (!agendamento) return false;

                const dataAgendamento =
                    String(agendamento.data || "");

                const status =
                    String(agendamento.status || "").toLowerCase();

                if (dataAgendamento !== data) return false;

                if (abaAtualAgendamentos === "ativos") {
                    return (
                        status !== "cancelado" &&
                        status !== "realizado"
                    );
                }

                if (abaAtualAgendamentos === "realizados") {
                    return status === "realizado";
                }

                if (abaAtualAgendamentos === "cancelados") {
                    return status === "cancelado";
                }

                return false;
            }
        );

        console.log(
            "AGENDAMENTOS FILTRADOS:",
            agendamentos
        );

        agendamentos.sort(
            ([, agendamentoA], [, agendamentoB]) => {
                const horarioA =
                    String(agendamentoA?.horario || "99:99");

                const horarioB =
                    String(agendamentoB?.horario || "99:99");

                return horarioA.localeCompare(horarioB);
            }
        );


        if (agendamentos.length === 0) {
            if (listaAgendamentos) {
                listaAgendamentos.innerHTML =
                    "<p class='vazio'>Nenhum agendamento para esta data.</p>";
            }

            return;
        }

        if (listaAgendamentos) {
            listaAgendamentos.innerHTML = "";
        }

        agendamentos.forEach(([id, agendamento]) => {
            if (!listaAgendamentos) return;

            const card = document.createElement("div");
            card.className = "agendamento";

            const horario =
                String(agendamento.horario || "--:--");

            const nome =
                String(agendamento.nome || "Cliente");

            const servico =
                String(agendamento.servico || "Não informado");

            const telefoneOriginal =
                String(agendamento.telefone || "");

            const telefone =
                telefoneOriginal.replace(/\D/g, "");

            let whatsapp = telefone;

            if (whatsapp && !whatsapp.startsWith("55")) {
                whatsapp = "55" + whatsapp;
            }

            let linkWhatsApp = "#";

            if (whatsapp) {
                linkWhatsApp =
                    `https://wa.me/${whatsapp}`;
            }

            card.innerHTML = `
                <div class="horario">
                    ${escaparHTML(horario)}
                </div>

                <div class="cliente">
                   ${escaparHTML(nome)}
                </div>

                <div class="detalhes-agendamento">
                    <div>
                        <span>Serviço</span>
                        <strong>${escaparHTML(servico)}</strong>
                    </div>

                    <div>
                        <span>WhatsApp</span>
                        <strong>${escaparHTML(telefoneOriginal) || "Não informado"}</strong>
                    </div>
                </div>

                <div class="botoes">
                    ${
                        whatsapp
                            ? `
                                <a
                                    class="whatsapp"
                                    href="${linkWhatsApp}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    WhatsApp ↗
                                </a>
                            `
                            : `
                                <span class="whatsapp" style="opacity:0.5;">
                                    Sem WhatsApp
                                </span>
                            `
                    }

                    ${
                        abaAtualAgendamentos === "ativos"
                            ? `
                                <button class="realizar" type="button">
                                    Marcar como realizado
                                </button>

                                <button class="cancelar" type="button">
                                    Cancelar
                                </button>
                            `
                            : `
                                <button
                                    class="excluir-agendamento"
                                    type="button"
                                >
                                    🗑 Remover
                                </button>
                            `
                    }
                </div>
            `;

            const botaoRealizar =
                card.querySelector(".realizar");

            if (botaoRealizar) {
                botaoRealizar.addEventListener("click", () => {
                    concluirAgendamento(id);
                });
            }

            const botaoExcluir =
                card.querySelector(".excluir-agendamento");

            if (botaoExcluir) {
                botaoExcluir.addEventListener("click", () => {
                    console.log(
                        "BOTÃO EXCLUIR CLICADO:",
                        id
                    );

                    excluirAgendamento(id, agendamento);
                });
            }

            const botaoCancelar =
                card.querySelector(".cancelar");

            if (botaoCancelar) {
                botaoCancelar.addEventListener("click", () => {
                    cancelarAgendamento(
                        id,
                        agendamento.data,
                        agendamento.horario,
                        agendamento
                    );
                });
            }

            listaAgendamentos.appendChild(card);
        });

        console.log(
            "CARDS CRIADOS:",
            listaAgendamentos
                ? listaAgendamentos.children.length
                : 0
        );

        console.log(
            "TOTAL AGENDAMENTOS NA ABA:",
            agendamentos.length
        );

    } catch (erro) {
        console.error(
            "Erro ao carregar agendamentos:",
            erro
        );

        if (listaAgendamentos) {
            listaAgendamentos.innerHTML =
                "<p class='vazio'>Erro ao carregar agendamentos.</p>";
        }
    }
}


// =========================================================
// CARREGAR HORÁRIOS
// =========================================================

async function carregarHorarios() {
    if (!CAMINHO_BARBEIRO) return;

    const data = String(
        dataPainel?.value || obterDataHoje()
    );

    if (listaHorarios) {
        listaHorarios.innerHTML =
            "<p class='vazio'>Carregando...</p>";
    }

    try {
        const horariosSnapshot = await get(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/horarios/${data}`
            )
        );

        const agendamentosSnapshot = await get(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/agendamentos`
            )
        );

        const horarios = horariosSnapshot.exists()
            ? Object.entries(horariosSnapshot.val())
            : [];

        const agendamentos = agendamentosSnapshot.exists()
            ? Object.values(agendamentosSnapshot.val())
            : [];

        const horariosOcupados = agendamentos
            .filter(agendamento => {
                return (
                    String(agendamento?.data || "") === data &&
                    !["cancelado", "recusado", "realizado"].includes(
                        String(agendamento?.status || "").toLowerCase()
                    )
                );
            })
            .map(agendamento =>
                String(agendamento.horario || "")
            );

        const horariosConcluidos = agendamentos
            .filter(agendamento =>
                String(agendamento?.data || "") === data &&
                String(agendamento?.status || "").toLowerCase() === "realizado"
            )
            .map(agendamento =>
                String(agendamento.horario || "")
            );

        horarios.sort(([horarioA], [horarioB]) => {
            const [horaA, minutoA] =
                String(horarioA).split(":").map(Number);

            const [horaB, minutoB] =
                String(horarioB).split(":").map(Number);

            const minutosA = horaA * 60 + minutoA;
            const minutosB = horaB * 60 + minutoB;

            return minutosA - minutosB;
        });

        console.log("========== DEBUG HORÁRIOS ==========");
        console.log("DATA:", data);
        console.log("HORÁRIOS ENCONTRADOS:", horarios);
        console.log("HORÁRIOS OCUPADOS:", horariosOcupados);
        console.log("HORÁRIOS CONCLUÍDOS:", horariosConcluidos);
        console.log("TOTAL DE HORÁRIOS:", horarios.length);
        console.log("====================================");

        let quantidadeDisponiveis = 0;
        let quantidadeOcupados = 0;

        horarios.forEach(([horario, dados]) => {
            const horarioString = String(horario);

            const ocupado =
                horariosOcupados.includes(horarioString);

            if (horariosConcluidos.includes(horarioString)) {
                return;
            }

            if (ocupado) {
                quantidadeOcupados++;
                return;
            }

            if (dados && dados.disponivel === true) {
                quantidadeDisponiveis++;
            } else {
                quantidadeOcupados++;
            }
        });

        console.log("========== RESUMO ==========");
        console.log("Total:", horarios.length);
        console.log("Disponíveis:", quantidadeDisponiveis);
        console.log("Ocupados:", quantidadeOcupados);
        console.log(
            "Soma:",
            quantidadeDisponiveis + quantidadeOcupados
        );
        console.log("============================");

        const elementoAgendados =
            document.getElementById("totalAgendados");

        const elementoDisponiveis =
            document.getElementById("totalDisponiveis");

        const elementoOcupados =
            document.getElementById("totalOcupados");

        // Agendados: inclui realizados, mas não cancelados.
        if (elementoAgendados) {
            const quantidadeAgendados =
                agendamentos.filter(agendamento =>
                    String(agendamento?.data || "") === data &&
                    String(agendamento?.status || "").toLowerCase() !==
                        "cancelado"
                ).length;

            elementoAgendados.textContent =
                String(quantidadeAgendados);

            elementoAgendados.style.display = "block";
            elementoAgendados.style.visibility = "visible";
            elementoAgendados.style.opacity = "1";
        }

        if (elementoDisponiveis) {
            elementoDisponiveis.textContent =
                String(quantidadeDisponiveis);

            elementoDisponiveis.style.display = "block";
            elementoDisponiveis.style.visibility = "visible";
            elementoDisponiveis.style.opacity = "1";
        }

        if (elementoOcupados) {
            elementoOcupados.textContent =
                String(quantidadeOcupados);

            elementoOcupados.style.display = "block";
            elementoOcupados.style.visibility = "visible";
            elementoOcupados.style.opacity = "1";
        }

        console.log("========== CONTADORES DOM ==========");
        console.log("Agendados:", elementoAgendados?.textContent);
        console.log("Disponíveis:", elementoDisponiveis?.textContent);
        console.log("Ocupados:", elementoOcupados?.textContent);
        console.log("====================================");

        if (listaHorarios) {
            listaHorarios.innerHTML = "";
        }

        if (horarios.length === 0) {
            if (listaHorarios) {
                listaHorarios.innerHTML =
                    "<p class='vazio'>Nenhum horário cadastrado para esta data.</p>";
            }

            return;
        }

        horarios.forEach(([horario, dados]) => {
            const horarioString = String(horario);

            const ocupado =
                horariosOcupados.includes(horarioString);

            const concluido =
                horariosConcluidos.includes(horarioString);

            const disponivel =
                !ocupado &&
                !concluido &&
                dados &&
                dados.disponivel === true;

            const card = document.createElement("div");
            card.className = "horario-card";

            card.innerHTML = `
    <strong>${escaparHTML(horarioString)}</strong>  

                <span class="${
                    disponivel ? "disponivel" : "ocupado"
                }">
                    ${
                        disponivel
                            ? "Disponível"
                            : concluido
                                ? "Concluído"
                                : "Ocupado"
                    }
                </span>

                ${
                    disponivel
                        ? `
                            <button
                                class="remover-horario"
                                type="button"
                            >
                                Remover
                            </button>
                        `
                        : ""
                }
            `;

            if (listaHorarios) {
                listaHorarios.appendChild(card);
            }

            const botaoRemover =
                card.querySelector(".remover-horario");

            if (botaoRemover) {
                botaoRemover.addEventListener("click", () => {
                    removerHorario(data, horario);
                });
            }
        });

    } catch (erro) {
        console.error(
            "Erro ao carregar horários:",
            erro
        );

        if (listaHorarios) {
            listaHorarios.innerHTML =
                "<p class='vazio'>Erro ao carregar horários.</p>";
        }
    }
}


// =========================================================
// MODAL PERSONALIZADO DE CANCELAMENTO
// =========================================================

function confirmarCancelamento(agendamento) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");

        overlay.className = "modal-cancelamento";

        overlay.innerHTML = `
            <div class="modal-cancelamento-caixa">
                <div class="modal-cancelamento-icone">!</div>

                <h2>Cancelar agendamento?</h2>

                <p class="modal-cancelamento-descricao">
                    Você está prestes a cancelar este atendimento.
                </p>

                <div class="modal-cancelamento-detalhes">
                    <div>
                        <span>Cliente</span>
                        <strong class="modal-cliente"></strong>
                    </div>

                    <div>
                        <span>Serviço</span>
                        <strong class="modal-servico"></strong>
                    </div>

                    <div>
                        <span>Data</span>
                        <strong class="modal-data"></strong>
                    </div>

                    <div>
                        <span>Horário</span>
                        <strong class="modal-horario"></strong>
                    </div>
                </div>

                <p class="modal-cancelamento-aviso">
                    O horário será liberado para outros clientes.
                </p>

                <div class="modal-cancelamento-acoes">
                    <button class="modal-voltar" type="button">
                        Voltar
                    </button>

                    <button class="modal-confirmar" type="button">
                        Sim, cancelar
                    </button>
                </div>
            </div>
        `;

        const estilo = document.createElement("style");

        estilo.textContent = `
            .modal-cancelamento {
                position: fixed;
                inset: 0;
                z-index: 99999;
                background: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(6px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: aparecerModal .2s ease;
            }

            .modal-cancelamento-caixa {
                width: 100%;
                max-width: 430px;
                background: #171717;
                border: 1px solid #333;
                border-radius: 20px;
                padding: 28px;
                color: white;
                box-shadow: 0 20px 70px rgba(0,0,0,.5);
                animation: subirModal .25s ease;
            }

            .modal-cancelamento-icone {
                width: 48px;
                height: 48px;
                display: grid;
                place-items: center;
                border-radius: 14px;
                background: rgba(220, 60, 60, .13);
                color: #ff6464;
                font-size: 26px;
                font-weight: bold;
                margin-bottom: 18px;
            }

            .modal-cancelamento-caixa h2 {
                margin: 0 0 8px;
                font-size: 23px;
            }

            .modal-cancelamento-descricao {
                color: #aaa;
                font-size: 14px;
                margin-bottom: 22px;
            }

            .modal-cancelamento-detalhes {
                background: #202020;
                border: 1px solid #333;
                border-radius: 13px;
                padding: 16px;
                display: grid;
                gap: 15px;
            }

            .modal-cancelamento-detalhes div {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .modal-cancelamento-detalhes span {
                color: #999;
                font-size: 12px;
            }

            .modal-cancelamento-detalhes strong {
                font-size: 14px;
                overflow-wrap: anywhere;
            }

            .modal-cancelamento-aviso {
                color: #e5b75c;
                font-size: 12px;
                margin: 17px 0 22px;
            }

            .modal-cancelamento-acoes {
                display: flex;
                gap: 10px;
            }

            .modal-cancelamento-acoes button {
                flex: 1;
                border: none;
                border-radius: 10px;
                padding: 13px 10px;
                font-weight: 600;
                cursor: pointer;
                transition: .2s;
            }

            .modal-voltar {
                background: #303030;
                color: white;
            }

            .modal-voltar:hover {
                background: #414141;
            }

            .modal-confirmar {
                background: #d94343;
                color: white;
            }

            .modal-confirmar:hover {
                background: #f05252;
            }

            @keyframes aparecerModal {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes subirModal {
                from {
                    opacity: 0;
                    transform: translateY(15px) scale(.97);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @media (max-width: 480px) {
                .modal-cancelamento-caixa {
                    padding: 22px;
                }

                .modal-cancelamento-acoes {
                    flex-direction: column-reverse;
                }
            }
        `;

        document.head.appendChild(estilo);

        overlay.querySelector(".modal-cliente").textContent =
            agendamento.nome || "Não informado";

        overlay.querySelector(".modal-servico").textContent =
            agendamento.servico || "Não informado";

        overlay.querySelector(".modal-data").textContent =
            agendamento.data || "Não informada";

        overlay.querySelector(".modal-horario").textContent =
            agendamento.horario || "Não informado";

        document.body.appendChild(overlay);

        function fechar(resultado) {
            overlay.remove();
            estilo.remove();
            document.removeEventListener("keydown", teclaEscape);
            resolve(resultado);
        }

        overlay.querySelector(".modal-voltar")
            .addEventListener("click", () => fechar(false));

        overlay.querySelector(".modal-confirmar")
            .addEventListener("click", () => fechar(true));

        overlay.addEventListener("click", evento => {
            if (evento.target === overlay) {
                fechar(false);
            }
        });

        const teclaEscape = evento => {
            if (evento.key === "Escape") {
                fechar(false);
            }
        };

        document.addEventListener("keydown", teclaEscape);
    });
}


// =========================================================
// CONCLUIR AGENDAMENTO
// =========================================================

async function concluirAgendamento(id) {
    if (!CAMINHO_BARBEIRO) return;

    const confirmar = window.confirm(
        "Deseja marcar este agendamento como realizado?"
    );

    if (!confirmar) return;

    try {
        await update(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/agendamentos/${id}`
            ),
            {
                status: "realizado"
            }
        );

        if (mensagem) {
            mensagem.textContent =
                "Agendamento marcado como realizado!";
        }

        await carregarAgendamentos();
        await carregarHorarios();

    } catch (erro) {
        console.error(
            "Erro ao concluir agendamento:",
            erro
        );

        if (mensagem) {
            mensagem.textContent =
                "Erro ao marcar o agendamento como realizado.";
        }
    }
}


// =========================================================
// CANCELAR AGENDAMENTO
// =========================================================
    
async function cancelarAgendamento(id, data, horario, agendamento) {
    if (!CAMINHO_BARBEIRO) return;

    const confirmar = await confirmarCancelamento(agendamento);

    if (!confirmar) return;

    try {
        const horarioRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}`
        );

        // Confere a quem pertence atualmente o horário.
        const snapshotHorario = await get(horarioRef);

        const dadosHorario = snapshotHorario.exists()
            ? snapshotHorario.val()
            : null;

        // O status sempre será atualizado.
        const atualizacoes = {
            [`${CAMINHO_BARBEIRO}/agendamentos/${id}/status`]:
                "cancelado"
        };

        // Só libera o horário se ele pertencer a este agendamento.
        if (
            dadosHorario &&
            dadosHorario.agendamentoId === id
        ) {
            atualizacoes[
                `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}/disponivel`
            ] = true;

            atualizacoes[
                `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}/reservadoPor`
            ] = null;

            atualizacoes[
                `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}/agendamentoId`
            ] = null;

        } else {
            console.warn(
                "O horário não pertence mais a este agendamento. Não será liberado.",
                { id, data, horario, dadosHorario }
            );
        }

        // Atualiza tudo em uma única operação.
        await update(ref(db), atualizacoes);

        console.log("AGENDAMENTO CANCELADO:", id);

        if (
            dadosHorario &&
            dadosHorario.agendamentoId === id
        ) {
            console.log("HORÁRIO LIBERADO:", data, horario);
        }

        await carregarAgendamentos();
        await carregarHorarios();

    } catch (erro) {
        console.error("Erro ao cancelar agendamento:", erro);

        alert(
            "Não foi possível cancelar o agendamento. Tente novamente."
        );
    }
}



// =========================================================
// MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
// =========================================================

function confirmarExclusao(agendamento) {

    return new Promise((resolve) => {

        const overlay = document.createElement("div");

        overlay.className = "modal-exclusao";

        overlay.innerHTML = `
            <div class="modal-exclusao-caixa">

                <div class="modal-exclusao-icone">!</div>

                <h2>Remover agendamento?</h2>

                <p class="modal-exclusao-descricao">
                    Essa ação removerá permanentemente o registro.
                </p>

                <div class="modal-exclusao-detalhes">

                    <div>
                        <span>Cliente</span>
                        <strong class="exclusao-cliente"></strong>
                    </div>

                    <div>
                        <span>Serviço</span>
                        <strong class="exclusao-servico"></strong>
                    </div>

                    <div>
                        <span>Data</span>
                        <strong class="exclusao-data"></strong>
                    </div>

                    <div>
                        <span>Horário</span>
                        <strong class="exclusao-horario"></strong>
                    </div>

                </div>

                <p class="modal-exclusao-aviso">
                    Esta operação não poderá ser desfeita.
                </p>

                <div class="modal-exclusao-acoes">

                    <button class="exclusao-voltar" type="button">
                        Voltar
                    </button>

                    <button class="exclusao-confirmar" type="button">
                        Sim, remover
                    </button>

                </div>

            </div>
        `;

        const estilo = document.createElement("style");

        estilo.textContent = `
            .modal-exclusao {
                position: fixed;
                inset: 0;
                z-index: 99999;
                background: rgba(0,0,0,.75);
                backdrop-filter: blur(6px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: aparecerModal .2s ease;
            }

            .modal-exclusao-caixa {
                width: 100%;
                max-width: 430px;
                background: #171717;
                border: 1px solid #333;
                border-radius: 20px;
                padding: 28px;
                color: white;
                box-shadow: 0 20px 70px rgba(0,0,0,.5);
                animation: subirModal .25s ease;
            }

            .modal-exclusao-icone {
                width: 48px;
                height: 48px;
                display: grid;
                place-items: center;
                border-radius: 14px;
                background: rgba(220,60,60,.13);
                color: #ff6464;
                font-size: 26px;
                font-weight: bold;
                margin-bottom: 18px;
            }

            .modal-exclusao-caixa h2 {
                margin: 0 0 8px;
                font-size: 23px;
            }

            .modal-exclusao-descricao {
                color: #aaa;
                font-size: 14px;
                margin-bottom: 22px;
            }

            .modal-exclusao-detalhes {
                background: #202020;
                border: 1px solid #333;
                border-radius: 13px;
                padding: 16px;
                display: grid;
                gap: 15px;
            }

            .modal-exclusao-detalhes div {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .modal-exclusao-detalhes span {
                color: #999;
                font-size: 12px;
            }

            .modal-exclusao-detalhes strong {
                font-size: 14px;
                overflow-wrap: anywhere;
            }

            .modal-exclusao-aviso {
                color: #e5b75c;
                font-size: 12px;
                margin: 17px 0 22px;
            }

            .modal-exclusao-acoes {
                display: flex;
                gap: 10px;
            }

            .modal-exclusao-acoes button {
                flex: 1;
                border: none;
                border-radius: 10px;
                padding: 13px 10px;
                font-weight: 600;
                cursor: pointer;
                transition: .2s;
            }

            .exclusao-voltar {
                background: #303030;
                color: white;
            }

            .exclusao-voltar:hover {
                background: #414141;
            }

            .exclusao-confirmar {
                background: #d94343;
                color: white;
            }

            .exclusao-confirmar:hover {
                background: #f05252;
            }

            @media (max-width: 480px) {
                .modal-exclusao-caixa {
                    padding: 22px;
                }

                .modal-exclusao-acoes {
                    flex-direction: column-reverse;
                }
            }
        `;

        document.head.appendChild(estilo);

        overlay.querySelector(".exclusao-cliente").textContent =
            agendamento.nome || "Não informado";

        overlay.querySelector(".exclusao-servico").textContent =
            agendamento.servico || "Não informado";

        overlay.querySelector(".exclusao-data").textContent =
            agendamento.data || "Não informada";

        overlay.querySelector(".exclusao-horario").textContent =
            agendamento.horario || "Não informado";

        document.body.appendChild(overlay);

        function fechar(resultado) {
            overlay.remove();
            estilo.remove();
            document.removeEventListener("keydown", teclaEscape);
            resolve(resultado);
        }

        overlay.querySelector(".exclusao-voltar")
            .addEventListener("click", () => fechar(false));

        overlay.querySelector(".exclusao-confirmar")
            .addEventListener("click", () => fechar(true));

        overlay.addEventListener("click", (evento) => {
            if (evento.target === overlay) {
                fechar(false);
            }
        });

        const teclaEscape = (evento) => {
            if (evento.key === "Escape") {
                fechar(false);
            }
        };

        document.addEventListener("keydown", teclaEscape);
    });
}

// =========================================================
// EXCLUIR AGENDAMENTO CONCLUÍDO OU CANCELADO
// =========================================================

async function excluirAgendamento(id, agendamento) {
    const status = String(
        agendamento?.status || ""
    ).toLowerCase();

    if (!["realizado", "cancelado"].includes(status)) {
        if (mensagem) {
            mensagem.textContent =
                "Só é possível remover agendamentos realizados ou cancelados.";
        }

        return;
    }

    const confirmar = await confirmarExclusao(agendamento);

    if (!confirmar) return;

    try {
        await remove(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/agendamentos/${id}`
            )
        );

        if (mensagem) {
            mensagem.textContent =
                "Agendamento removido com sucesso!";
        }

        await carregarAgendamentos();
        await carregarHorarios();

    } catch (erro) {
        console.error(
            "Erro ao remover agendamento:",
            erro
        );

        if (mensagem) {
            mensagem.textContent =
                "Erro ao remover o agendamento.";
        }
    }
}


// =========================================================
// ADICIONAR HORÁRIO MANUALMENTE
// =========================================================

if (adicionarHorario) {
    adicionarHorario.addEventListener("click", async () => {
        if (!CAMINHO_BARBEIRO) return;

        const data = dataPainel.value;
        const horario = novoHorario.value;

        if (!data || !horario) {
            if (mensagem) {
                mensagem.textContent =
                    "Escolha um horário.";
            }

            return;
        }

        try {
            const horarioRef = ref(
                db,
                `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}`
            );

            const snapshot = await get(horarioRef);

            if (snapshot.exists()) {
                if (mensagem) {
                    mensagem.textContent =
                        "Esse horário já existe.";
                }

                return;
            }

            await update(horarioRef, {
                disponivel: true
            });

            novoHorario.value = "";

            if (mensagem) {
                mensagem.textContent =
                    "✓ Horário adicionado.";
            }

            await carregarHorarios();

        } catch (erro) {
            console.error(
                "Erro ao adicionar horário:",
                erro
            );

            if (mensagem) {
                mensagem.textContent =
                    "Erro ao adicionar horário.";
            }
        }
    });
}


// =========================================================
// GERAR HORÁRIOS AUTOMATICAMENTE
// =========================================================

if (gerarHorarios) {
    gerarHorarios.addEventListener("click", async () => {
        if (!CAMINHO_BARBEIRO) return;

        const inicio = horaInicio.value;
        const fim = horaFim.value;

        const intervalo = Number(
            intervaloHorario.value
        );

        const pausaInicioValor = pausaInicio.value;
        const pausaFimValor = pausaFim.value;

        if (!inicio || !fim) {
            if (mensagem) {
                mensagem.textContent =
                    "Preencha o início e o fim.";
            }

            return;
        }

        if (!intervalo || intervalo <= 0) {
            if (mensagem) {
                mensagem.textContent =
                    "Escolha um intervalo válido.";
            }

            return;
        }

        const inicioPartes = inicio.split(":").map(Number);
        const fimPartes = fim.split(":").map(Number);

        const inicioMinutos =
            inicioPartes[0] * 60 + inicioPartes[1];

        const fimMinutos =
            fimPartes[0] * 60 + fimPartes[1];

        if (inicioMinutos >= fimMinutos) {
            if (mensagem) {
                mensagem.textContent =
                    "O horário final deve ser maior que o inicial.";
            }

            return;
        }

        let pausaInicioMinutos = null;
        let pausaFimMinutos = null;

        if (pausaInicioValor && pausaFimValor) {
            const pausaInicioPartes =
                pausaInicioValor.split(":").map(Number);

            const pausaFimPartes =
                pausaFimValor.split(":").map(Number);

            pausaInicioMinutos =
                pausaInicioPartes[0] * 60 +
                pausaInicioPartes[1];

            pausaFimMinutos =
                pausaFimPartes[0] * 60 +
                pausaFimPartes[1];

            if (pausaInicioMinutos >= pausaFimMinutos) {
                if (mensagem) {
                    mensagem.textContent =
                        "O fim da pausa deve ser maior que o início.";
                }

                return;
            }
        }

        try {
            gerarHorarios.disabled = true;

            if (mensagem) {
                mensagem.textContent =
                    "Gerando horários para 7 dias...";
            }

           
const atualizacoes = {};
let totalHorarios = 0;

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

for (let dia = 0; dia < 7; dia++) {
    const data = new Date(hoje);

    data.setDate(hoje.getDate() + dia);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const numeroDia = String(data.getDate()).padStart(2, "0");

    const dataFirebase = `${ano}-${mes}-${numeroDia}`;

    // Lê os horários que já existem nessa data
    const snapshotHorarios = await get(
        ref(db, `${CAMINHO_BARBEIRO}/horarios/${dataFirebase}`)
    );

    const horariosExistentes = snapshotHorarios.exists()
        ? snapshotHorarios.val()
        : {};

    for (
        let minutos = inicioMinutos;
        minutos < fimMinutos;
        minutos += intervalo
    ) {
        if (
            pausaInicioMinutos !== null &&
            pausaFimMinutos !== null &&
            minutos >= pausaInicioMinutos &&
            minutos < pausaFimMinutos
        ) {
            continue;
        }

        const hora = Math.floor(minutos / 60);
        const minuto = minutos % 60;

        const horario =
            `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;

        // Só cria o horário se ele ainda não existir
        if (
            !Object.prototype.hasOwnProperty.call(
                horariosExistentes,
                horario
            )
        ) {
            const caminho =
                `${CAMINHO_BARBEIRO}/horarios/${dataFirebase}/${horario}/disponivel`;

            atualizacoes[caminho] = true;
            totalHorarios++;
        }
    }
}

if (Object.keys(atualizacoes).length > 0) {
    await update(ref(db), atualizacoes);
}

            if (mensagem) {
                mensagem.textContent =
                    `✓ 7 dias gerados com sucesso. ${totalHorarios} horários criados.`;
            }

            await carregarAgendamentos();
            await carregarHorarios();

        } catch (erro) {
            console.error(
                "ERRO AO GERAR:",
                erro
            );

            if (mensagem) {
                mensagem.textContent =
                    "Erro ao gerar os horários. Veja o console.";
            }

        } finally {
            gerarHorarios.disabled = false;
        }
    });
}


// =========================================================
// BOTÃO ATUALIZAR
// =========================================================

if (atualizar) {
    atualizar.addEventListener("click", async () => {
        await carregarAgendamentos();
        await carregarHorarios();
    });
}


// =========================================================
// TROCAR DATA
// =========================================================

if (dataPainel) {
    dataPainel.addEventListener("change", async () => {
        await carregarAgendamentos();
        await carregarHorarios();
    });
}


// =========================================================
// REMOVER HORÁRIO
// =========================================================

async function removerHorario(data, horario) {
    const confirmar = confirm(
        `Remover o horário ${horario}?`
    );

    if (!confirmar) return;

    try {
        const horarioRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}`
        );

        await remove(horarioRef);

        const verificar = await get(horarioRef);

        if (verificar.exists()) {
            if (mensagem) {
                mensagem.textContent =
                    "Não foi possível remover o horário.";
            }

            return;
        }

        if (mensagem) {
            mensagem.textContent =
                "✓ Horário removido.";
        }

        await carregarHorarios();

    } catch (erro) {
        console.error(
            "Erro ao remover horário:",
            erro
        );

        if (mensagem) {
            mensagem.textContent =
                "Erro ao remover horário.";
        }
    }
}
