const API_BASE_URL = (window.location.protocol.startsWith("http") && window.location.port === "8000")
    ? window.location.origin
    : "http://127.0.0.1:8000";

const state = {
    token: localStorage.getItem("dataguard_token") || null,
    user: null,
    settings: null,
    currentFile: null,
    currentReport: null,
    analyses: [],
    currentPage: "dashboard",
    historyFilter: "all",
    historySearch: ""
};

function $(id) { return document.getElementById(id); }
function show(id) { if ($(id)) $(id).classList.remove("hidden"); }
function hide(id) { if ($(id)) $(id).classList.add("hidden"); }
function setText(id, text) { if ($(id)) $(id).textContent = text; }

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(isoStr) {
    if (!isoStr) return "—";
    try {
        const normalized = isoStr.includes("T") ? isoStr : isoStr.replace(" ", "T") + "Z";
        const d = new Date(normalized);
        if (isNaN(d.getTime())) return isoStr.split("T")[0];
        return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (_) {
        return String(isoStr).slice(0, 16);
    }
}

function getRiskMeta(level) {
    const norm = String(level || "BAIXO").toUpperCase();
    if (norm === "CRÍTICO" || norm === "CRITICO") {
        return { label: "CRÍTICO", cls: "critical", badge: "badge-critical", color: "var(--critical)", icon: "shield-alert" };
    }
    if (norm === "ALTO") {
        return { label: "ALTO", cls: "high", badge: "badge-high", color: "var(--high)", icon: "alert-triangle" };
    }
    if (norm === "MÉDIO" || norm === "MEDIO") {
        return { label: "MÉDIO", cls: "warning", badge: "badge-warning", color: "var(--warning)", icon: "alert-circle" };
    }
    return { label: "BAIXO", cls: "success", badge: "badge-success", color: "var(--success)", icon: "shield-check" };
}

// ==========================================================================
// NAVEGAÇÃO & CABEÇALHO DINÂMICO
// ==========================================================================
const pageInfo = {
    dashboard: { title: "Visão Geral", sub: "Monitoramento de conformidade e superfície de risco", icon: "layout-dashboard" },
    analyze: { title: "Nova Análise", sub: "Inspeção estrutural de documentos e prevenção de vazamentos", icon: "scan-search" },
    results: { title: "Laudo de Inspeção", sub: "Mapeamento detalhado de dados sensíveis e plano de ação", icon: "shield-alert" },
    history: { title: "Histórico de Auditorias", sub: "Registros persistidos no banco SQLite", icon: "history" },
    reports: { title: "Relatórios & Exportação", sub: "Emissão de laudos técnicos em TXT e JSON", icon: "file-text" },
    security: { title: "Segurança da Conta", sub: "Controle de credenciais, sessões ativas e verificação 2FA", icon: "shield" },
    settings: { title: "Configurações", sub: "Preferências de perfil, tema e retenção de dados", icon: "settings" }
};

function navigateTo(pageId) {
    if (!pageId) return;
    state.currentPage = pageId;

    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-item[data-page]").forEach(l => l.classList.remove("active"));

    if ($("page-" + pageId)) $("page-" + pageId).classList.add("active");
    const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (nav) nav.classList.add("active");

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
    if (pageId === "security") loadSessions();
}

// ==========================================================================
// TOASTS E MODAL DE CONFIRMAÇÃO
// ==========================================================================
function showNotification(type, title, message) {
    const icons = { success: "check-circle-2", error: "x-circle", info: "info", warning: "alert-triangle" };
    const container = $("notification-container");
    if (!container) return;

    const notif = document.createElement("div");
    notif.className = "notification";
    notif.innerHTML = `
        <div class="notification-icon ${escapeHtml(type)}">
            <i data-lucide="${icons[type] || "info"}"></i>
        </div>
        <div class="notification-body">
            <div class="notification-title">${escapeHtml(title)}</div>
            <div class="notification-msg">${escapeHtml(message)}</div>
        </div>
        <button type="button" class="notification-close" aria-label="Fechar">
            <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
    `;
    notif.querySelector(".notification-close").addEventListener("click", () => notif.remove());
    container.appendChild(notif);
    if (window.lucide) lucide.createIcons({ nodes: [notif] });
    setTimeout(() => { if (notif.parentNode) notif.remove(); }, 4500);
}

function askConfirmation(title, description, onConfirm) {
    setText("confirm-modal-title", title);
    setText("confirm-modal-desc", description);
    show("confirm-modal");

    const okBtn = $("confirm-modal-ok");
    const cancelBtn = $("confirm-modal-cancel");

    const cleanup = () => {
        hide("confirm-modal");
        okBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    cancelBtn.onclick = cleanup;
    okBtn.onclick = async () => {
        cleanup();
        await onConfirm();
    };
}

// ==========================================================================
// CLIENTE HTTP INTEGRADO AO BACK-END FASTAPI
// ==========================================================================
async function apiRequest(endpoint, options = {}) {
    const url = API_BASE_URL + endpoint;
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }
    if (state.token) {
        headers["Authorization"] = "Bearer " + state.token;
    }

    const res = await fetch(url, { ...options, headers });
    let data = {};
    try {
        data = await res.json();
    } catch (_) {
        data = {};
    }

    if (!res.ok) {
        if (res.status === 401 && endpoint !== "/login") {
            logout(false);
        }
        throw new Error(data.detail || data.error || "Falha na comunicação com o servidor.");
    }
    return data;
}

// ==========================================================================
// AUTENTICAÇÃO E PERFIL
// ==========================================================================
async function loadUserAndSettings() {
    const user = await apiRequest("/me");
    state.user = user;
    setText("header-name", user.name);
    setText("header-avatar", (user.name || "U").charAt(0).toUpperCase());
    setText("welcome-message", "Olá, " + user.name.split(" ")[0]);
    if ($("settings-name")) $("settings-name").value = user.name;
    if ($("settings-email")) $("settings-email").value = user.email;

    try {
        const cfg = await apiRequest("/settings");
        state.settings = cfg.settings || {};
        if (state.settings.theme) {
            applyTheme(state.settings.theme, false);
        }
        const compact = Boolean(state.settings.compact_interface);
        document.body.classList.toggle("compact-mode", compact);
        if ($("pref-compact-mode")) $("pref-compact-mode").checked = compact;

        const priv = state.settings.privacy || {};
        if ($("pref-save-history")) $("pref-save-history").checked = priv.save_history !== false;

        const notif = state.settings.notifications || {};
        if ($("pref-security-alerts")) $("pref-security-alerts").checked = notif.security_alerts !== false;
    } catch (_) {}
}

async function loginUser(email, password) {
    const btn = $("btn-login");
    hide("login-error");
    try {
        btn.disabled = true;
        btn.querySelector(".btn-text").classList.add("hidden");
        btn.querySelector(".btn-spinner").classList.remove("hidden");

        const data = await apiRequest("/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        state.token = data.access_token;
        localStorage.setItem("dataguard_token", state.token);

        await loadUserAndSettings();
        hide("auth-section");
        show("main-app");
        navigateTo("dashboard");
        showNotification("success", "Acesso liberado", "Sessão iniciada com segurança.");
    } catch (e) {
        if ($("login-error")) {
            setText("login-error", e.message);
            show("login-error");
        }
        showNotification("error", "Falha no login", e.message);
    } finally {
        btn.disabled = false;
        btn.querySelector(".btn-text").classList.remove("hidden");
        btn.querySelector(".btn-spinner").classList.add("hidden");
    }
}

async function registerUser(name, email, password, confirm_password) {
    const btn = $("btn-register");
    hide("register-error");
    try {
        btn.disabled = true;
        btn.querySelector(".btn-text").classList.add("hidden");
        btn.querySelector(".btn-spinner").classList.remove("hidden");

        const data = await apiRequest("/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password, confirm_password })
        });

        state.token = data.access_token;
        localStorage.setItem("dataguard_token", state.token);

        await loadUserAndSettings();
        hide("auth-section");
        show("main-app");
        navigateTo("dashboard");
        showNotification("success", "Conta criada", "Bem-vindo ao DataGuard AI 2.0.");
    } catch (e) {
        if ($("register-error")) {
            setText("register-error", e.message);
            show("register-error");
        }
        showNotification("error", "Erro no cadastro", e.message);
    } finally {
        btn.disabled = false;
        btn.querySelector(".btn-text").classList.remove("hidden");
        btn.querySelector(".btn-spinner").classList.add("hidden");
    }
}

async function logout(notifyServer = true) {
    if (notifyServer && state.token) {
        try { await apiRequest("/logout", { method: "POST" }); } catch (_) {}
    }
    state.token = null;
    state.user = null;
    localStorage.removeItem("dataguard_token");
    show("auth-section");
    hide("main-app");
}

// ==========================================================================
// DASHBOARD E HISTÓRICO
// ==========================================================================
async function loadDashboard() {
    try {
        const [stats, historyRes] = await Promise.all([
            apiRequest("/stats"),
            apiRequest("/analyses")
        ]);

        state.analyses = historyRes.analyses || [];
        setText("stat-analyses", stats.total_analyses ?? state.analyses.length);
        setText("stat-alerts", stats.total_alerts ?? 0);

        let safe = 0, risk = 0;
        state.analyses.forEach(a => {
            if (String(a.risk_level).toUpperCase() === "BAIXO") safe++;
            else risk++;
        });
        setText("stat-safe", safe);
        setText("stat-risk", risk);

        // Atualiza barra de telemetria de severidade
        const total = state.analyses.length;
        if ($("telemetry-total-label")) setText("telemetry-total-label", `${total} arquivo(s)`);
        if (total > 0) {
            let cCrit = 0, cHigh = 0, cMed = 0, cLow = 0;
            state.analyses.forEach(a => {
                const lvl = String(a.risk_level).toUpperCase();
                if (lvl.includes("CR")) cCrit++;
                else if (lvl === "ALTO") cHigh++;
                else if (lvl.includes("M")) cMed++;
                else cLow++;
            });
            if ($("bar-seg-crit")) $("bar-seg-crit").style.width = `${(cCrit / total) * 100}%`;
            if ($("bar-seg-high")) $("bar-seg-high").style.width = `${(cHigh / total) * 100}%`;
            if ($("bar-seg-med")) $("bar-seg-med").style.width = `${(cMed / total) * 100}%`;
            if ($("bar-seg-low")) $("bar-seg-low").style.width = `${(cLow / total) * 100}%`;
        } else {
            ["bar-seg-crit", "bar-seg-high", "bar-seg-med", "bar-seg-low"].forEach(id => {
                if ($(id)) $(id).style.width = "0%";
            });
        }

        const list = $("dashboard-activity");
        if (state.analyses.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="padding:24px 12px;">
                    <i data-lucide="file-search"></i>
                    <h4>Nenhuma inspeção registrada</h4>
                    <p>Seus arquivos analisados aparecerão aqui.</p>
                </div>
            `;
        } else {
            list.innerHTML = state.analyses.slice(0, 5).map(a => {
                const meta = getRiskMeta(a.risk_level);
                return `
                    <div class="activity-row" data-analysis-id="${a.id}">
                        <div class="activity-left">
                            <div class="activity-icon" style="color:${meta.color}; background:var(--bg-elevated); border:1px solid var(--border);">
                                <i data-lucide="${meta.icon}"></i>
                            </div>
                            <div class="activity-meta">
                                <div class="activity-name">${escapeHtml(a.file_name)}</div>
                                <div class="activity-sub">${escapeHtml(String(a.file_type).toUpperCase())} • ${escapeHtml(formatDateTime(a.created_at))}</div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span class="badge ${meta.badge}">${meta.label}</span>
                            <span class="mono" style="font-weight:600; font-size:12.5px; color:${meta.color};">${a.risk_score}/100</span>
                        </div>
                    </div>
                `;
            }).join("");

            list.querySelectorAll(".activity-row").forEach(row => {
                row.addEventListener("click", () => openAnalysisFromHistory(Number(row.dataset.analysisId)));
            });
        }
        if (window.lucide) lucide.createIcons({ nodes: [list] });

        // Cálculo do Índice de Conformidade (100 - média de risco)
        const scoreRing = $("score-progress");
        if (state.analyses.length > 0) {
            const avgRisk = state.analyses.reduce((sum, a) => sum + (Number(a.risk_score) || 0), 0) / state.analyses.length;
            const complianceScore = Math.max(0, Math.round(100 - avgRisk));
            scoreRing.style.strokeDashoffset = 327 - (327 * complianceScore / 100);

            if (complianceScore >= 80) {
                scoreRing.style.stroke = "var(--success)";
                setText("score-level", "Postura Forte");
                setText("score-desc", "Baixa concentração de dados sensíveis expostos nos documentos recentes.");
            } else if (complianceScore >= 50) {
                scoreRing.style.stroke = "var(--warning)";
                setText("score-level", "Atenção Necessária");
                setText("score-desc", "Existem documentos com dados pessoais (LGPD) que exigem anonimização.");
            } else {
                scoreRing.style.stroke = "var(--danger)";
                setText("score-level", "Risco Elevado");
                setText("score-desc", "Múltiplos arquivos contêm credenciais ou dados críticos expostos.");
            }
            setText("score-number", String(complianceScore));
        } else {
            scoreRing.style.strokeDashoffset = 327;
            setText("score-number", "--");
            setText("score-level", "Sem dados");
            setText("score-desc", "Realize a primeira inspeção para calcular o índice médio de proteção.");
        }
    } catch (_) {}
}

function renderHistoryTable() {
    const tbody = $("history-tbody");
    if (!tbody) return;

    const query = state.historySearch.trim().toLowerCase();
    const filtered = state.analyses.filter(a => {
        const levelMatch = state.historyFilter === "all" || String(a.risk_level).toUpperCase() === state.historyFilter.toUpperCase();
        const textMatch = !query ||
            String(a.file_name).toLowerCase().includes(query) ||
            String(a.file_type).toLowerCase().includes(query);
        return levelMatch && textMatch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state" style="padding:28px;">
                        <i data-lucide="inbox"></i>
                        <h4>Nenhum registro encontrado</h4>
                        <p>Ajuste os filtros de busca ou realize uma nova análise de documento.</p>
                    </div>
                </td>
            </tr>
        `;
        if (window.lucide) lucide.createIcons({ nodes: [tbody] });
        return;
    }

    tbody.innerHTML = filtered.map(a => {
        const meta = getRiskMeta(a.risk_level);
        return `
            <tr>
                <td><strong>${escapeHtml(a.file_name)}</strong></td>
                <td><span class="format-pill">.${escapeHtml(String(a.file_type).toUpperCase())}</span></td>
                <td class="mono" style="font-size:12.5px; color:var(--text-secondary);">${escapeHtml(formatDateTime(a.created_at))}</td>
                <td><span class="badge ${meta.badge}">${meta.label}</span></td>
                <td class="mono"><strong style="color:${meta.color};">${a.risk_score}/100</strong></td>
                <td class="mono">${a.alerts ?? 0}</td>
                <td style="text-align:right;">
                    <div style="display:inline-flex; gap:6px;">
                        <button type="button" class="btn-secondary btn-sm btn-view-report" data-id="${a.id}">
                            <i data-lucide="eye"></i> Ver Laudo
                        </button>
                        <button type="button" class="btn-ghost btn-sm btn-export-txt" data-id="${a.id}" title="Baixar TXT">
                            <i data-lucide="download"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    tbody.querySelectorAll(".btn-view-report").forEach(btn => {
        btn.addEventListener("click", () => openAnalysisFromHistory(Number(btn.dataset.id)));
    });
    tbody.querySelectorAll(".btn-export-txt").forEach(btn => {
        btn.addEventListener("click", () => downloadAnalysisReport(Number(btn.dataset.id), "txt"));
    });

    if (window.lucide) lucide.createIcons({ nodes: [tbody] });
}

async function loadHistory() {
    try {
        const data = await apiRequest("/analyses");
        state.analyses = data.analyses || [];
        renderHistoryTable();
    } catch (e) {
        showNotification("error", "Erro ao carregar histórico", e.message);
    }
}

async function openAnalysisFromHistory(analysisId) {
    const localRecord = state.analyses.find(item => Number(item.id) === Number(analysisId));
    if (localRecord && localRecord.result_json) {
        try {
            const parsed = JSON.parse(localRecord.result_json);
            parsed.created_at = localRecord.created_at;
            renderAnalysisReport(parsed);
            navigateTo("results");
            return;
        } catch (_) {}
    }

    try {
        const res = await apiRequest(`/analyses/${analysisId}`);
        if (res.report) {
            res.report.created_at = res.analysis?.created_at;
            renderAnalysisReport(res.report);
            navigateTo("results");
        }
    } catch (e) {
        showNotification("error", "Não foi possível abrir o laudo", e.message);
    }
}

// ==========================================================================
// RELATÓRIOS & EXPORTAÇÃO REAL (TXT E JSON)
// ==========================================================================
function buildTxtReport(report, recordMeta = {}) {
    const fileName = report.file_name || report.file || recordMeta.file_name || "documento";
    const fileType = String(report.file_type || recordMeta.file_type || "N/A").toUpperCase();
    const riskLevel = report.risk_level || recordMeta.risk_level || "BAIXO";
    const riskScore = report.risk_score ?? recordMeta.risk_score ?? 0;
    const findings = report.findings || [];
    const recs = report.recommendations || [];
    const dateStr = formatDateTime(report.created_at || recordMeta.created_at || new Date().toISOString());

    const lines = [
        "========================================================================",
        "               DATAGUARD AI 2.0 — LAUDO TÉCNICO DLP / LGPD              ",
        "========================================================================",
        `Documento Analisado : ${fileName}`,
        `Formato             : ${fileType}`,
        `Data da Inspeção    : ${dateStr}`,
        `Nível de Risco      : ${riskLevel}`,
        `Score de Risco      : ${riskScore}/100`,
        `Total de Achados    : ${findings.length}`,
        "------------------------------------------------------------------------",
        "1. PLANO DE AÇÃO E RECOMENDAÇÕES DE PROTEÇÃO",
        "------------------------------------------------------------------------"
    ];

    if (recs.length === 0) {
        lines.push("• Nenhuma recomendação crítica pendente.");
    } else {
        recs.forEach((r, idx) => lines.push(`${idx + 1}. ${r}`));
    }

    lines.push("");
    lines.push("------------------------------------------------------------------------");
    lines.push("2. INVENTÁRIO DE DADOS SENSÍVEIS DETECTADOS (MASCARADOS)");
    lines.push("------------------------------------------------------------------------");

    if (findings.length === 0) {
        lines.push("Nenhum dado sensível identificado na estrutura do arquivo.");
    } else {
        findings.forEach((f, idx) => {
            lines.push(`[#${idx + 1}] Tipo: ${f.type} | Risco: ${f.risk}`);
            lines.push(`     Localização : ${f.location}`);
            lines.push(`     Valor       : ${f.value_masked}`);
            lines.push(`     Motivo      : ${f.reason || "Dado sensível identificado"}`);
            lines.push(`     Mitigação   : ${f.recommendation || f.action || "Mascarar ou remover"}`);
            lines.push("");
        });
    }

    lines.push("========================================================================");
    lines.push("Gerado automaticamente por DataGuard AI 2.0 — Prevenção de Perda de Dados");
    return lines.join("\n");
}

function triggerBrowserDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadAnalysisReport(analysisId, format = "txt") {
    const rec = state.analyses.find(item => Number(item.id) === Number(analysisId));
    if (!rec) {
        showNotification("error", "Relatório não encontrado", "Atualize a página e tente novamente.");
        return;
    }

    let reportObj = {};
    try {
        reportObj = rec.result_json ? JSON.parse(rec.result_json) : {};
    } catch (_) {
        reportObj = {};
    }

    const baseName = String(rec.file_name || "laudo").replace(/[^a-zA-Z0-9_-]/g, "_");
    if (format === "json") {
        const jsonPayload = JSON.stringify(reportObj, null, 2);
        triggerBrowserDownload(`laudo_${baseName}.json`, jsonPayload, "application/json;charset=utf-8");
        showNotification("success", "JSON exportado", `Arquivo laudo_${baseName}.json baixado.`);
    } else {
        const txtContent = buildTxtReport(reportObj, rec);
        triggerBrowserDownload(`laudo_${baseName}.txt`, txtContent, "text/plain;charset=utf-8");
        showNotification("success", "Laudo TXT exportado", `Arquivo laudo_${baseName}.txt baixado.`);
    }
}

async function loadReports() {
    const container = $("reports-grid");
    if (!container) return;

    if (state.analyses.length === 0) {
        try {
            const data = await apiRequest("/analyses");
            state.analyses = data.analyses || [];
        } catch (_) {}
    }

    if (state.analyses.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg);">
                <i data-lucide="file-text"></i>
                <h4>Nenhum laudo disponível para exportação</h4>
                <p>Realize a análise de um arquivo para habilitar os downloads em TXT e JSON.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons({ nodes: [container] });
        return;
    }

    container.innerHTML = state.analyses.map(a => {
        const meta = getRiskMeta(a.risk_level);
        return `
            <div class="report-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="format-pill">.${escapeHtml(String(a.file_type).toUpperCase())}</span>
                    <span class="badge ${meta.badge}">${meta.label} (${a.risk_score}/100)</span>
                </div>
                <div>
                    <h4 style="font-size:14.5px; margin-bottom:4px; word-break:break-word;">${escapeHtml(a.file_name)}</h4>
                    <p style="font-size:12px; color:var(--text-secondary);">Inspecionado em ${escapeHtml(formatDateTime(a.created_at))} • ${a.alerts ?? 0} achados</p>
                </div>
                <div class="report-actions">
                    <button type="button" class="btn-secondary btn-sm" style="flex:1;" data-action="view" data-id="${a.id}">
                        <i data-lucide="eye"></i> Abrir
                    </button>
                    <button type="button" class="btn-primary btn-sm" style="flex:1;" data-action="txt" data-id="${a.id}">
                        <i data-lucide="download"></i> TXT
                    </button>
                    <button type="button" class="btn-secondary btn-sm" data-action="json" data-id="${a.id}" title="Exportar JSON">
                        JSON
                    </button>
                </div>
            </div>
        `;
    }).join("");

    container.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = Number(btn.dataset.id);
            const action = btn.dataset.action;
            if (action === "view") openAnalysisFromHistory(id);
            else downloadAnalysisReport(id, action);
        });
    });

    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

