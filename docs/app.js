const problemMeta = {
  machine: {
    label: "Machine Scheduling", short: "Machine", color: "#1976c9",
    columns: ["Instância", "n", "Binárias", "Objetivo", "Tempo", "Gap", "Status"]
  },
  jobshop: {
    label: "Job Shop Scheduling", short: "Job Shop", color: "#2f8f43",
    columns: ["Instância", "Dimensão", "Binárias", "Objetivo", "Ótimo", "Desvio", "Status"]
  },
  flowshop: {
    label: "Flow Shop Scheduling", short: "Flow Shop", color: "#7a34a8",
    columns: ["Instância", "Dimensão", "Binárias", "NEH", "MILO", "Melhoria", "Status"]
  }
};

const dashboardData = window.SCHEDULING_DATA;
if (!dashboardData) {
  throw new Error("dashboard/data.js ausente. Execute 02_EXECUTAR_EXPERIMENTOS.cmd.");
}
const results = dashboardData.results;
const ft06Schedule = dashboardData.ft06Schedule;

const machineColors = ["#1976c9", "#2f8f43", "#ed8a1c", "#7a34a8", "#218fa3", "#dc3b36"];
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("pt-BR");
const percent = value => `${number.format(value * 100)}%`;
const problemFilter = document.querySelector("#problemFilter");
const statusFilter = document.querySelector("#statusFilter");
const tablesContainer = document.querySelector("#tablesContainer");

function filteredResults() {
  return results.filter(row =>
    (problemFilter.value === "all" || row.problem === problemFilter.value) &&
    (statusFilter.value === "all" || row.status === statusFilter.value)
  );
}

function statusMarkup(status) {
  const optimal = status === "OPTIMAL";
  return `<span class="status-pill ${optimal ? "optimal" : "limit"}">${optimal ? "ÓTIMO" : "LIMITE"}</span>`;
}

function rowMarkup(row) {
  if (row.problem === "machine") return `<tr>
    <td>${row.instance.replace(/^inst_/, "")}</td><td>${row.dimension.replace(" jobs", "")}</td>
    <td>${row.nbin}</td><td>${integer.format(row.objective)}</td><td>${number.format(row.time)} s</td>
    <td>${percent(row.gap)}</td><td>${statusMarkup(row.status)}</td></tr>`;
  if (row.problem === "jobshop") return `<tr>
    <td>${row.instance.toUpperCase()}</td><td>${row.dimension}</td><td>${row.nbin}</td>
    <td>${integer.format(row.objective)}</td><td>${integer.format(row.optimum)}</td>
    <td>${percent(row.deviation)}</td><td>${statusMarkup(row.status)}</td></tr>`;
  return `<tr><td>${row.instance}</td><td>${row.dimension}</td><td>${row.nbin}</td>
    <td>${integer.format(row.neh)}</td><td>${integer.format(row.objective)}</td>
    <td>${percent(row.improvement)}</td><td>${statusMarkup(row.status)}</td></tr>`;
}

function renderTables(rows) {
  tablesContainer.innerHTML = Object.entries(problemMeta).map(([key, meta]) => {
    const selected = rows.filter(row => row.problem === key);
    const hidden = problemFilter.value !== "all" && problemFilter.value !== key;
    const body = selected.length
      ? `<div class="table-scroll"><table><thead><tr>${meta.columns.map(c => `<th>${c}</th>`).join("")}</tr></thead>
         <tbody>${selected.map(rowMarkup).join("")}</tbody></table></div>`
      : `<div class="empty-state">Nenhuma instância neste filtro</div>`;
    return `<article class="data-panel" ${hidden ? "hidden" : ""}>
      <div class="data-panel-header ${key}"><h3>${meta.label}</h3>
      <span>${selected.length} ${selected.length === 1 ? "instância" : "instâncias"}</span></div>${body}</article>`;
  }).join("");
}

function groupMetrics(rows) {
  return Object.keys(problemMeta).map(key => {
    const group = rows.filter(row => row.problem === key);
    const average = field => group.length
      ? group.reduce((sum, row) => sum + row[field], 0) / group.length
      : 0;
    return { key, count: group.length, time: average("time"), gap: average("gap") };
  }).filter(group => group.count);
}

