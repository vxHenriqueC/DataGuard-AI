/* =====================================
   DATAGUARD AI
   FRONTEND CONTROLLER
===================================== */


/* =====================================
   ESTADO DA APLICAÇÃO
===================================== */

const state = {

    filesAnalyzed: 0,

    risksFound: 0,

    alerts: 0,

    protection: 0,

    lastFile: null,

    lastRisk: null

};


/* =====================================
   ELEMENTOS
===================================== */

const app =
    document.getElementById("app");

const pageTitle =
    document.getElementById("page-title");

const navigation =
    document.querySelectorAll("nav a");


/* =====================================
   INPUT DE ARQUIVO
===================================== */

const fileInput =
    document.createElement("input");

fileInput.type = "file";

fileInput.accept =
    ".csv,.xlsx,.json,.txt,.pdf";

fileInput.style.display = "none";

document.body.appendChild(fileInput);


/* =====================================
   PÁGINAS
===================================== */

const pages = {


    /* =================================
       DASHBOARD
    ================================= */

    dashboard: {

        title: "Dashboard",

        content: () => `

            <section class="page">

                <span class="section-label">
                    VISÃO GERAL
                </span>

                <h2>
                    Dashboard
                </h2>

                <p class="page-description">
                    Visão geral da segurança dos seus dados.
                </p>


                <div class="stats">


                    <div class="stat-card">

                        <div class="stat-icon blue">
                            ◈
                        </div>

                        <div>

                            <span>
                                Arquivos analisados
                            </span>

                            <strong>
                                ${state.filesAnalyzed}
                            </strong>

                        </div>

                    </div>


                    <div class="stat-card">

                        <div class="stat-icon red">
                            !
                        </div>

                        <div>

                            <span>
                                Riscos encontrados
                            </span>

                            <strong>
                                ${state.risksFound}
                            </strong>

                        </div>

                    </div>


                    <div class="stat-card">

                        <div class="stat-icon yellow">
                            ⚠
                        </div>

                        <div>

                            <span>
                                Alertas
                            </span>

                            <strong>
                                ${state.alerts}
                            </strong>

                        </div>

                    </div>


                    <div class="stat-card">

                        <div class="stat-icon green">
                            ✓
                        </div>

                        <div>

                            <span>
                                Dados protegidos
                            </span>

                            <strong>
                                ${state.protection}%
                            </strong>

                        </div>

                    </div>


                </div>


                <div class="content-grid">


                    <div class="panel">

                        <span class="section-label">
                            ANÁLISE
                        </span>

                        <h3>
                            Analisar dados
                        </h3>

                        <p>
                            Envie um arquivo para identificar
                            possíveis riscos de segurança.
                        </p>


                        <div
                            class="upload-area"
                            id="dashboardUpload"
                        >

                            <div class="upload-icon">
                                ↑
                            </div>

                            <h3>
                                Envie um arquivo
                            </h3>

                            <p>
                                CSV, XLSX, JSON, TXT ou PDF
                            </p>

                            <button
                                class="upload-button"
                                id="dashboardUploadButton"
                            >
                                Selecionar arquivo
                            </button>

                        </div>

                    </div>


                    <div class="panel">

                        <span class="section-label">
                            SEGURANÇA
                        </span>

                        <h3>
                            Nível de risco
                        </h3>


                        <div
                            class="risk-circle"
                            id="dashboardRisk"
                        >

                            <strong>
                                ${state.lastRisk
                                    ? state.lastRisk.score
                                    : "--"}
                            </strong>

                            <span>
                                ${state.lastRisk
                                    ? state.lastRisk.level
                                    : "Sem análise"}
                            </span>

                        </div>


                        <div class="risk-info">

                            <div>
                                <span
                                    class="risk-indicator"
                                    style="background:#22c55e"
                                ></span>

                                Baixo
                            </div>

                            <div>
                                <span
                                    class="risk-indicator"
                                    style="background:#f59e0b"
                                ></span>

                                Médio
                            </div>

                            <div>
                                <span
                                    class="risk-indicator"
                                    style="background:#ef4444"
                                ></span>

                                Alto
                            </div>

                        </div>

                    </div>


                </div>


            </section>

        `
    },


    /* =================================
       ANÁLISE
    ================================= */

    analysis: {

        title: "Analisar Dados",

        content: () => `

            <section class="page">

                <span class="section-label">
                    ANÁLISE
                </span>

                <h2>
                    Analisar Dados
                </h2>

                <p class="page-description">
                    Envie um arquivo para o DataGuard AI
                    identificar possíveis dados sensíveis.
                </p>


                <div
                    class="panel"
                    style="max-width:900px"
                >

                    <div
                        class="upload-area"
                        id="mainUpload"
                    >

                        <div class="upload-icon">
                            ↑
                        </div>

                        <h3>
                            Arraste seu arquivo aqui
                        </h3>

                        <p>
                            ou selecione um arquivo
                        </p>

                        <button
                            class="upload-button"
                            id="mainUploadButton"
                        >
                            Selecionar arquivo
                        </button>

                        <small>
                            CSV · XLSX · JSON · TXT · PDF
                        </small>

                    </div>

                </div>


                <div
                    id="analysisStatus"
                    style="margin-top:20px"
                ></div>


            </section>

        `
    },


    /* =================================
       RESULTADOS
    ================================= */

    results: {

        title: "Resultados",

        content: () => `

            <section class="page">

                <span class="section-label">
                    SEGURANÇA
                </span>

                <h2>
                    Resultados
                </h2>

                <p class="page-description">
                    Veja os riscos identificados pelo DataGuard AI.
                </p>


                <div class="result-grid">


                    <div class="result-card">

                        <span>
                            Nível de risco
                        </span>

                        <strong class="risk-high">

                            ${
                                state.lastRisk
                                    ? state.lastRisk.level
                                    : "Sem análise"
                            }

                        </strong>

                    </div>


                    <div class="result-card">

                        <span>
                            Score de risco
                        </span>

                        <strong>

                            ${
                                state.lastRisk
                                    ? state.lastRisk.score
                                    : "--"
                            }

                        </strong>

                    </div>


                    <div class="result-card">

                        <span>
                            Arquivo analisado
                        </span>

                        <strong>

                            ${
                                state.lastFile
                                    ? state.lastFile.name
                                    : "Nenhum"
                            }

                        </strong>

                    </div>


                </div>


                ${
                    state.lastRisk

                    ? `

                    <div class="panel" style="margin-top:20px">

                        <span class="section-label">
                            DETECÇÃO
                        </span>

                        <h3>
                            Possíveis problemas encontrados
                        </h3>

                        <p style="margin-top:10px">

                            ${state.lastRisk.message}

                        </p>

                    </div>

                    `

                    :

                    `

                    <div class="empty-state">

                        <h3>
                            Nenhuma análise realizada
                        </h3>

                        <p>
                            Envie um arquivo para visualizar
                            os resultados.
                        </p>

                    </div>

                    `
                }


            </section>

        `
    },


    /* =================================
       RELATÓRIOS
    ================================= */

    reports: {

        title: "Relatórios",

        content: () => `

            <section class="page">

                <span class="section-label">
                    DOCUMENTAÇÃO
                </span>

                <h2>
                    Relatórios
                </h2>

                <p class="page-description">
                    Relatórios das análises realizadas.
                </p>


                ${
                    state.lastFile

                    ?

                    `

                    <div class="panel">

                        <h3>
                            Última análise
                        </h3>

                        <p>
                            Arquivo:
                            <strong>
                                ${state.lastFile.name}
                            </strong>
                        </p>

                        <p>
                            Risco:
                            <strong>
                                ${state.lastRisk.level}
                            </strong>
                        </p>

                        <button
                            class="save-button"
                            id="generateReport"
                        >
                            Gerar relatório
                        </button>

                    </div>

                    `

                    :

                    `

                    <div class="empty-state">

                        <h3>
                            Nenhum relatório disponível
                        </h3>

                        <p>
                            Faça uma análise para gerar
                            um relatório.
                        </p>

                    </div>

                    `
                }


            </section>

        `
    },


    /* =================================
       MONITORAMENTO
    ================================= */

    monitoring: {

        title: "Monitoramento",

        content: () => `

            <section class="page">

                <span class="section-label">
                    MONITORAMENTO
                </span>

                <h2>
                    Monitoramento
                </h2>

                <p class="page-description">
                    Acompanhe o estado de segurança do sistema.
                </p>


                <div class="monitor-grid">


                    <div class="monitor-card">

                        <span>
                            Status do sistema
                        </span>

                        <strong class="online">
                            ● Online
                        </strong>

                    </div>


                    <div class="monitor-card">

                        <span>
                            Ameaças detectadas
                        </span>

                        <strong>
                            ${state.risksFound}
                        </strong>

                    </div>


                    <div class="monitor-card">

                        <span>
                            Última análise
                        </span>

                        <strong>

                            ${
                                state.lastFile
                                    ? "Concluída"
                                    : "Nunca"
                            }

                        </strong>

                    </div>


                </div>


            </section>

        `
    },


    /* =================================
       CONFIGURAÇÕES
    ================================= */

    settings: {

        title: "Configurações",

        content: () => `

            <section class="page">

                <span class="section-label">
                    SISTEMA
                </span>

                <h2>
                    Configurações
                </h2>

                <p class="page-description">
                    Configure o DataGuard AI.
                </p>


                <div class="settings-card">


                    <div class="setting">

                        <span>
                            Nome do sistema
                        </span>

                        <input
                            type="text"
                            value="DataGuard AI"
                        >

                    </div>


                    <div class="setting">

                        <span>
                            Análise automática
                        </span>

                        <label class="switch">

                            <input
                                type="checkbox"
                                checked
                            >

                            <span class="slider"></span>

                        </label>

                    </div>


                    <div class="setting">

                        <span>
                            Notificações
                        </span>

                        <label class="switch">

                            <input
                                type="checkbox"
                                checked
                            >

                            <span class="slider"></span>

                        </label>

                    </div>


                    <div class="setting">

                        <span>
                            Proteção de dados
                        </span>

                        <label class="switch">

                            <input
                                type="checkbox"
                                checked
                            >

                            <span class="slider"></span>

                        </label>

                    </div>


                    <button
                        class="save-button"
                        id="saveSettings"
                    >
                        Salvar configurações
                    </button>


                </div>


            </section>

        `
    }

};


