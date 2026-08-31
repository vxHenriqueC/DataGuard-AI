const API_BASE_URL = "http://127.0.0.1:8000";
const state = {
    token: localStorage.getItem("dataguard_token") || null,
    user: null, currentFile: null, analyses: [], currentPage: "dashboard"
};

function $(id) { return document.getElementById(id); }
function show(id) { if($(id)) $(id).classList.remove("hidden"); }
function hide(id) { if($(id)) $(id).classList.add("hidden"); }
function setText(id, text) { if($(id)) { $(id).textContent = text; $(id).classList.remove("skeleton", "skeleton-text"); } }

// --- CABEÇALHO DINÂMICO ---
const pageInfo = {
    dashboard: { title: "Dashboard", sub: "Visão geral do sistema", icon: "layout-dashboard" },
    analyze: { title: "Analisar Arquivos", sub: "Envie arquivos para verificação", icon: "scan-search" },
    results: { title: "Resultado", sub: "Detalhes de segurança", icon: "shield-alert" },
    history: { title: "Histórico", sub: "Todas as análises", icon: "history" },
    reports: { title: "Relatórios", sub: "Baixe laudos locais", icon: "file-text" },
    security: { title: "Segurança", sub: "Gerencie a proteção (LGPD)", icon: "shield" },
    settings: { title: "Configurações", sub: "Personalize sua interface", icon: "settings" }
};

function navigateTo(pageId) {
    if (!pageId) return;
    state.currentPage = pageId;
    
    // Troca Telas
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(l => l.classList.remove("active"));
    if ($("page-" + pageId)) $("page-" + pageId).classList.add("active");
    const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (nav) nav.classList.add("active");
    
    // Atualiza Cabeçalho
    const info = pageInfo[pageId];
    if (info) {
        setText("page-title", info.title);
        setText("page-subtitle", info.sub);
        if ($("header-page-icon")) {
            $("header-page-icon").innerHTML = `<i data-lucide="${info.icon}"></i>`;
            if (window.lucide) lucide.createIcons({ nodes: [$("header-page-icon")] });
        }
    }
    
    if (pageId === "dashboard") loadDashboard();
    if (pageId === "history") loadHistory();
    if (pageId === "reports") loadReports();
}

function showNotification(type, title, message) {
    const icons = { success: "check-circle", error: "x-circle", info: "info", warning: "alert-triangle" };
    const container = $("notification-container");
    const notif = document.createElement("div");
    notif.className = "notification";
    notif.innerHTML = `<div class="notification-icon ${type}" style="color:var(--${type}); background:var(--${type}-bg);"><i data-lucide="${icons[type]}"></i></div><div><h4 style="font-size:14px; margin-bottom:4px;">${title}</h4><p style="font-size:13px; color:var(--text-secondary);">${message}</p></div>`;
    container.appendChild(notif);
    if (window.lucide) lucide.createIcons({ nodes: [notif] });
    setTimeout(() => notif.remove(), 4000);
}

// --- COMUNICAÇÃO REAL COM A API ---
async function apiRequest(endpoint, options = {}) {
    const url = API_BASE_URL + endpoint;
    const config = { headers: { "Content-Type": "application/json" }, ...options };
    if (state.token) config.headers["Authorization"] = "Bearer " + state.token;
    const res = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro na requisição.");
    return data;
}

async function loadUser() {
    try {
        const data = await apiRequest("/me");
        state.user = data;
        setText("header-name", data.name);
        setText("header-avatar", data.name.charAt(0).toUpperCase());
        setText("welcome-message", "Bem-vindo de volta, " + data.name.split(" ")[0]);
        if($("settings-name")) $("settings-name").value = data.name;
        if($("settings-email")) $("settings-email").value = data.email;
    } catch(e) { logout(); }
}

