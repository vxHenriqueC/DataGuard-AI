// ============================================
// DataGuard AI — Frontend Application
// ============================================

const API_BASE_URL = "http://127.0.0.1:8000";

const state = {
    token: localStorage.getItem("dataguard_token") || null,
    user: null,
    currentFile: null,
    currentAnalysis: null,
    analyses: [],
    sidebarCollapsed: localStorage.getItem("sidebar_collapsed") === "true",
    currentPage: "dashboard",
    theme: localStorage.getItem("dataguard_theme") || "dark",
    isAnalyzing: false
};

function $(id) { return document.getElementById(id); }

function show(el) {
    if (typeof el === "string") el = $(el);
    if (el) el.classList.remove("hidden");
}

function hide(el) {
    if (typeof el === "string") el = $(el);
    if (el) el.classList.add("hidden");
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function getRiskColor(level) {
    const map = { "BAIXO": "#10B981", "MÉDIO": "#F59E0B", "ALTO": "#EF4444", "CRÍTICO": "#DC2626" };
    return map[level] || "#6B7280";
}

function getRiskBg(level) {
    const map = { "BAIXO": "var(--success-bg)", "MÉDIO": "var(--warning-bg)", "ALTO": "var(--danger-bg)", "CRÍTICO": "var(--danger-bg)" };
    return map[level] || "var(--bg-hover)";
}

function getRiskText(level) {
    const map = { "BAIXO": "var(--success)", "MÉDIO": "var(--warning)", "ALTO": "var(--danger)", "CRÍTICO": "var(--danger)" };
    return map[level] || "var(--text-muted)";
}

function setText(el, text) {
    if (typeof el === "string") el = $(el);
    if (el) {
        el.textContent = text || "0";
        el.classList.remove("skeleton", "skeleton-text");
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem("dataguard_theme") || "dark";
    applyTheme(savedTheme);
    document.querySelectorAll('input[name="theme"]').forEach(radio => radio.checked = radio.value === savedTheme);
}

function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === "system") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        html.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
        html.setAttribute("data-theme", theme);
    }
    state.theme = theme;
}

function showNotification(type, title, message, duration = 4000) {
    const container = $("notification-container");
    const icons = { success: "check-circle-2", error: "x-circle", warning: "alert-triangle", info: "info" };
    const notif = document.createElement("div");
    notif.className = "notification";
    notif.innerHTML = `
        <div class="notification-icon ${type}"><i data-lucide="${icons[type]}"></i></div>
        <div class="notification-content"><h4>${title}</h4><p>${message}</p></div>
        <button class="notification-close" aria-label="Fechar"><i data-lucide="x"></i></button>
    `;
    container.appendChild(notif);
    if (window.lucide) lucide.createIcons({ nodes: [notif] });

    const closeBtn = notif.querySelector(".notification-close");
    closeBtn.addEventListener("click", () => {
        notif.classList.add("hiding");
        setTimeout(() => notif.remove(), 300);
    });
    setTimeout(() => {
        if (notif.parentNode) {
            notif.classList.add("hiding");
            setTimeout(() => notif.remove(), 300);
        }
    }, duration);
}

async function apiRequest(endpoint, options) {
    options = options || {};
    const url = API_BASE_URL + endpoint;
    const config = { headers: { "Content-Type": "application/json" }, ...options };
    if (state.token) config.headers["Authorization"] = "Bearer " + state.token;

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro na requisição.");
        return data;
    } catch (error) {
        if (error.message === "Failed to fetch") throw new Error("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
        throw error;
    }
}

async function registerUser(name, email, password, confirmPassword) {
    hide("register-error");
    setBtnLoading("btn-register", true);
    try {
        const data = await apiRequest("/register", { method: "POST", body: JSON.stringify({ name, email, password, confirm_password: confirmPassword }) });
        state.token = data.access_token;
        localStorage.setItem("dataguard_token", state.token);
        await loadUser();
        showMainApp();
        showNotification("success", "Conta criada!", "Bem-vindo ao DataGuard AI.");
    } catch (error) {
        show("register-error");
        setText("register-error", error.message);
    } finally { setBtnLoading("btn-register", false); }
}