function renderBarChart(targetId, items, field, formatter) {
  const target = document.querySelector(targetId);
  const max = Math.max(...items.map(item => item[field]), .01);
  target.innerHTML = items.map(item => {
    const meta = problemMeta[item.key];
    const height = Math.max(3, item[field] / max * 100);
    return `<div class="bar-item">
      <div class="bar-column" style="height:${height}%;--bar-color:${meta.color}"
        title="${meta.label}: ${formatter(item[field])}">
        <span class="bar-value">${formatter(item[field])}</span>
      </div>
      <span class="bar-label">${meta.short}</span>
    </div>`;
  }).join("");
}

function updateKpis(rows) {
  const optimal = rows.filter(row => row.status === "OPTIMAL").length;
  const gap = rows.length ? rows.reduce((sum, row) => sum + row.gap, 0) / rows.length : 0;
  const time = rows.reduce((sum, row) => sum + row.time, 0);
  const problems = new Set(rows.map(row => row.problem)).size;
  document.querySelector("#kpiInstances").textContent = integer.format(rows.length);
  document.querySelector("#kpiProblems").textContent = `${problems} ${problems === 1 ? "problema" : "problemas"}`;
  document.querySelector("#kpiOptimal").textContent = integer.format(optimal);
  document.querySelector("#kpiOptimalRate").textContent = rows.length
    ? `${percent(optimal / rows.length)} dos casos`
    : "sem instâncias";
  document.querySelector("#kpiGap").textContent = percent(gap);
  document.querySelector("#kpiBinaries").textContent = integer.format(rows.reduce((sum, row) => sum + row.nbin, 0));
  document.querySelector("#kpiTime").textContent = `${number.format(time)} s`;
}

function renderStatus(rows) {
  const optimal = rows.filter(row => row.status === "OPTIMAL").length;
  const limited = rows.length - optimal;
  const split = rows.length ? optimal / rows.length * 100 : 0;
  document.querySelector("#statusDonut").style.background = rows.length
    ? `conic-gradient(var(--green) 0 ${split}%, var(--red) ${split}% 100%)`
    : "#dce2ea";
  document.querySelector("#donutTotal").textContent = rows.length;
  document.querySelector("#statusPanelTotal").textContent = `${rows.length} execuções`;
  document.querySelector("#statusLegend").innerHTML = `
    <div class="legend-item"><span class="legend-dot" style="--dot-color:var(--green)"></span>
      <div><strong>${optimal} ótimas</strong>${rows.length ? percent(optimal / rows.length) : "0%"} do filtro</div></div>
    <div class="legend-item"><span class="legend-dot" style="--dot-color:var(--red)"></span>
      <div><strong>${limited} no limite</strong>${rows.length ? percent(limited / rows.length) : "0%"} do filtro</div></div>`;
}

function renderDashboard() {
  const rows = filteredResults();
  const metrics = groupMetrics(rows);
  updateKpis(rows);
  renderTables(rows);
  renderBarChart("#timeChart", metrics, "time", value => `${number.format(value)} s`);
  renderBarChart("#gapChart", metrics, "gap", percent);
  renderStatus(rows);
  document.querySelector("#filterSummary").textContent =
    `${rows.length} de ${results.length} instâncias exibidas`;
}

function renderGantt() {
  const ganttMakespan = Math.max(...ft06Schedule.map(op => op.start + op.duration), 1);
  document.querySelector("#ganttMakespan").textContent = `Makespan = ${integer.format(ganttMakespan)}`;
  document.querySelector("#machineLegend").innerHTML = machineColors.map((color, index) =>
    `<span><i style="--machine-color:${color}"></i> Máquina ${index + 1}</span>`
  ).join("");

  const ganttRows = Array.from({ length: 6 }, (_, index) => index + 1).map(job => {
    const bars = ft06Schedule.filter(op => op.job === job).map(op => {
      const left = op.start / ganttMakespan * 100;
      const width = op.duration / ganttMakespan * 100;
      return `<span class="gantt-bar"
        style="left:${left}%;width:${width}%;--machine-color:${machineColors[op.machine - 1]}"
        title="Job ${op.job}, operação ${op.operation} · Máquina ${op.machine} · ${op.start}–${op.start + op.duration}">
        M${op.machine}</span>`;
    }).join("");
    return `<div class="gantt-row"><span class="gantt-label">Job ${job}</span>
      <div class="gantt-track">${bars}</div></div>`;
  }).join("");
  const tickStep = Math.max(1, Math.ceil(ganttMakespan / 11 / 5) * 5);
  const ticks = Array.from(
    { length: Math.floor(ganttMakespan / tickStep) + 1 },
    (_, index) => index * tickStep
  ).map(value =>
    `<span class="axis-tick" style="left:${value / ganttMakespan * 100}%">${value}</span>`
  ).join("");
  document.querySelector("#ganttChart").innerHTML =
    `${ganttRows}<div class="gantt-axis"><span></span><div class="axis-track">${ticks}</div></div>`;
}