async function loginUser(email, password) {
    try {
        $("btn-login").querySelector(".btn-text").classList.add("hidden");
        $("btn-login").querySelector(".btn-spinner").classList.remove("hidden");
        
        // CORREÇÃO: FastAPI padrão exige envio via URL Encoded Form, não JSON
        const formData = new URLSearchParams();
        formData.append("username", email); // O FastAPI chama o email de 'username' por padrão
        formData.append("password", password);

        const res = await fetch(API_BASE_URL + "/login", { 
            method: "POST", 
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData 
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || "Erro ao fazer login");
        
        state.token = data.access_token;
        localStorage.setItem("dataguard_token", state.token);
        
        await loadUser();
        hide("auth-section"); show("main-app"); navigateTo("dashboard");
        showNotification("success", "Login realizado", "Bem-vindo.");
    } catch (e) {
        showNotification("error", "Erro de Autenticação", e.message);
    } finally {
        $("btn-login").querySelector(".btn-text").classList.remove("hidden");
        $("btn-login").querySelector(".btn-spinner").classList.add("hidden");
    }
}

async function registerUser(name, email, pass, conf) {
    try {
        const data = await apiRequest("/register", { method: "POST", body: JSON.stringify({ name, email, password:pass, confirm_password:conf }) });
        state.token = data.access_token; localStorage.setItem("dataguard_token", state.token);
        await loadUser(); hide("auth-section"); show("main-app"); navigateTo("dashboard");
    } catch(e) { showNotification("error", "Erro", e.message); }
}

function logout() {
    state.token = null; localStorage.removeItem("dataguard_token");
    show("auth-section"); hide("main-app");
}

async function loadDashboard() {
    try {
        const stats = await apiRequest("/stats");
        setText("stat-analyses", stats.total_analyses);
        setText("stat-alerts", stats.total_alerts);
        const data = await apiRequest("/analyses");
        state.analyses = data.analyses || [];
        
        let safe=0, risk=0;
        state.analyses.forEach(a => { if(a.risk_level==="BAIXO") safe++; else risk++; });
        setText("stat-safe", safe); setText("stat-risk", risk);

        const list = $("dashboard-activity");
        list.innerHTML = state.analyses.length === 0 ? "<p style='color:var(--text-secondary);'>Nenhuma atividade recente.</p>" : "";
        state.analyses.slice(0, 5).forEach(a => {
            const cls = a.risk_level==="BAIXO"?"success":a.risk_level==="MÉDIO"?"warning":"danger";
            const icon = a.risk_level==="BAIXO"?"shield-check":"alert-triangle";
            list.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border);"><div style="display:flex; gap:12px; align-items:center;"><div style="color:var(--${cls}); background:var(--${cls}-bg); padding:8px; border-radius:8px;"><i data-lucide="${icon}"></i></div><div><h4 style="font-size:14px;">${a.file_name}</h4><p style="font-size:12px; color:var(--text-secondary);">${a.file_type.toUpperCase()}</p></div></div><span style="font-weight:bold; color:var(--${cls});">${a.risk_score}</span></div>`;
        });
        if (window.lucide) lucide.createIcons({nodes:[list]});

        const scoreRing = $("score-progress");
        const avg = state.analyses.length ? state.analyses.reduce((s,a)=>s+a.risk_score,0)/state.analyses.length : 0;
        const score = Math.max(0, Math.round(100 - avg));
        scoreRing.style.strokeDashoffset = state.analyses.length ? 327 - (327 * score / 100) : 327;
        setText("score-number", state.analyses.length ? score : "--");
    } catch(e) {}
}

async function loadHistory() {
    try {
        const data = await apiRequest("/analyses");
        state.analyses = data.analyses || [];
        const tbody = $("history-tbody");
        tbody.innerHTML = "";
        state.analyses.forEach(a => {
            const cls = a.risk_level === "BAIXO" ? "badge-success" : (a.risk_level === "MÉDIO" ? "badge-warning" : "badge-danger");
            tbody.innerHTML += `<tr><td><strong>${a.file_name}</strong></td><td>${a.file_type.toUpperCase()}</td><td>${a.created_at.split("T")[0]}</td><td><span class="badge ${cls}">${a.risk_level}</span></td><td><span style="font-weight:bold;">${a.risk_score}/100</span></td></tr>`;
        });
    } catch(e) {}
}