/* =====================================
   CARREGAR PÁGINA
===================================== */

function loadPage(page) {

    if (!pages[page]) {
        return;
    }

    pageTitle.textContent =
        pages[page].title;

    app.innerHTML =
        pages[page].content();

    initializePage(page);
}


/* =====================================
   NAVEGAÇÃO
===================================== */

navigation.forEach(link => {

    link.addEventListener("click", event => {

        event.preventDefault();

        navigation.forEach(item => {

            item.classList.remove("active");

        });

        link.classList.add("active");

        const page =
            link.dataset.page;

        loadPage(page);

    });

});


/* =====================================
   INICIALIZAÇÃO DE CADA PÁGINA
===================================== */

function initializePage(page) {

    if (
        page === "dashboard"
    ) {

        const button =
            document.getElementById(
                "dashboardUploadButton"
            );

        if (button) {

            button.addEventListener(
                "click",
                () => fileInput.click()
            );

        }
    }


    if (
        page === "analysis"
    ) {

        const button =
            document.getElementById(
                "mainUploadButton"
            );

        if (button) {

            button.addEventListener(
                "click",
                () => fileInput.click()
            );

        }
    }


    if (
        page === "reports"
    ) {

        const button =
            document.getElementById(
                "generateReport"
            );

        if (button) {

            button.addEventListener(
                "click",
                generateReport
            );

        }
    }


    if (
        page === "settings"
    ) {

        const button =
            document.getElementById(
                "saveSettings"
            );

        if (button) {

            button.addEventListener(
                "click",
                () => {

                    alert(
                        "Configurações salvas com sucesso!"
                    );

                }
            );

        }
    }

}