async function loginUser(email, password) {
    hide("login-error");
    setBtnLoading("btn-login", true);
    try {
        const data = await apiRequest("/login", { method: "POST", body: JSON.stringify({ email, password }) });
        state.token = data.access_token;
        localStorage.setItem("dataguard_token", state.token);
        await loadUser();
        showMainApp();
        showNotification("success", "Login realizado!", "Você está conectado.");
    } catch (error) {
        show("login-error");
        setText("login-error", error.message);
    } finally { setBtnLoading("btn-login", false); }
}

async function loadUser() {
    try {
        const data = await apiRequest("/me");
        state.user = data;
        setText("header-name", data.name || "Usuário");
        setText("header-avatar", (data.name || "U").charAt(0).toUpperCase());
        const firstName = (data.name || "Usuário").split(" ")[0];
        setText("welcome-message", "Bem-vindo de volta, " + firstName);
        if($("settings-name")) $("settings-name").value = data.name || "";
        if($("settings-email")) $("settings-email").value = data.email || "";
    } catch (error) { logout(); }
}

async function logout() {
    try { await apiRequest("/logout", { method: "POST" }); } catch (e) {}
    state.token = null;
    state.user = null;
    localStorage.removeItem("dataguard_token");
    show("auth-section"); hide("main-app");
    showNotification("info", "Desconectado", "Você saiu da sua conta.");
}

function setBtnLoading(btnId, loading) {
    const btn = $(btnId);
    if (!btn) return;
    const text = btn.querySelector(".btn-text");
    const spinner = btn.querySelector(".btn-spinner");
    btn.disabled = loading;
    if (text) text.classList.toggle("hidden", loading);
    if (spinner) spinner.classList.toggle("hidden", !loading);
}

function navigateTo(pageId) {
    if (!pageId) return;
    state.currentPage = pageId;
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(l => l.classList.remove("active"));
    const page = $("page-" + pageId);
    if (page) page.classList.add("active");
    const nav = document.querySelector('.nav-item[data-page="' + pageId + '"]');
    if (nav) nav.classList.add("active");
    $("sidebar").classList.remove("open");
    $("sidebar-overlay").classList.remove("active");
    $("main-scroll").scrollTop = 0;

    if (pageId === "dashboard") loadDashboard();
    if (pageId === "history") loadHistory();
}

function showMainApp() {
    hide("auth-section"); show("main-app");
    navigateTo("dashboard");
}

async function loadDashboard() {
    try {
        const stats = await apiRequest("/stats");
        setText("stat-analyses", stats.total_analyses || 0);
        setText("stat-alerts", stats.total_alerts || 0);

        const analysesData = await apiRequest("/analyses");
        const all = analysesData.analyses || [];
        state.analyses = all;

        let safe = 0, risk = 0;
        all.forEach(a => { if (a.risk_level === "BAIXO") safe++; else risk++; });
        setText("stat-safe", safe);
        setText("stat-risk", risk);

        const activityList = $("dashboard-activity");
        if (all.length === 0) {
            activityList.innerHTML = `<div class="activity-empty"><i data-lucide="inbox"></i><p>Nenhuma análise realizada ainda</p><button class="btn-secondary" onclick="navigateTo('analyze')">Fazer primeira análise</button></div>`;
        } else {
            activityList.innerHTML = "";
            all.slice(0, 5).forEach(a => {
                const isSafe = a.risk_level === "BAIXO";
                const iconName = isSafe ? "shield-check" : (a.risk_level === "MÉDIO" ? "alert-triangle" : "shield-alert");
                const cls = isSafe ? "safe" : (a.risk_level === "MÉDIO" ? "warn" : "risk");

                const item = document.createElement("div");
                item.className = "activity-item";
                item.innerHTML = `
                    <div class="activity-icon ${cls}"><i data-lucide="${iconName}"></i></div>
                    <div class="activity-details">
                        <div class="activity-name">${a.file_name || "Arquivo"}</div>
                        <div class="activity-meta">${(a.file_type || "").toUpperCase()} • ${formatDate(a.created_at)}</div>
                    </div>
                    <div class="activity-score" style="color: ${getRiskColor(a.risk_level)}">${a.risk_score || 0}</div>
                `;
                activityList.appendChild(item);
            });
        }
        if (window.lucide) lucide.createIcons({ nodes: [activityList] });
        updateScoreRing(all);
    } catch (error) { }
}