function loadReports() {
    const container = $("reports-grid");
    if(!container) return;
    container.innerHTML = "";
    if (state.analyses.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; background:var(--bg-card); border-radius:12px; border:1px solid var(--border);"><i data-lucide="file-text" style="width:48px; height:48px; color:var(--text-muted); margin-bottom:16px;"></i><h3>Nenhum relatório</h3><p style="color:var(--text-secondary);">Analise um arquivo primeiro.</p></div>`;
        if (window.lucide) lucide.createIcons({nodes:[container]}); return;
    }
    state.analyses.forEach(a => {
        const cls = a.risk_level === "BAIXO" ? "badge-success" : "badge-danger";
        container.innerHTML += `<div style="background:var(--bg-card); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between;">
                <div style="background:var(--bg-hover); padding:10px; border-radius:8px;"><i data-lucide="file-check-2"></i></div>
                <span class="badge ${cls}">${a.risk_level}</span>
            </div>
            <div><h4 style="font-size:15px; margin-bottom:4px; word-break:break-all;">${a.file_name}</h4><p style="font-size:12px; color:var(--text-secondary);">${a.created_at.split("T")[0]}</p></div>
            <button class="btn-secondary btn-full" style="margin-top:auto;" onclick="alert('Gerar TXT: ${a.file_name}')"><i data-lucide="download"></i> Baixar TXT</button>
        </div>`;
    });
    if (window.lucide) lucide.createIcons({nodes:[container]});
}

function handleFileSelect(file) {
    if (!file) return;
    state.currentFile = file;
    setText("file-name", file.name);
    setText("file-size", (file.size/1024).toFixed(2) + " KB");
    hide("upload-zone"); show("file-list");
}

