// ============================================
// DataGuard AI — Frontend Application
// Seguro, Funcional, Responsivo
// ============================================

const API_BASE_URL = "http://localhost:8000";

// ============================
// STATE
// ============================

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

// ============================
// UTILITIES
// ============================

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
    const map = { "Baixo": "#22C55E", "Medio": "#F59E0B", "Alto": "#EF4444" };
    return map[level] || "#6B7280";
}

function getRiskBg(level) {
    const map = { "Baixo": "var(--success-bg)", "Medio": "var(--warning-bg)", "Alto": "var(--danger-bg)" };
    return map[level] || "var(--bg-hover)";
}

function getRiskText(level) {
    const map = { "Baixo": "var(--success)", "Medio": "var(--warning)", "Alto": "var(--danger)" };
    return map[level] || "var(--text-muted)";
}

// XSS-safe text setter
function setText(el, text) {
    if (typeof el === "string") el = $(el);
    if (el) el.textContent = text || "";
}

// ============================
// THEME SYSTEM
// ============================

function initTheme() {
    const savedTheme = localStorage.getItem("dataguard_theme") || "dark";
    applyTheme(savedTheme);

    // Update radio buttons
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.checked = radio.value === savedTheme;
    });
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle("active", opt.dataset.themeValue === savedTheme);
    });
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

function setTheme(theme) {
    localStorage.setItem("dataguard_theme", theme);
    applyTheme(theme);

    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle("active", opt.dataset.themeValue === theme);
    });
}

// Listen for system theme changes
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (state.theme === "system") {
        applyTheme("system");
    }
});

// ============================
// NOTIFICATIONS
// ============================

function showNotification(type, title, message, duration = 4000) {
    const container = $("notification-container");
    const icons = {
        success: "check-circle-2",
        error: "x-circle",
        warning: "alert-triangle",
        info: "info"
    };
    const notif = document.createElement("div");
    notif.className = "notification";
    notif.innerHTML = `
        <div class="notification-icon ${type}">
            <i data-lucide="${icons[type]}"></i>
        </div>
        <div class="notification-content">
            <h4></h4>
            <p></p>
        </div>
        <button class="notification-close" aria-label="Fechar">
            <i data-lucide="x"></i>
        </button>
    `;
    notif.querySelector("h4").textContent = title;
    notif.querySelector("p").textContent = message;
    container.appendChild(notif);

    if (window.lucide) {
        lucide.createIcons({ nodes: [notif] });
    }

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

// ============================
// MODALS
// ============================

function showModal(title, message, onConfirm, confirmText, danger) {
    setText("modal-title", title);
    setText("modal-message", message);
    const btn = $("modal-confirm-btn");
    setText(btn, confirmText || "Confirmar");
    btn.className = danger ? "btn-danger" : "btn-primary";
    show("modal-overlay");

    const closeModal = () => hide("modal-overlay");

    const confirmHandler = () => {
        closeModal();
        if (onConfirm) onConfirm();
    };

    btn.onclick = confirmHandler;
    $("modal-cancel").onclick = closeModal;
    $("modal-close").onclick = closeModal;
    $("modal-overlay").onclick = (e) => {
        if (e.target === $("modal-overlay")) closeModal();
    };
}

// ============================
// API
// ============================

async function apiRequest(endpoint, options) {
    options = options || {};
    const url = API_BASE_URL + endpoint;
    const config = {
        headers: { "Content-Type": "application/json" },
        ...options
    };
    if (state.token) {
        config.headers["Authorization"] = "Bearer " + state.token;
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erro na requisição.");
        }
        return data;
    } catch (error) {
        if (error.message === "Failed to fetch") {
            throw new Error("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
        }
        throw error;
    }
}

// ============================
// AUTHENTICATION
// ============================

async function registerUser(name, email, password, confirmPassword) {
    hide("register-error");
    setBtnLoading("btn-register", true);

    try {
        const data = await apiRequest("/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password, confirm_password: confirmPassword })
        });

        state.token = data.access_token;
        localStorage.setItem("dataguard_token", state.token);
        await loadUser();
        showMainApp();
        showNotification("success", "Conta criada!", "Bem-vindo ao DataGuard AI.");
    } catch (error) {
        show("register-error");
        setText("register-error", error.message);
    } finally {
        setBtnLoading("btn-register", false);
    }
}