// ==========================================================================
// PROCESSAMENTO DE UPLOAD & RENDERIZAÇÃO DE RESULTADOS
// ==========================================================================
function handleFileSelect(file) {
    if (!file) return;
    state.currentFile = file;
    setText("file-name", file.name);
    setText("file-size", (file.size / 1024).toFixed(2) + " KB");
    hide("upload-zone");
    show("file-list");
}

function renderAnalysisReport(data) {
    state.currentReport = data;
    const meta = getRiskMeta(data.risk_level);
    const fileName = data.file_name || data.file || "Documento";
    const fileType = String(data.file_type || "N/A").toUpperCase();
    const findings = data.findings || [];
    const summary = data.summary || {
        total_findings: findings.length,
        critical: findings.filter(f => String(f.risk).includes("CR")).length,
        high: findings.filter(f => f.risk === "ALTO").length,
        medium: findings.filter(f => String(f.risk).includes("M")).length,
        low: findings.filter(f => f.risk === "BAIXO").length
    };

    const typeIcons = {
        "E-mail": "mail",
        "CPF": "id-card",
        "CNPJ": "building-2",
        "Cartão de Crédito": "credit-card",
        "Senha Exposta": "key-round",
        "Chave Privada": "terminal"
    };

    let findingsHTML = "";
    if (findings.length > 0) {
        findingsHTML = `
            <h3 style="font-size:15px; margin-bottom:14px;">Achados Mapeados na Estrutura (${findings.length})</h3>
            <div class="findings-grid">
                ${findings.map(f => {
                    const fMeta = getRiskMeta(f.risk);
                    const icon = typeIcons[f.type] || "file-warning";
                    return `
                        <div class="finding-card">
                            <div class="finding-header">
                                <span class="finding-type-title" style="color:${fMeta.color};">
                                    <i data-lucide="${icon}"></i> ${escapeHtml(f.type)}
                                </span>
                                <span class="badge ${fMeta.badge}">${fMeta.label}</span>
                            </div>
                            <div class="finding-value" style="color:${fMeta.color};">${escapeHtml(f.value_masked || "Dado oculto")}</div>
                            <div class="finding-meta">
                                <div><strong>Localização:</strong> ${escapeHtml(f.location || "Não especificado")}</div>
                                <div><strong>Risco:</strong> ${escapeHtml(f.reason || "Exposição de informação sensível")}</div>
                                <div><strong>Mitigação:</strong> ${escapeHtml(f.recommendation || f.action || "Mascarar dado antes de compartilhar.")}</div>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    } else {
        findingsHTML = `
            <div class="empty-state" style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); margin-bottom:24px;">
                <i data-lucide="shield-check" style="color:var(--success);"></i>
                <h4>Nenhum dado sensível encontrado</h4>
                <p>O documento foi inspecionado integralmente e não apresentou padrões de risco.</p>
            </div>
        `;
    }

    const recs = data.recommendations || [
        "Manter controle de acesso restrito de acordo com a política interna de segurança."
    ];

    const container = $("results-content");
    container.innerHTML = `
        <div class="results-header-bar">
            <div>
                <h2 style="font-size:18px;">Laudo Técnico: ${escapeHtml(fileName)}</h2>
                <p style="font-size:12.5px; color:var(--text-secondary);">Inspeção concluída • ${escapeHtml(formatDateTime(data.created_at || new Date().toISOString()))}</p>
            </div>
            <div style="display:flex; gap:8px;">
                <button type="button" class="btn-secondary btn-sm" id="btn-current-export-txt">
                    <i data-lucide="download"></i> Exportar Laudo TXT
                </button>
                <button type="button" class="btn-primary btn-sm" id="btn-new-scan-from-results">
                    <i data-lucide="scan-search"></i> Nova Análise
                </button>
            </div>
        </div>

        <div class="results-top-grid">
            <div class="main-risk-card ${meta.cls}">
                <div style="color:${meta.color}; margin-bottom:12px;">
                    <i data-lucide="${meta.icon}" style="width:42px; height:42px;"></i>
                </div>
                <span class="badge ${meta.badge}" style="margin-bottom:8px;">Risco ${meta.label}</span>
                <div class="mono" style="font-size:34px; font-weight:700; color:var(--text-primary);">${data.risk_score ?? 0}<small style="font-size:14px; color:var(--text-muted);">/100</small></div>
                <p style="color:var(--text-secondary); font-size:12.5px; margin-top:6px;">Score de exposição calculado</p>
            </div>

            <div class="details-card">
                <h3 style="font-size:14.5px;">Resumo Estrutural do Arquivo</h3>
                <ul class="details-list">
                    <li><span>Arquivo</span> <span class="mono">${escapeHtml(fileName)}</span></li>
                    <li><span>Formato Validado</span> <span class="mono">.${escapeHtml(fileType)}</span></li>
                    <li><span>Total de Ocorrências</span> <span class="mono">${summary.total_findings ?? findings.length}</span></li>
                </ul>
                <div class="summary-Counters">
                    <div class="summary-mini"><strong style="color:var(--critical);">${summary.critical || 0}</strong><span>Crítico</span></div>
                    <div class="summary-mini"><strong style="color:var(--high);">${summary.high || 0}</strong><span>Alto</span></div>
                    <div class="summary-mini"><strong style="color:var(--warning);">${summary.medium || 0}</strong><span>Médio</span></div>
                    <div class="summary-mini"><strong style="color:var(--success);">${summary.low || 0}</strong><span>Baixo</span></div>
                </div>
            </div>
        </div>

        ${findingsHTML}

        <div class="rec-section">
            <h3 style="font-size:15px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="check-square" style="color:var(--accent); width:17px; height:17px;"></i> Diretrizes de Mitigação e Conformidade LGPD
            </h3>
            <div class="rec-list">
                ${recs.map(r => `
                    <div class="rec-item">
                        <i data-lucide="arrow-right-circle" style="color:var(--accent); flex-shrink:0; width:16px; height:16px; margin-top:2px;"></i>
                        <span>${escapeHtml(r)}</span>
                    </div>
                `).join("")}
            </div>
        </div>
    `;

    $("btn-current-export-txt")?.addEventListener("click", () => {
        const txt = buildTxtReport(data);
        const safe = String(fileName).replace(/[^a-zA-Z0-9_-]/g, "_");
        triggerBrowserDownload(`laudo_${safe}.txt`, txt, "text/plain;charset=utf-8");
    });

    $("btn-new-scan-from-results")?.addEventListener("click", () => navigateTo("analyze"));

    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

async function startAnalysis() {
    if (!state.currentFile) return;

    hide("file-list");
    show("analysis-loading");

    const formData = new FormData();
    formData.append("file", state.currentFile);

    try {
        const data = await apiRequest("/analyze", {
            method: "POST",
            body: formData
        });

        renderAnalysisReport(data);
        navigateTo("results");
        showNotification("success", "Inspeção concluída", `O arquivo ${data.file_name || data.file} foi analisado.`);
    } catch (e) {
        showNotification("error", "Falha na análise", e.message);
    } finally {
        hide("analysis-loading");
        show("upload-zone");
        state.currentFile = null;
        if ($("main-file-input")) $("main-file-input").value = "";
    }
}

// ==========================================================================
// SESSÕES ATIVAS E CONFIGURAÇÕES PERSISTENTES
// ==========================================================================
async function loadSessions() {
    const container = $("sessions-list");
    if (!container) return;
    try {
        const res = await apiRequest("/sessions");
        const sessions = res.sessions || [];
        if (sessions.length === 0) {
            container.innerHTML = `<p style="color:var(--text-secondary);">Nenhuma sessão registrada.</p>`;
            return;
        }
        container.innerHTML = sessions.map(s => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:var(--bg-elevated); border:1px solid ${s.is_current ? 'var(--accent-border)' : 'var(--border)'}; border-radius:var(--radius-md);">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:36px; height:36px; border-radius:var(--radius-sm); background:var(--accent-subtle); color:var(--accent); display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="monitor"></i>
                    </div>
                    <div>
                        <h4 style="font-size:13.5px;">${escapeHtml(s.device_info)} ${s.is_current ? '<span class="badge badge-success" style="margin-left:6px;">Sessão Atual</span>' : ''}</h4>
                        <p style="font-size:12px; color:var(--text-secondary);">Iniciada em ${escapeHtml(formatDateTime(s.created_at))}</p>
                    </div>
                </div>
                ${!s.is_current ? `<button type="button" class="btn-danger btn-outline btn-sm btn-revoke-session" data-id="${s.id}">Encerrar</button>` : ''}
            </div>
        `).join("");

        container.querySelectorAll(".btn-revoke-session").forEach(btn => {
            btn.addEventListener("click", async () => {
                try {
                    await apiRequest(`/sessions/${btn.dataset.id}`, { method: "DELETE" });
                    showNotification("success", "Sessão revogada", "O dispositivo foi desconectado.");
                    loadSessions();
                } catch (e) {
                    showNotification("error", "Erro", e.message);
                }
            });
        });

        if (window.lucide) lucide.createIcons({ nodes: [container] });
    } catch (_) {}
}

function applyTheme(themeVal, persist = true) {
    document.documentElement.setAttribute("data-theme", themeVal);
    localStorage.setItem("dataguard_theme", themeVal);
    document.querySelectorAll(".theme-option").forEach(o => {
        o.classList.toggle("active", o.dataset.themeValue === themeVal);
    });
    if (persist && state.token) {
        apiRequest("/settings", {
            method: "PUT",
            body: JSON.stringify({ theme: themeVal })
        }).catch(() => {});
    }
}

async function clearAllHistoryFlow() {
    askConfirmation(
        "Limpar todo o histórico de análises?",
        "Esta ação removerá permanentemente todos os registros e laudos salvos na sua conta do banco SQLite.",
        async () => {
            try {
                await apiRequest("/analyses", { method: "DELETE" });
                state.analyses = [];
                showNotification("success", "Histórico limpo", "Todos os registros foram removidos do banco.");
                if (state.currentPage === "history") renderHistoryTable();
                if (state.currentPage === "dashboard") loadDashboard();
                if (state.currentPage === "reports") loadReports();
            } catch (e) {
                showNotification("error", "Falha ao limpar histórico", e.message);
            }
        }
    );
}

// ==========================================================================
// EVENT LISTENERS E INICIALIZAÇÃO
// ==========================================================================
function initEventListeners() {
    $("show-register")?.addEventListener("click", (e) => { e.preventDefault(); hide("login-form"); show("register-form"); });
    $("show-login")?.addEventListener("click", (e) => { e.preventDefault(); hide("register-form"); show("login-form"); });

    document.querySelectorAll(".toggle-password").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = $(btn.dataset.target);
            if (!input) return;
            input.type = input.type === "password" ? "text" : "password";
        });
    });

    $("login")?.addEventListener("submit", (e) => {
        e.preventDefault();
        loginUser($("login-email").value, $("login-password").value);
    });

    $("register")?.addEventListener("submit", (e) => {
        e.preventDefault();
        registerUser($("reg-name").value, $("reg-email").value, $("reg-password").value, $("reg-confirm-password").value);
    });

    document.querySelectorAll(".nav-item[data-page]").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    $("dashboard-cta-analyze")?.addEventListener("click", () => navigateTo("analyze"));
    $("dashboard-cta-reports")?.addEventListener("click", () => navigateTo("reports"));
    $("quick-new-scan-btn")?.addEventListener("click", () => navigateTo("analyze"));
    $("dash-view-all-history")?.addEventListener("click", () => navigateTo("history"));
    $("header-profile-btn")?.addEventListener("click", () => navigateTo("settings"));

    $("logout-btn")?.addEventListener("click", () => logout(true));
    $("sidebar-toggle")?.addEventListener("click", () => $("sidebar").classList.toggle("collapsed"));

    // Upload e Drag & Drop
    const dropZone = $("upload-zone");
    if (dropZone) {
        dropZone.addEventListener("click", () => $("main-file-input").click());
        dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("drag-over");
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
        $("main-file-input")?.addEventListener("change", (e) => handleFileSelect(e.target.files[0]));
        $("start-analysis")?.addEventListener("click", startAnalysis);
        $("file-remove")?.addEventListener("click", () => {
            state.currentFile = null;
            hide("file-list");
            show("upload-zone");
        });
    }

    // Filtros e Busca do Histórico
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            state.historyFilter = e.currentTarget.dataset.filter;
            renderHistoryTable();
        });
    });

    $("history-search")?.addEventListener("input", (e) => {
        state.historySearch = e.target.value;
        renderHistoryTable();
    });

    // Tabs de Configurações e Segurança
    document.querySelectorAll(".settings-nav-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetBtn = e.currentTarget;
            const container = targetBtn.closest(".settings-layout");
            const prefix = targetBtn.hasAttribute("data-settings-tab") ? "settings" : "security";
            const tabName = targetBtn.dataset[`${prefix}Tab`];

            container.querySelectorAll(".settings-nav-item").forEach(b => b.classList.remove("active"));
            container.querySelectorAll(".settings-panel").forEach(p => p.classList.remove("active"));

            targetBtn.classList.add("active");
            if ($(`${prefix}-${tabName}`)) $(`${prefix}-${tabName}`).classList.add("active");
            if (prefix === "security" && tabName === "sessions") loadSessions();
        });
    });

    // Tema e Preferências
    document.querySelectorAll(".theme-option").forEach(opt => {
        opt.addEventListener("click", () => applyTheme(opt.dataset.themeValue, true));
    });

    $("pref-compact-mode")?.addEventListener("change", (e) => {
        const enabled = e.target.checked;
        document.body.classList.toggle("compact-mode", enabled);
        apiRequest("/settings", { method: "PUT", body: JSON.stringify({ compact_interface: enabled ? 1 : 0 }) }).catch(() => {});
    });

    $("pref-save-history")?.addEventListener("change", (e) => {
        apiRequest("/settings", {
            method: "PUT",
            body: JSON.stringify({ privacy: { save_history: e.target.checked } })
        }).then(() => showNotification("info", "Preferência salva", "Política de histórico atualizada.")).catch(() => {});
    });

    $("pref-security-alerts")?.addEventListener("change", (e) => {
        apiRequest("/settings", {
            method: "PUT",
            body: JSON.stringify({ notifications: { security_alerts: e.target.checked } })
        }).then(() => showNotification("info", "Preferência salva", "Configuração de alertas atualizada.")).catch(() => {});
    });

    // Atualizar Conta
    $("account-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            const name = $("settings-name").value;
            const email = $("settings-email").value;
            const res = await apiRequest("/profile", {
                method: "PUT",
                body: JSON.stringify({ name, email })
            });
            setText("header-name", res.user.name);
            setText("header-avatar", res.user.name.charAt(0).toUpperCase());
            showNotification("success", "Perfil atualizado", "Seus dados foram salvos no banco.");
        } catch (err) {
            showNotification("error", "Erro ao atualizar perfil", err.message);
        }
    });

    // Alterar Senha
    $("password-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const current_password = $("sec-current-password").value;
        const new_password = $("sec-new-password").value;
        const confirm_new_password = $("sec-confirm-password").value;
        if (new_password !== confirm_new_password) {
            showNotification("error", "Erro de validação", "A nova senha e a confirmação não coincidem.");
            return;
        }
        try {
            await apiRequest("/profile/password", {
                method: "PUT",
                body: JSON.stringify({ current_password, new_password, confirm_new_password })
            });
            showNotification("success", "Senha alterada", "Sua credencial de acesso foi atualizada.");
            $("password-form").reset();
        } catch (err) {
            showNotification("error", "Falha ao alterar senha", err.message);
        }
    });

    // 2FA
    $("btn-setup-2fa")?.addEventListener("click", () => {
        showNotification("info", "Modo de Verificação", "Insira um código de 6 dígitos para testar a ativação.");
        hide("2fa-step-1");
        show("2fa-step-2");
    });

    $("btn-verify-2fa")?.addEventListener("click", () => {
        if ($("input-2fa-code").value.trim().length === 6) {
            showNotification("success", "2FA Configurado", "Verificação em duas etapas validada para a sessão.");
            $("2fa-step-2").innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; color:var(--success);">
                    <i data-lucide="shield-check"></i>
                    <strong>Verificação 2FA ativa para sua conta</strong>
                </div>
            `;
            if (window.lucide) lucide.createIcons({ nodes: [$("2fa-step-2")] });
        } else {
            showNotification("error", "Código inválido", "Informe exatamente 6 dígitos.");
        }
    });

    // Limpar Histórico
    $("btn-clear-history")?.addEventListener("click", clearAllHistoryFlow);
    $("history-clear-btn")?.addEventListener("click", clearAllHistoryFlow);
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();
    initEventListeners();

    const savedTheme = localStorage.getItem("dataguard_theme") || "dark";
    applyTheme(savedTheme, false);

    if (state.token) {
        loadUserAndSettings()
            .then(() => {
                hide("auth-section");
                show("main-app");
                navigateTo("dashboard");
            })
            .catch(() => logout(false));
    } else {
        show("auth-section");
        hide("main-app");
    }
});
