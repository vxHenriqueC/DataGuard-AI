const API_URL = "http://127.0.0.1:8000";


// =========================================
// SIDEBAR
// =========================================

const sidebar = document.getElementById("sidebar");

const toggleSidebar =
    document.getElementById("toggleSidebar");

const main =
    document.getElementById("main");


toggleSidebar.addEventListener("click", function () {

    sidebar.classList.toggle("closed");

    main.classList.toggle("closed");

});


// =========================================
// NAVEGAÇÃO
// =========================================

const menuLinks =
    document.querySelectorAll(".menu-link");

const pages =
    document.querySelectorAll(".page");


function abrirPagina(nome) {

    pages.forEach(function (page) {

        page.classList.remove("active");

    });


    menuLinks.forEach(function (link) {

        link.classList.remove("active");

    });


    const pagina =
        document.getElementById(nome);

    if (pagina) {

        pagina.classList.add("active");

    }


    const link =
        document.querySelector(
            `.menu-link[data-page="${nome}"]`
        );

    if (link) {

        link.classList.add("active");

    }

}


menuLinks.forEach(function (link) {

    link.addEventListener("click", function (event) {

        event.preventDefault();

        abrirPagina(link.dataset.page);

    });

});


// =========================================
// BOTÃO ANALISAR DO DASHBOARD
// =========================================

const goAnalyze =
    document.getElementById("goAnalyze");


goAnalyze.addEventListener("click", function () {

    abrirPagina("analisar");

});


// =========================================
// ARQUIVO
// =========================================

const fileInput =
    document.getElementById("fileInput");

const selectedFile =
    document.getElementById("selectedFile");


fileInput.addEventListener(
    "change",
    function () {

        const file =
            fileInput.files[0];


        if (!file) {

            selectedFile.textContent =
                "Nenhum arquivo selecionado";

            return;

        }


        selectedFile.textContent =
            `Arquivo selecionado: ${file.name}`;

    }
);


// =========================================
// ANALISAR
// =========================================

const analyzeButton =
    document.getElementById("analyzeButton");

const resultArea =
    document.getElementById("resultArea");


analyzeButton.addEventListener(
    "click",
    async function () {

        const file =
            fileInput.files[0];


        if (!file) {

            resultArea.innerHTML = `

                <div class="result-empty">

                    <div>⚠️</div>

                    <h3>
                        Nenhum arquivo selecionado
                    </h3>

                    <p>
                        Escolha um arquivo primeiro.
                    </p>

                </div>

            `;

            return;

        }


        resultArea.innerHTML = `

            <div class="result-empty">

                <div>⏳</div>

                <h3>
                    Analisando arquivo...
                </h3>

                <p>
                    Aguarde enquanto o DataGuard AI
                    processa o arquivo.
                </p>

            </div>

        `;


        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );


        try {

            const response =
                await fetch(
                    `${API_URL}/analisar`,
                    {
                        method: "POST",
                        body: formData
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "Erro na API"
                );

            }


            const data =
                await response.json();


            mostrarResultado(data);


        } catch (error) {

            console.error(error);


            resultArea.innerHTML = `

                <div class="result-empty">

                    <div>❌</div>

                    <h3>
                        Erro de conexão
                    </h3>

                    <p>
                        Verifique se o backend
                        está rodando em
                        http://127.0.0.1:8000
                    </p>

                </div>

            `;

        }

    }
);


// =========================================
// MOSTRAR RESULTADO
// =========================================

function mostrarResultado(data) {

    const arquivo =
        data.arquivo || {};


    const analise =
        data.analise || {};


    resultArea.innerHTML = `

        <div class="result-card">

            <h2>
                🛡️ Resultado da análise
            </h2>


            <div class="result-item">

                <strong>
                    Arquivo:
                </strong>

                ${arquivo.nome || "N/A"}

            </div>


            <div class="result-item">

                <strong>
                    Tamanho:
                </strong>

                ${formatarTamanho(
                    arquivo.tamanho || 0
                )}

            </div>


            <div class="result-item">

                <strong>
                    Tipo:
                </strong>

                ${arquivo.tipo || "N/A"}

            </div>


            <div class="result-item">

                <strong>
                    Status:
                </strong>

                ${data.status || "N/A"}

            </div>


            <div class="result-item">

                <strong>
                    Análise:
                </strong>

                ${analise.mensagem ||
                    "Arquivo recebido com sucesso."}

            </div>

        </div>

    `;


    const totalFiles =
        document.getElementById("totalFiles");


    totalFiles.textContent =
        Number(totalFiles.textContent) + 1;

}


// =========================================
// TAMANHO
// =========================================

function formatarTamanho(bytes) {

    if (bytes === 0) {

        return "0 Bytes";

    }


    const unidades = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const i =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        (bytes /
            Math.pow(1024, i))
            .toFixed(2)
        + " "
        + unidades[i]
    );

}


// =========================================
// TESTAR BACKEND
// =========================================

async function testarBackend() {

    try {

        const response =
            await fetch(
                `${API_URL}/status`
            );


        if (!response.ok) {

            throw new Error();

        }


        console.log(
            "🟢 DataGuard AI conectado!"
        );


    } catch (error) {

        console.log(
            "🔴 Backend não conectado."
        );

    }

}


testarBackend();