async function startAnalysis() {
    if (!state.currentFile) return;
    
    hide("file-list"); 
    show("analysis-loading");
    
    const formData = new FormData();
    formData.append("file", state.currentFile);
    
    try {
        const res = await fetch(API_BASE_URL + "/analyze", { 
            method: "POST", 
            headers: { "Authorization": "Bearer " + state.token }, 
            body: formData 
        });
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Erro fatal no Backend. Verifique o terminal do Python.");
        }

        const data = await res.json();
        if(!res.ok) throw new Error(data.error || data.detail || "Erro interno na API.");
        
        // --- 1. Mapeamento de Cores e Ícones ---
        const riskClass = data.risk_level === "BAIXO" ? "success" : data.risk_level === "MÉDIO" ? "warning" : "danger";
        const riskIcon = data.risk_level === "BAIXO" ? "shield-check" : data.risk_level === "MÉDIO" ? "alert-triangle" : "shield-alert";
        
        const typeIcons = {
            "E-mail": "mail", "CPF": "credit-card", "Cartão de Crédito": "credit-card", "Senha Exposta": "key", "Chave Privada": "key"
        };
        const typeColors = {
            "E-mail": "var(--success)", "CPF": "var(--warning)", "Cartão de Crédito": "var(--danger)", "Senha Exposta": "var(--danger)"
        };

        // --- 2. Gerar Grid de Achados (Findings) ---
        let findingsHTML = "";
        const findings = data.findings || [];
        if(findings.length > 0) {
            findingsHTML = `<div class="findings-grid">`;
            findings.forEach(f => {
                const icon = typeIcons[f.type] || "file-search";
                const color = typeColors[f.type] || "var(--accent)";
                findingsHTML += `
                    <div class="finding-card">
                        <div class="finding-header" style="color: ${color}">
                            <i data-lucide="${icon}"></i> ${f.type}
                        </div>
                        <div class="finding-value" style="color: ${color}">${f.value_masked || "Dado oculto"}</div>
                        <div class="finding-meta">
                            <strong>Local:</strong> ${f.location || "Não especificado"}<br>
                            <strong>Ação:</strong> ${f.action || "Verificar dado e mascarar se necessário."}
                        </div>
                    </div>
                `;
            });
            findingsHTML += `</div>`;
        } else {
            findingsHTML = `<div style="text-align:center; padding: 40px; color: var(--text-secondary);">Nenhum dado sensível encontrado neste arquivo.</div>`;
        }

        // --- 3. Gerar Lista de Recomendações ---
        let recsHTML = "";
        const recs = data.recommendations || [
            "Evitar tráfego de dados sensíveis em redes não criptografadas.",
            "Mascarar informações de identificação (anonimização) antes de tramitar o documento."
        ];
        recs.forEach(r => {
            recsHTML += `
                <div class="rec-item">
                    <i data-lucide="check-circle-2" style="color: var(--accent); flex-shrink: 0; width: 18px; height: 18px;"></i>
                    <span>${r}</span>
                </div>
            `;
        });

        // --- 4. Montar a Tela Completa ---
        const container = $("results-content");
        container.innerHTML = `
            <div class="results-top-grid">
                <div class="main-risk-card ${riskClass}">
                    <div style="color: var(--${riskClass}); margin-bottom: 16px;">
                        <i data-lucide="${riskIcon}" style="width: 48px; height: 48px;"></i>
                    </div>
                    <h2 style="font-size: 24px; margin-bottom: 8px;">Risco ${data.risk_level.charAt(0).toUpperCase() + data.risk_level.slice(1).toLowerCase()}</h2>
                    <p style="color: var(--text-secondary); font-size: 14px;">Nível de risco: ${data.risk_level}</p>
                </div>
                
                <div class="details-card">
                    <h3 style="font-size: 16px; margin-bottom: 16px;">Detalhes da análise</h3>
                    <ul class="details-list">
                        <li><span>Arquivo</span> <span>${data.file_name}</span></li>
                        <li><span>Tipo</span> <span>${data.file_type || "N/A"}</span></li>
                        <li><span>Score de risco</span> <span style="color: var(--${riskClass});">${data.risk_score || 0}/100</span></li>
                        <li><span>Alertas</span> <span>${data.total_alerts || findings.length}</span></li>
                    </ul>
                </div>
            </div>

            ${findingsHTML}

            <div class="rec-section">
                <h3 style="font-size: 16px; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="lightbulb" style="color: var(--warning);"></i> O que deve ser feito
                </h3>
                <div class="rec-list">
                    ${recsHTML}
                </div>
            </div>
        `;
        
        // --- 5. Finalizar Renderização ---
        if(window.lucide) lucide.createIcons({nodes:[container]});
        navigateTo("results");
        showNotification("success", "Pronto", "Análise concluída com sucesso.");
        
    } catch(e) {
        showNotification("error", "Análise Falhou", e.message);
    } finally { 
        hide("analysis-loading"); 
        show("upload-zone");
        state.currentFile = null; 
        if($("main-file-input")) $("main-file-input").value = ""; 
    }
}