async function loginUser(email, password) {
    hide("login-error");
    setBtnLoading("btn-login", true);

    try {
        const data = await apiRequest("/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        state.token = data.access_token;
        localStorage.setItem("dataguard_token", state.token);
        await loadUser();
        showMainApp();
        showNotification("success", "Login realizado!", "Você está conectado.");
    } catch (error) {
        show("login-error");
        setText("login-error", error.message);
    } finally {
        setBtnLoading("btn-login", false);
    }
}

async function loadUser() {
    try {
        const data = await apiRequest("/me");
        state.user = data;
        updateHeaderProfile();
        const firstName = (data.name || "Usuário").split(" ")[0];
        setText("welcome-message", "Bem-vindo de volta, " + firstName);
        $("settings-name").value = data.name || "";
        $("settings-email").value = data.email || "";
    } catch (error) {
        logout();
    }
}

async function logout() {
    try {
        await apiRequest("/logout", { method: "POST" });
    } catch (e) {}
    state.token = null;
    state.user = null;
    localStorage.removeItem("dataguard_token");
    showAuth();
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

function updateHeaderProfile() {
    if (!state.user) return;
    setText("header-name", state.user.name || "Usuário");
    setText("header-avatar", (state.user.name || "U").charAt(0).toUpperCase());
}

// ============================
// NAVIGATION
// ============================

const pageTitles = {
    dashboard: { title: "Dashboard", subtitle: "Visão geral do sistema" },
    analyze: { title: "Analisar Arquivos", subtitle: "Envie arquivos para identificação de dados sensíveis" },
    results: { title: "Resultado da Análise", subtitle: "Detalhes da verificação de segurança" },
    history: { title: "Histórico", subtitle: "Todas as análises realizadas" },
    reports: { title: "Relatórios", subtitle: "Documentos e relatórios de análise" },
    security: { title: "Segurança", subtitle: "Gerencie a segurança da sua conta" },
    settings: { title: "Configurações", subtitle: "Personalize sua experiência" }
};

function navigateTo(pageId) {
    if (!pageId) return;
    state.currentPage = pageId;

    document.querySelectorAll(".page").forEach(function(p) { p.classList.remove("active"); });
    document.querySelectorAll(".nav-item").forEach(function(l) { l.classList.remove("active"); });

    const page = $("page-" + pageId);
    if (page) page.classList.add("active");

    const nav = document.querySelector('.nav-item[data-page="' + pageId + '"]');
    if (nav) nav.classList.add("active");

    const info = pageTitles[pageId];
    if (info) {
        setText("page-title", info.title);
        setText("page-subtitle", info.subtitle);
    }

    $("sidebar").classList.remove("open");
    $("sidebar-overlay").classList.remove("active");
    $("main-scroll").scrollTop = 0;

    if (pageId === "dashboard") loadDashboard();
    if (pageId === "history") loadHistory();
}

function showAuth() {
    show("auth-section");
    hide("main-app");
}

function showMainApp() {
    hide("auth-section");
    show("main-app");
    navigateTo("dashboard");
    if (state.sidebarCollapsed) {
        $("sidebar").classList.add("collapsed");
    }
}

// ============================
// SIDEBAR
// ============================

function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    $("sidebar").classList.toggle("collapsed", state.sidebarCollapsed);
    localStorage.setItem("sidebar_collapsed", state.sidebarCollapsed);

    const icon = $("sidebar-toggle");
    if (icon) {
        const svg = icon.querySelector("[data-lucide]");
        if (svg) {
            svg.style.transform = state.sidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)";
        }
    }
}

function openMobileSidebar() {
    $("sidebar").classList.add("open");
    $("sidebar-overlay").classList.add("active");
}

// ============================
// DASHBOARD
// ============================