/* =====================================
   SELEÇÃO DO ARQUIVO
===================================== */

fileInput.addEventListener(
    "change",
    () => {

        const file =
            fileInput.files[0];

        if (!file) {
            return;
        }

        analyzeFile(file);

    }
);


/* =====================================
   ANÁLISE
===================================== */

function analyzeFile(file) {

    state.lastFile = file;

    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    const allowed = [
        "csv",
        "xlsx",
        "json",
        "txt",
        "pdf"
    ];


    if (!allowed.includes(extension)) {

        alert(
            "Formato de arquivo não suportado."
        );

        return;
    }


    /*
        IMPORTANTE:

        Esta parte ainda é uma
        simulação.

        Depois vamos substituir
        isso pela API Python.
    */

    const score =
        Math.floor(
            Math.random() * 101
        );


    let level;

    let message;


    if (score < 40) {

        level = "Baixo";

        message =
            "Nenhum risco crítico identificado. " +
            "Os dados apresentam baixo nível de exposição.";

    }

    else if (score < 70) {

        level = "Médio";

        message =
            "Foram identificados possíveis dados " +
            "que precisam de atenção.";

    }

    else {

        level = "Alto";

        message =
            "Foram identificados possíveis dados sensíveis " +
            "ou informações que podem representar risco.";
    }


    state.lastRisk = {

        score: score,

        level: level,

        message: message

    };


    state.filesAnalyzed++;

    state.risksFound =
        level === "Alto"
            ? state.risksFound + 3
            : level === "Médio"
                ? state.risksFound + 1
                : state.risksFound;


    state.alerts =
        level === "Baixo"
            ? state.alerts
            : state.alerts + 1;


    state.protection =
        Math.max(
            0,
            100 - score
        );


    alert(
        `Análise concluída!\n\n` +
        `Arquivo: ${file.name}\n` +
        `Risco: ${level}\n` +
        `Score: ${score}/100`
    );


    /*
        Depois da análise,
        manda o usuário para
        a página de resultados.
    */

    navigation.forEach(item => {

        item.classList.remove("active");

        if (
            item.dataset.page ===
            "results"
        ) {

            item.classList.add("active");

        }

    });


    loadPage("results");

}