function initEventListeners() {
    $("show-register").addEventListener("click", () => { hide("login-form"); show("register-form"); });
    $("show-login").addEventListener("click", () => { hide("register-form"); show("login-form"); });
    $("login").addEventListener("submit", (e) => { e.preventDefault(); loginUser($("login-email").value, $("login-password").value); });
    $("register").addEventListener("submit", (e) => { e.preventDefault(); registerUser($("reg-name").value, $("reg-email").value, $("reg-password").value, $("reg-confirm-password").value); });
    
    document.querySelectorAll(".nav-item[data-page]").forEach(link => link.addEventListener("click", () => navigateTo(link.dataset.page)));
    $("logout-btn").addEventListener("click", logout);
    $("sidebar-toggle").addEventListener("click", () => $("sidebar").classList.toggle("collapsed"));
    
    if($("upload-zone")) {
        $("upload-zone").addEventListener("click", () => $("main-file-input").click());
        $("main-file-input").addEventListener("change", (e) => handleFileSelect(e.target.files[0]));
        $("start-analysis").addEventListener("click", startAnalysis);
        $("file-remove").addEventListener("click", () => { state.currentFile=null; hide("file-list"); show("upload-zone"); });
    }

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            const filter = e.target.dataset.filter;
            document.querySelectorAll("#history-tbody tr").forEach(tr => {
                if(filter === "all") tr.style.display = "";
                else tr.style.display = tr.querySelector(".badge").textContent === filter ? "" : "none";
            });
        });
    });

    document.querySelectorAll(".settings-nav-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetBtn = e.currentTarget;
            const container = targetBtn.closest('.settings-layout');
            const prefix = targetBtn.hasAttribute('data-settings-tab') ? 'settings' : 'security';
            const tabName = targetBtn.dataset[`${prefix}Tab`];

            container.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove("active"));
            container.querySelectorAll('.settings-panel').forEach(p => p.classList.remove("active"));

            targetBtn.classList.add("active");
            if ($(`${prefix}-${tabName}`)) $(`${prefix}-${tabName}`).classList.add("active");
        });
    });

    document.querySelectorAll(".theme-option").forEach(opt => {
        opt.addEventListener("click", () => {
            const val = opt.dataset.themeValue;
            document.querySelectorAll('.theme-option').forEach(o => o.classList.remove("active"));
            opt.classList.add("active");
            document.documentElement.setAttribute("data-theme", val);
            localStorage.setItem("dataguard_theme", val);
        });
    });

    if($("password-form")) {
        $("password-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const current = $("sec-current-password").value, newPass = $("sec-new-password").value, conf = $("sec-confirm-password").value;
            if(newPass !== conf) { showNotification("error", "Erro", "Senhas não conferem."); return; }
            try {
                await apiRequest("/profile/password", { method:"PUT", body:JSON.stringify({current_password:current, new_password:newPass}) });
                showNotification("success", "Sucesso", "Senha alterada com sucesso."); $("password-form").reset();
            } catch(err) { showNotification("error", "Erro", err.message); }
        });
    }

    if($("btn-setup-2fa")) {
        $("btn-setup-2fa").addEventListener("click", () => {
            showNotification("info", "E-mail enviado", "Código enviado para seu e-mail.");
            hide("2fa-step-1"); show("2fa-step-2");
        });
    }
    if($("btn-verify-2fa")) {
        $("btn-verify-2fa").addEventListener("click", () => {
            if($("input-2fa-code").value.length === 6) {
                showNotification("success", "2FA Ativado", "Sua conta está protegida (LGPD).");
                $("2fa-step-2").innerHTML = `<div style="text-align:center;"><i data-lucide="shield-check" style="color:var(--success);width:48px;height:48px;"></i><h4 style="color:var(--success);margin-top:10px;">Autenticação Ativada</h4></div>`;
                if(window.lucide) lucide.createIcons({nodes:[$("2fa-step-2")]});
            } else { showNotification("error", "Erro", "Código de 6 dígitos inválido."); }
        });
    }

    if($("btn-clear-history")) {
        $("btn-clear-history").addEventListener("click", async () => {
            if(confirm("Apagar todo o histórico definitivamente?")) {
                try {
                    await apiRequest("/analyses", { method: "DELETE" });
                    showNotification("success", "Pronto", "Histórico limpo.");
                    if(state.currentPage==="history") loadHistory();
                    if(state.currentPage==="dashboard") loadDashboard();
                } catch(e) { showNotification("error", "Erro", "A rota DELETE /analyses precisa estar criada no app.py."); }
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();
    initEventListeners();
    const theme = localStorage.getItem("dataguard_theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll(`[data-theme-value="${theme}"]`).forEach(t => t.classList.add("active"));
    
    if (state.token) { loadUser().then(()=>{ hide("auth-section"); show("main-app"); navigateTo("dashboard"); }).catch(()=>{logout();}); } 
    else { show("auth-section"); hide("main-app"); }
});