function updateScoreRing(analyses) {
    const ring = $("score-progress"), number = $("score-number"), level = $("score-level"), desc = $("score-desc");
    if (!analyses || analyses.length === 0) {
        ring.style.strokeDashoffset = "327";
        setText(number, "--"); setText(level, "--"); setText(desc, "Realize uma análise para calcular o score");
        return;
    }
    const avgRisk = analyses.reduce((s, a) => s + (a.risk_score || 0), 0) / analyses.length;
    const securityScore = Math.max(0, Math.round(100 - avgRisk));
    ring.style.strokeDashoffset = (327 - (327 * securityScore / 100)).toString();
    setText(number, securityScore);

    if (securityScore >= 70) { setText(level, "Nível: Alto"); level.style.color = "var(--success)"; ring.style.stroke = "var(--success)"; } 
    else if (securityScore >= 40) { setText(level, "Nível: Médio"); level.style.color = "var(--warning)"; ring.style.stroke = "var(--warning)"; } 
    else { setText(level, "Nível: Baixo"); level.style.color = "var(--danger)"; ring.style.stroke = "var(--danger)"; }
    setText(desc, "Baseado em " + analyses.length + " análise(s)");
}

function handleFileSelect(file) {
    if (!file) return;
    state.currentFile = file;
    setText("file-name", file.name);
    setText("file-size", formatFileSize(file.size));
    hide("upload-zone"); show("file-list"); hide("analysis-loading"); hide("analysis-error");
}