async function loadDashboard() {
    try {
        const stats = await apiRequest("/stats");
        setText("stat-analyses", stats.total_analyses || 0);
        setText("stat-alerts", stats.total_alerts || 0);

        const analysesData = await apiRequest("/analyses");
        const all = analysesData.analyses || [];
        state.analyses = all;

        let safe = 0, risk = 0;
        all.forEach(function(a) {
            if (a.risk_level === "Baixo") safe++;
            else risk++;
        });
        setText("stat-safe", safe);
        setText("stat-risk", risk);

        const activityList = $("dashboard-activity");
        if (all.length === 0) {
            activityList.innerHTML = '';
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "activity-empty";
            emptyDiv.innerHTML = '<i data-lucide="inbox"></i><p>Nenhuma análise realizada ainda</p>';
            const btn = document.createElement("button");
            btn.className = "btn-secondary";
            btn.textContent = "Fazer primeira análise";
            btn.addEventListener("click", function() { navigateTo("analyze"); });
            emptyDiv.appendChild(btn);
            activityList.appendChild(emptyDiv);
        } else {
            activityList.innerHTML = "";
            all.slice(0, 5).forEach(function(a) {
                const isSafe = a.risk_level === "Baixo";
                const iconName = isSafe ? "shield-check" : (a.risk_level === "Medio" ? "alert-triangle" : "shield-alert");
                const cls = isSafe ? "safe" : (a.risk_level === "Medio" ? "warn" : "risk");

                const item = document.createElement("div");
                item.className = "activity-item";
                item.innerHTML = `
                    <div class="activity-icon ${cls}"><i data-lucide="${iconName}"></i></div>
                    <div class="activity-details">
                        <div class="activity-name"></div>
                        <div class="activity-meta"></div>
                    </div>
                    <div class="activity-score"></div>
                `;
                item.querySelector(".activity-name").textContent = a.file_name || "Arquivo";
                item.querySelector(".activity-meta").textContent = (a.file_type || "").toUpperCase() + " • " + formatDate(a.created_at);
                const scoreEl = item.querySelector(".activity-score");
                scoreEl.textContent = a.risk_score || 0;
                scoreEl.style.color = getRiskColor(a.risk_level);
                activityList.appendChild(item);
            });
        }
        if (window.lucide) lucide.createIcons({ nodes: [activityList] });

        updateScoreRing(all);
    } catch (error) {
        // Silently fail - don't expose errors to console with sensitive data
    }
}

function updateScoreRing(analyses) {
    const ring = $("score-progress");
    const number = $("score-number");
    const level = $("score-level");
    const desc = $("score-desc");

    if (!analyses || analyses.length === 0) {
        ring.style.strokeDashoffset = "327";
        setText(number, "--");
        setText(level, "--");
        setText(desc, "Realize uma análise para calcular o score");
        return;
    }

    const avgRisk = analyses.reduce(function(s, a) { return s + (a.risk_score || 0); }, 0) / analyses.length;
    const securityScore = Math.max(0, Math.round(100 - avgRisk));

    const offset = 327 - (327 * securityScore / 100);
    ring.style.strokeDashoffset = offset.toString();
    setText(number, securityScore);

    if (securityScore >= 70) {
        setText(level, "Nível de proteção: Alto");
        level.style.color = "var(--success)";
        ring.style.stroke = "var(--success)";
    } else if (securityScore >= 40) {
        setText(level, "Nível de proteção: Médio");
        level.style.color = "var(--warning)";
        ring.style.stroke = "var(--warning)";
    } else {
        setText(level, "Nível de proteção: Baixo");
        level.style.color = "var(--danger)";
        ring.style.stroke = "var(--danger)";
    }

    setText(desc, "Baseado em " + analyses.length + " análise" + (analyses.length > 1 ? "s" : "") + " realizada" + (analyses.length > 1 ? "s" : ""));
}

// ============================
// UPLOAD & ANALYZE
// ============================