function renderRunMetadata() {
  const generated = new Date(dashboardData.generatedAt);
  const generatedLabel = Number.isNaN(generated.getTime())
    ? dashboardData.generatedAt
    : generated.toLocaleString("pt-BR");
  document.querySelector("#runDate").textContent = generatedLabel;
  document.querySelector("#executionMeta").textContent =
    `${dashboardData.juliaThreads} threads Julia · ${dashboardData.parallelWorkers} workers · ${dashboardData.solverThreads} thread/solver`;
  document.querySelector("#timeLimitHint").textContent =
    `limite de ${number.format(dashboardData.timeLimit)} s por modelo`;
  document.querySelector("#sidebarMeta").innerHTML =
    `Julia + JuMP<br>${dashboardData.parallelWorkers} workers`;
  document.querySelector("#footerMeta").textContent =
    `${dashboardData.juliaThreads} threads Julia · ${dashboardData.parallelWorkers} modelos em paralelo`;
}

function renderInsights() {
  const machine = results.filter(row => row.problem === "machine");
  const jobshop = results.filter(row => row.problem === "jobshop");
  const flowshop = results.filter(row => row.problem === "flowshop");
  const machineOptimal = machine.filter(row => row.status === "OPTIMAL").length;
  const ft06 = jobshop.find(row => row.instance === "ft06");
  const bestFlow = flowshop.reduce(
    (best, row) => row.improvement > best.improvement ? row : best,
    { improvement: 0, instance: "-" }
  );
  const items = [
    `Machine Scheduling comprovou ótimo em ${machineOptimal} de ${machine.length} instâncias.`,
    `FT06 atingiu ${integer.format(ft06.objective)}, frente ao ótimo conhecido de ${integer.format(ft06.optimum)}.`,
    `No Flow Shop, a maior melhoria sobre NEH foi ${percent(bestFlow.improvement)} em ${bestFlow.instance}.`,
    `A execução usou ${dashboardData.parallelWorkers} workers com ${dashboardData.solverThreads} thread por solver.`
  ];
  document.querySelector("#insightList").innerHTML = items.map((text, index) =>
    `<li><span>${String(index + 1).padStart(2, "0")}</span><p>${text}</p></li>`
  ).join("");
}

function exportCsv() {
  const rows = filteredResults();
  const headers = ["problem", "instance", "dimension", "nbin", "objective", "time_s", "gap", "status"];
  const lines = [headers.join(","), ...rows.map(row => headers.map(field => row[field] ?? "").join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "scheduling_dashboard_filtrado.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function setActiveNavigation(action) {
  document.querySelectorAll(".nav-item").forEach(item =>
    item.classList.toggle("active", item.dataset.action === action)
  );
}

function handleNavigation(action) {
  if (["machine", "jobshop", "flowshop"].includes(action)) {
    problemFilter.value = action;
    statusFilter.value = "all";
    renderDashboard();
    document.querySelector("#instancesSection").scrollIntoView({ behavior: "smooth" });
  } else if (action === "overview") {
    problemFilter.value = "all";
    statusFilter.value = "all";
    renderDashboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    const targets = { gantt: "#ganttSection", analysis: "#analysisSection", conclusions: "#conclusionsSection" };
    document.querySelector(targets[action]).scrollIntoView({ behavior: "smooth", block: "start" });
  }
  setActiveNavigation(action);
  document.body.classList.remove("menu-open");
  document.querySelector("#menuButton").setAttribute("aria-expanded", "false");
}

problemFilter.addEventListener("change", () => {
  renderDashboard();
  setActiveNavigation(problemFilter.value === "all" ? "overview" : problemFilter.value);
});
statusFilter.addEventListener("change", renderDashboard);
document.querySelector("#exportButton").addEventListener("click", exportCsv);
document.querySelectorAll(".nav-item").forEach(button =>
  button.addEventListener("click", () => handleNavigation(button.dataset.action))
);
document.querySelector("#menuButton").addEventListener("click", event => {
  const open = document.body.classList.toggle("menu-open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});

renderRunMetadata();
renderInsights();
renderGantt();
renderDashboard();