async function startAnalysis() {
    if (!state.currentFile || state.isAnalyzing) return;
    state.isAnalyzing = true;
    hide("file-list"); show("analysis-loading"); hide("analysis-error");

    const formData = new FormData();
    formData.append("file", state.currentFile);

    try {
        const response = await fetch(API_BASE_URL + "/analyze", { method: "POST", headers: { "Authorization": "Bearer " + state.token }, body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao analisar arquivo.");

        state.currentAnalysis = data;
        displayResults(data);
        navigateTo("results");
        showNotification("success", "Análise concluída!", "Arquivo processado.");
    } catch (error) {
        show("analysis-error");
        setText("analysis-error", error.message);
    } finally {
        state.isAnalyzing = false;
        hide("analysis-loading"); show("upload-zone");
        $("main-file-input").value = ""; state.currentFile = null;
    }
}

function downloadReport(result) {
    let content = `=======================================\n   RELATÓRIO DE SEGURANÇA - DATAGUARD AI\n=======================================\n\n[ INFORMAÇÕES DO ARQUIVO ]\nNome: ${result.file_name || result.file}\nFormato: ${(result.file_type || "").toUpperCase()}\nRisco Global: ${result.risk_level} (Score: ${result.risk_score}/100)\nAlertas: ${result.summary ? result.summary.total_findings : 0}\n\n[ RECOMENDAÇÕES ]\n`;
    if (result.recommendations && result.recommendations.length > 0) result.recommendations.forEach(r => content += `-> ${r}\n`);
    else content += `-> Nenhuma ação necessária.\n`;
    
    content += `\n[ DETALHAMENTO ]\n`;
    if (result.findings && result.findings.length > 0) {
        result.findings.forEach((f, i) => {
            content += `\n--- Ocorrência #${i + 1} ---\nTipo: ${f.type}\nLocal: ${f.location}\nSeveridade: ${f.risk}\nMascarado: ${f.value_masked}\nMotivo: ${f.reason}\nCorreção: ${f.recommendation}\n`;
        });
    } else { content += `\nNenhuma vulnerabilidade detectada.\n`; }

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    a.download = `Relatorio_${(result.file_name || result.file).split('.')[0]}.txt`;
    a.click();
}

function displayResults(result) {
    const container = $("results-content"); container.innerHTML = "";
    if (!result || !result.status) return;

    const isSafe = result.risk_level === "BAIXO";
    const statusIcon = isSafe ? "shield-check" : (result.risk_level === "MÉDIO" ? "alert-triangle" : "shield-alert");
    const statusClass = isSafe ? "safe" : (result.risk_level === "MÉDIO" ? "warning" : "danger");

    container.innerHTML = `
        <div class="result-overview">
            <div class="result-status-card">
                <div class="result-status-icon ${statusClass}"><i data-lucide="${statusIcon}"></i></div>
                <h3>${isSafe ? "Seguro" : "Risco Detectado"}</h3>
                <p>Nível: ${result.risk_level}</p>
            </div>
            <div class="result-details-card">
                <h4>Detalhes da análise</h4>
                <div class="result-detail-row"><span>Arquivo</span><span>${result.file_name || result.file}</span></div>
                <div class="result-detail-row"><span>Score de risco</span><span style="color: ${getRiskColor(result.risk_level)}">${result.risk_score}/100</span></div>
            </div>
        </div>
    `;

    if (result.findings && result.findings.length > 0) {
        const grid = document.createElement("div"); grid.className = "sensitive-grid";
        result.findings.forEach(item => {
            const card = document.createElement("div"); card.className = "sensitive-card";
            card.innerHTML = `
                <div class="sensitive-card-header">
                    <div class="sensitive-card-icon" style="background: ${getRiskBg(item.risk)}; color: ${getRiskText(item.risk)}"><i data-lucide="alert-circle"></i></div>
                    <span class="sensitive-card-title">${item.type}</span>
                </div>
                <div class="sensitive-card-samples"><span class="sensitive-sample" style="color: ${getRiskText(item.risk)}">${item.value_masked}</span></div>
                <div style="font-size:12px; margin-top:8px;"><strong>Local:</strong> ${item.location}<br><strong>Ação:</strong> ${item.recommendation}</div>
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    const actions = document.createElement("div"); actions.style.cssText = "display:flex; gap:12px; margin-top:20px;";
    actions.innerHTML = `
        <button class="btn-primary" onclick="navigateTo('analyze')"><i data-lucide="scan-search"></i> Nova análise</button>
        <button class="btn-secondary" id="res-btn-report"><i data-lucide="download"></i> Baixar Relatório</button>
    `;
    container.appendChild(actions);
    container.querySelector("#res-btn-report").addEventListener("click", () => downloadReport(result));
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

async function loadHistory() {
    try {
        const data = await apiRequest("/analyses");
        const tbody = $("history-tbody");
        tbody.innerHTML = "";
        (data.analyses || []).forEach(a => {
            const cls = a.risk_level === "BAIXO" ? "badge-success" : (a.risk_level === "MÉDIO" ? "badge-warning" : "badge-danger");
            const tr = document.createElement("tr");
            tr.innerHTML = `<td><strong>${a.file_name}</strong></td><td>${formatDate(a.created_at)}</td><td><span class="badge ${cls}">${a.risk_level}</span></td><td><span style="color:${getRiskColor(a.risk_level)}">${a.risk_score}/100</span></td>`;
            tbody.appendChild(tr);
        });
    } catch (e) {}
}

function filterHistoryTable(level) {
    document.querySelectorAll("#history-tbody tr").forEach(row => {
        if (level === "all") row.style.display = "";
        else row.style.display = (row.querySelector(".badge")?.textContent === level) ? "" : "none";
    });
}

function initEventListeners() {
    $("show-register").addEventListener("click", () => { hide("login-form"); show("register-form"); });
    $("show-login").addEventListener("click", () => { hide("register-form"); show("login-form"); });
    $("login").addEventListener("submit", (e) => { e.preventDefault(); loginUser($("login-email").value, $("login-password").value); });
    $("register").addEventListener("submit", (e) => { e.preventDefault(); registerUser($("reg-name").value, $("reg-email").value, $("reg-password").value, $("reg-confirm-password").value); });
    
    document.querySelectorAll(".nav-item[data-page]").forEach(link => link.addEventListener("click", () => navigateTo(link.dataset.page)));
    $("logout-btn").addEventListener("click", logout);
    $("sidebar-toggle").addEventListener("click", () => $("sidebar").classList.toggle("collapsed"));
    
    $("upload-zone").addEventListener("click", () => $("main-file-input").click());
    $("main-file-input").addEventListener("change", (e) => handleFileSelect(e.target.files[0]));
    $("start-analysis").addEventListener("click", startAnalysis);
    $("quick-upload").addEventListener("click", () => $("quick-file-input").click());
    $("quick-file-input").addEventListener("change", (e) => { handleFileSelect(e.target.files[0]); navigateTo("analyze"); });

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active"); filterHistoryTable(e.target.dataset.filter);
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();
    initEventListeners(); initTheme();
    if (state.token) loadUser().then(() => showMainApp()).catch(() => showAuth());
    else showAuth();
});