function handleFileSelect(file) {
    if (!file) return;

    const allowedTypes = ["txt", "csv", "json", "pdf", "xlsx"];
    const ext = file.name.split(".").pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
        showNotification("error", "Formato inválido", "O formato ." + ext + " não é suportado.");
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showNotification("error", "Arquivo muito grande", "O tamanho máximo permitido é 10MB.");
        return;
    }

    state.currentFile = file;
    setText("file-name", file.name);
    setText("file-size", formatFileSize(file.size));

    hide("upload-zone");
    show("file-list");
    hide("analysis-loading");
    hide("analysis-error");
}

function removeFile() {
    state.currentFile = null;
    $("main-file-input").value = "";
    show("upload-zone");
    hide("file-list");
    hide("analysis-loading");
    hide("analysis-error");
}

async function startAnalysis() {
    if (!state.currentFile || state.isAnalyzing) return;

    state.isAnalyzing = true;
    hide("file-list");
    show("analysis-loading");
    hide("analysis-error");

    const formData = new FormData();
    formData.append("file", state.currentFile);

    try {
        const response = await fetch(API_BASE_URL + "/analyze", {
            method: "POST",
            headers: { "Authorization": "Bearer " + state.token },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erro ao analisar arquivo.");
        }

        state.currentAnalysis = data;
        displayResults(data);
        navigateTo("results");
        showNotification("success", "Análise concluída!", "O arquivo " + data.file_name + " foi analisado com sucesso.");

    } catch (error) {
        show("analysis-error");
        setText("analysis-error", error.message);
        hide("analysis-loading");
        show("file-list");
        showNotification("error", "Erro na análise", error.message);
    } finally {
        state.isAnalyzing = false;
    }
}

// ============================
// RESULTS
// ============================

function displayResults(result) {
    const container = $("results-content");
    container.innerHTML = "";

    if (!result || !result.success) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "results-empty";
        emptyDiv.innerHTML = `
            <div class="empty-illustration"><i data-lucide="alert-triangle"></i></div>
            <h3>Erro na análise</h3>
            <p></p>
        `;
        emptyDiv.querySelector("p").textContent = (result && result.error) ? result.error : "Não foi possível processar o arquivo.";
        const btn = document.createElement("button");
        btn.className = "btn-primary";
        btn.innerHTML = '<i data-lucide="scan-search"></i> Tentar novamente';
        btn.addEventListener("click", function() { navigateTo("analyze"); });
        emptyDiv.appendChild(btn);
        container.appendChild(emptyDiv);
        if (window.lucide) lucide.createIcons({ nodes: [container] });
        return;
    }

    const isSafe = result.risk_level === "Baixo";
    const statusIcon = isSafe ? "shield-check" : (result.risk_level === "Medio" ? "alert-triangle" : "shield-alert");
    const statusClass = isSafe ? "safe" : (result.risk_level === "Medio" ? "warning" : "danger");
    const statusText = isSafe ? "Seguro" : (result.risk_level === "Medio" ? "Atenção" : "Risco detectado");

    // Overview
    const overview = document.createElement("div");
    overview.className = "result-overview";
    overview.innerHTML = `
        <div class="result-status-card">
            <div class="result-status-icon ${statusClass}"><i data-lucide="${statusIcon}"></i></div>
            <h3></h3>
            <p></p>
        </div>
        <div class="result-details-card">
            <h4>Detalhes da análise</h4>
            <div class="result-detail-row"><span>Arquivo</span><span></span></div>
            <div class="result-detail-row"><span>Tipo</span><span></span></div>
            <div class="result-detail-row"><span>Score de risco</span><span></span></div>
            <div class="result-detail-row"><span>Alertas</span><span></span></div>
        </div>
    `;
    overview.querySelector("h3").textContent = statusText;
    overview.querySelector("p").textContent = "Nível de risco: " + (result.risk_level || "--");
    const rows = overview.querySelectorAll(".result-detail-row");
    rows[0].querySelector("span:last-child").textContent = result.file_name || "--";
    rows[1].querySelector("span:last-child").textContent = (result.file_type || "").toUpperCase();
    const riskSpan = rows[2].querySelector("span:last-child");
    riskSpan.textContent = (result.risk_score || 0) + "/100";
    riskSpan.style.color = getRiskColor(result.risk_level);
    rows[3].querySelector("span:last-child").textContent = result.alerts || 0;
    container.appendChild(overview);

    // Sensitive data
    if (result.sensitive_data && result.sensitive_data.length > 0) {
        const typeIcons = {
            "CPF": "credit-card", "CNPJ": "building-2", "E-mail": "mail",
            "Telefone": "phone", "CEP": "map-pin", "Cartao de Credito": "credit-card",
            "Dado Bancario": "landmark", "Senha Exposta": "key-round",
            "Token": "key", "API Key": "code-2", "Chave Privada": "lock",
            "Endereco IP": "globe"
        };
        const grid = document.createElement("div");
        grid.className = "sensitive-grid";

        result.sensitive_data.forEach(function(item) {
            const card = document.createElement("div");
            card.className = "sensitive-card";
            const iconName = typeIcons[item.type] || "alert-circle";
            const sevColor = getRiskText(item.severity);
            const sevBg = getRiskBg(item.severity);

            card.innerHTML = `
                <div class="sensitive-card-header">
                    <div class="sensitive-card-icon" style="background: ${sevBg}; color: ${sevColor}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <span class="sensitive-card-title"></span>
                </div>
                <div class="sensitive-card-count" style="color: ${sevColor}"></div>
                <div class="sensitive-card-samples"></div>
            `;
            card.querySelector(".sensitive-card-title").textContent = item.type || "";
            card.querySelector(".sensitive-card-count").textContent = item.count || 0;
            const samplesDiv = card.querySelector(".sensitive-card-samples");
            (item.samples || []).forEach(function(s) {
                const span = document.createElement("span");
                span.className = "sensitive-sample";
                span.textContent = s;
                samplesDiv.appendChild(span);
            });
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    // Recommendations
    if (result.recommendations && result.recommendations.length > 0) {
        const recCard = document.createElement("div");
        recCard.className = "recommendations-card";
        recCard.innerHTML = '<h3><i data-lucide="lightbulb"></i> Recomendações</h3>';
        const list = document.createElement("ul");
        list.className = "recommendation-list";
        result.recommendations.forEach(function(r) {
            const li = document.createElement("li");
            li.className = "recommendation-item";
            li.innerHTML = '<i data-lucide="check-circle-2"></i><span></span>';
            li.querySelector("span").textContent = r;
            list.appendChild(li);
        });
        recCard.appendChild(list);
        container.appendChild(recCard);
    }

    // Actions
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex; gap:12px; margin-top:20px;";
    actions.innerHTML = `
        <button class="btn-primary" id="res-btn-new"><i data-lucide="scan-search"></i> Nova análise</button>
        <button class="btn-secondary" id="res-btn-history"><i data-lucide="history"></i> Ver histórico</button>
    `;
    container.appendChild(actions);

    $("res-btn-new").addEventListener("click", function() { navigateTo("analyze"); });
    $("res-btn-history").addEventListener("click", function() { navigateTo("history"); });

    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

// ============================
// HISTORY
// ============================

async function loadHistory() {
    try {
        const data = await apiRequest("/analyses");
        const tbody = $("history-tbody");
        const analyses = data.analyses || [];
        state.analyses = analyses;

        tbody.innerHTML = "";
        if (analyses.length === 0) {
            const tr = document.createElement("tr");
            tr.className = "table-empty";
            tr.innerHTML = `
                <td colspan="6">
                    <div class="empty-state">
                        <i data-lucide="inbox"></i>
                        <p>Nenhuma análise no histórico</p>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        } else {
            analyses.forEach(function(a) {
                const statusClass = a.risk_level === "Baixo" ? "badge-success" : (a.risk_level === "Medio" ? "badge-warning" : "badge-danger");
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong></strong></td>
                    <td><span class="format-tag"></span></td>
                    <td></td>
                    <td><span class="badge ${statusClass}"></span></td>
                    <td><span style="font-weight:700;"></span></td>
                    <td>
                        <button class="file-remove" title="Ver detalhes">
                            <i data-lucide="eye"></i>
                        </button>
                    </td>
                `;
                tr.querySelector("td strong").textContent = a.file_name || "Arquivo";
                tr.querySelector(".format-tag").textContent = (a.file_type || "").toUpperCase();
                tr.querySelectorAll("td")[2].textContent = formatDate(a.created_at);
                tr.querySelector(".badge").textContent = a.risk_level || "--";
                const scoreSpan = tr.querySelectorAll("td")[4].querySelector("span");
                scoreSpan.textContent = (a.risk_score || 0) + "/100";
                scoreSpan.style.color = getRiskColor(a.risk_level);
                tbody.appendChild(tr);
            });
        }
        if (window.lucide) lucide.createIcons({ nodes: [tbody] });
    } catch (error) {
        // Fail silently
    }
}

// ============================
// SETTINGS TABS
// ============================

function initSettingsTabs() {
    document.querySelectorAll("[data-settings-tab]").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const tab = btn.dataset.settingsTab;
            document.querySelectorAll("[data-settings-tab]").forEach(function(b) { b.classList.remove("active"); });
            document.querySelectorAll("#settings-account, #settings-interface, #settings-notifications, #settings-privacy").forEach(function(p) { p.classList.remove("active"); });
            btn.classList.add("active");
            var panel = $("settings-" + tab);
            if (panel) panel.classList.add("active");
        });
    });
}