/* =====================================
   RELATÓRIO
===================================== */

function generateReport() {

    if (!state.lastFile) {

        alert(
            "Nenhuma análise disponível."
        );

        return;
    }


    const content = `

DataGuard AI
Relatório de Segurança
======================

Arquivo:
${state.lastFile.name}

Nível de risco:
${state.lastRisk.level}

Score:
${state.lastRisk.score}/100

Resultado:
${state.lastRisk.message}

Arquivos analisados:
${state.filesAnalyzed}

Riscos encontrados:
${state.risksFound}

Alertas:
${state.alerts}

Proteção:
${state.protection}%

`;


    const blob =
        new Blob(
            [content],
            {
                type:
                    "text/plain"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        "DataGuard-AI-Relatorio.txt";


    link.click();


    URL.revokeObjectURL(url);

}


/* =====================================
   NOTIFICAÇÕES
===================================== */

const notification =
    document.getElementById(
        "notificationBtn"
    );


notification.addEventListener(
    "click",
    () => {

        if (state.alerts > 0) {

            alert(
                `Você possui ${state.alerts} alerta(s).`
            );

        } else {

            alert(
                "Você não possui novas notificações."
            );

        }

    }
);


/* =====================================
   INICIALIZAÇÃO
===================================== */

loadPage("dashboard");

console.log(
    "DataGuard AI iniciado."
);