function initSecurityTabs() {
    document.querySelectorAll("[data-security-tab]").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const tab = btn.dataset.securityTab;
            document.querySelectorAll("[data-security-tab]").forEach(function(b) { b.classList.remove("active"); });
            document.querySelectorAll("#security-password, #security-2fa, #security-sessions").forEach(function(p) { p.classList.remove("active"); });
            btn.classList.add("active");
            var panel = $("security-" + tab);
            if (panel) panel.classList.add("active");
        });
    });
}

// ============================
// EVENT LISTENERS (init once)
// ============================

function initEventListeners() {
    // Auth toggle
    $("show-register").addEventListener("click", function(e) {
        e.preventDefault();
        hide("login-form");
        show("register-form");
        hide("login-error");
    });

    $("show-login").addEventListener("click", function(e) {
        e.preventDefault();
        hide("register-form");
        show("login-form");
        hide("register-error");
    });

    // Forms
    $("login").addEventListener("submit", function(e) {
        e.preventDefault();
        loginUser($("login-email").value, $("login-password").value);
    });

    $("register").addEventListener("submit", function(e) {
        e.preventDefault();
        registerUser(
            $("reg-name").value,
            $("reg-email").value,
            $("reg-password").value,
            $("reg-confirm-password").value
        );
    });

    // Password visibility toggle
    document.querySelectorAll(".toggle-password").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const target = $(btn.dataset.target);
            const icon = btn.querySelector("[data-lucide]");
            if (!target || !icon) return;
            if (target.type === "password") {
                target.type = "text";
                icon.setAttribute("data-lucide", "eye-off");
            } else {
                target.type = "password";
                icon.setAttribute("data-lucide", "eye");
            }
            if (window.lucide) lucide.createIcons({ nodes: [btn] });
        });
    });

    // Navigation
    document.querySelectorAll(".nav-item[data-page]").forEach(function(link) {
        link.addEventListener("click", function(e) {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    // Sidebar
    $("sidebar-toggle").addEventListener("click", toggleSidebar);
    $("mobile-menu-btn").addEventListener("click", openMobileSidebar);
    $("sidebar-overlay").addEventListener("click", function() {
        $("sidebar").classList.remove("open");
        $("sidebar-overlay").classList.remove("active");
    });

    // Logout
    $("logout-btn").addEventListener("click", function() {
        showModal("Sair da conta", "Tem certeza que deseja sair?", logout, "Sair");
    });

    // Upload
    var uploadZone = $("upload-zone");
    var mainFileInput = $("main-file-input");

    uploadZone.addEventListener("click", function() { mainFileInput.click(); });
    uploadZone.addEventListener("dragover", function(e) {
        e.preventDefault();
        uploadZone.classList.add("dragover");
    });
    uploadZone.addEventListener("dragleave", function() {
        uploadZone.classList.remove("dragover");
    });
    uploadZone.addEventListener("drop", function(e) {
        e.preventDefault();
        uploadZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
    });

    mainFileInput.addEventListener("change", function(e) {
        if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });

    $("upload-btn-select").addEventListener("click", function(e) {
        e.stopPropagation();
        mainFileInput.click();
    });

    $("file-remove").addEventListener("click", removeFile);
    $("start-analysis").addEventListener("click", startAnalysis);

    // Quick upload
    $("quick-upload").addEventListener("click", function() {
        $("quick-file-input").click();
    });
    $("quick-file-input").addEventListener("change", function(e) {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
            navigateTo("analyze");
        }
    });

    // First analysis button
    $("btn-first-analysis").addEventListener("click", function() {
        navigateTo("analyze");
    });

    // Go analyze from results empty
    $("btn-go-analyze").addEventListener("click", function() {
        navigateTo("analyze");
    });

    // Settings tabs
    initSettingsTabs();
    initSecurityTabs();

    // Account form
    $("account-form").addEventListener("submit", async function(e) {
        e.preventDefault();
        try {
            await apiRequest("/profile", {
                method: "PUT",
                body: JSON.stringify({
                    name: $("settings-name").value,
                    email: $("settings-email").value
                })
            });
            showNotification("success", "Perfil atualizado", "Suas informações foram salvas.");
            await loadUser();
        } catch (error) {
            showNotification("error", "Erro", error.message);
        }
    });

    // Password form
    $("password-form").addEventListener("submit", async function(e) {
        e.preventDefault();
        const current = $("sec-current-password").value;
        const newPass = $("sec-new-password").value;
        const confirm = $("sec-confirm-password").value;

        if (newPass !== confirm) {
            showNotification("error", "Senhas diferentes", "A nova senha e a confirmação não coincidem.");
            return;
        }

        try {
            await apiRequest("/profile/password", {
                method: "PUT",
                body: JSON.stringify({
                    current_password: current,
                    new_password: newPass,
                    confirm_new_password: confirm
                })
            });
            showNotification("success", "Senha alterada", "Sua senha foi atualizada com sucesso.");
            $("password-form").reset();
        } catch (error) {
            showNotification("error", "Erro", error.message);
        }
    });

    // Danger zone
    $("btn-clear-history").addEventListener("click", function() {
        showModal(
            "Limpar histórico",
            "Esta ação removerá permanentemente todo o histórico de análises. Esta ação não pode ser desfeita.",
            function() {
                showNotification("info", "Em breve", "A limpeza de histórico será implementada em uma atualização futura.");
            },
            "Limpar histórico",
            true
        );
    });

    $("btn-delete-account").addEventListener("click", function() {
        showModal(
            "Excluir conta",
            "Esta ação removerá permanentemente sua conta, configurações e histórico. Esta ação não pode ser desfeita.",
            function() {
                showNotification("info", "Em breve", "A exclusão de conta será implementada em uma atualização futura.");
            },
            "Excluir conta",
            true
        );
    });

    // Theme options
    document.querySelectorAll(".theme-option").forEach(function(opt) {
        opt.addEventListener("click", function() {
            const val = opt.dataset.themeValue;
            document.querySelectorAll('input[name="theme"]').forEach(function(r) {
                r.checked = r.value === val;
            });
            setTheme(val);
        });
    });

    // Sidebar setting
    $("setting-sidebar").addEventListener("change", function(e) {
        state.sidebarCollapsed = e.target.checked;
        localStorage.setItem("sidebar_collapsed", state.sidebarCollapsed);
        $("sidebar").classList.toggle("collapsed", state.sidebarCollapsed);
    });
}

// ============================
// INIT
// ============================

document.addEventListener("DOMContentLoaded", function() {
    // Init Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Init theme
    initTheme();

    // Init event listeners
    initEventListeners();

    // Check auth
    if (state.token) {
        loadUser().then(function() {
            showMainApp();
        }).catch(function() {
            showAuth();
        });
    } else {
        showAuth();
    }
});
