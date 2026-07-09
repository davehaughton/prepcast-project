const CENTRE_ID = document.body.dataset.centreId;

let rows = [];         
let week = null;
let closed = false;     

let histWeeks = [];    

const fmt = n => Number(n).toLocaleString('en-US');
const $ = id => document.getElementById(id);

const CHART_ICON = '<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';

// load  committed plan 
async function load() {
    const res = await fetch(`/api/actuals?centre_id=${CENTRE_ID}`);
    const data = await res.json();
    week = data.week;
    histWeeks = data.hist_weeks || [];
    rows = data.items.map(r => ({ ...r, actual: r.actual_sales }));
    closed = data.state === 'closed';

    $('topWeek').textContent = `WEEK ${week}`;
    $('save-actuals').textContent = `Save Actuals & Close Week ${week}`;

    if (data.state === 'no_plan') {
        showBanner('No committed plan for this week',
            `Commit a plan on the Forecast page first, before you can record week ${week}'s actual sales.`);
        $('kpi-row').classList.add('hidden');
        $('table-section').classList.add('hidden');
        return;
    }
    if (closed) {
        showBanner(`Week ${week} is already closed`,
            'These actual sales have been saved and the week has rolled forward. Values are read-only.');
    }
    render();
    recompute();
}

function showBanner(title, msg) {
    $('state-banner').classList.remove('hidden');
    $('state-banner').classList.add('flex');
    $('state-title').textContent = title;
    $('state-msg').textContent = msg;
}

// render the table rows 
function render() {
    const rowHtml = (r, i) => {
        const fc   = Math.round(r.predicted_demand);
        const buf  = Math.round(r.safety_stock);
        const plan = Math.round(r.planned_prep);
        const val  = r.actual == null ? '' : Math.round(r.actual);
        return `
        <div class="group flex items-center justify-between px-6 py-4 ${i % 2 ? 'bg-canvas' : 'bg-surface'} border-l-2 border-transparent transition-colors hover:bg-accent/6 hover:border-accent">
          <div class="flex items-center gap-2 w-[200px]">
            <span class="font-semibold text-[14px] text-slate900">${r.category}</span>
            <span class="font-mono text-[11px] text-slate600">#${r.meal_id}</span>
          </div>
          <span class="w-[120px] text-[13px] text-slate500">${r.cuisine}</span>
          <span class="w-[110px] text-right font-mono text-[14px] text-slate900">${fmt(fc)}</span>
          <span class="w-[110px] text-right font-mono text-[13px] text-slate500">${fmt(buf)}</span>
          <span class="w-[110px] text-right font-mono text-[14px] text-slate900">${fmt(plan)}</span>
          <div class="w-[130px] flex justify-end">
            <div class="flex items-center gap-0.5 rounded-md border border-line bg-panel px-1 py-0.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 ${closed ? 'opacity-60' : ''}">
              <button type="button" data-step="-1" data-row="${i}" class="actual-step flex items-center justify-center size-5 rounded-sm text-slate500 hover:bg-surface hover:text-slate900 ${closed ? 'pointer-events-none' : ''}" aria-label="Decrease">−</button>
              <input type="number" min="0" inputmode="numeric" data-row="${i}" value="${val}" placeholder="${fmt(plan)}"
                class="actual-input w-[52px] text-center font-mono text-[14px] bg-transparent text-slate900 outline-hidden
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" ${closed ? 'disabled' : ''} />
              <button type="button" data-step="1" data-row="${i}" class="actual-step flex items-center justify-center size-5 rounded-sm text-slate500 hover:bg-surface hover:text-slate900 ${closed ? 'pointer-events-none' : ''}" aria-label="Increase">+</button>
            </div>
          </div>
          <div class="w-[120px] flex justify-end"><span class="variance-cell" data-var="${i}"></span></div>
          <div class="w-10 flex justify-center">
            <button data-chart="${i}" class="chart-btn p-1 rounded-sm text-slate400 transition-colors hover:text-accent hover:bg-accent/10 group-hover:text-accent focus:outline-hidden focus:ring-2 focus:ring-accent/40" aria-label="View chart for ${r.category} #${r.meal_id}">${CHART_ICON}</button>
          </div>
        </div>`;
    };
    $('actual-rows').innerHTML = rows.map(rowHtml).join('');
    rows.forEach((_, i) => renderVariance(i));

    if (closed) $('save-actuals').disabled = true;
}


function renderVariance(i) {
    const cell = document.querySelector(`.variance-cell[data-var="${i}"]`);
    if (!cell) return;
    const r = rows[i];
    if (r.actual == null) { cell.innerHTML = '<span class="text-slate400 text-[13px]">—</span>'; return; }
    const diff = Math.round(r.actual) - Math.round(r.planned_prep);
    if (diff === 0) {
        cell.innerHTML = `<span class="font-mono text-[13px] text-accent">✓ exact</span>`;
        return;
    }
    const over = diff > 0;   // actual above plan = under-prepped (shortfall)
    const tone = over ? 'text-danger' : 'text-amber-500';
    const arrow = over ? '▲' : '▼';
    cell.innerHTML = `<span class="font-mono font-bold text-[13px] ${tone}">${arrow} ${fmt(Math.abs(diff))}</span>`;
}

// recompute kpi's
function recompute() {
    const done = rows.filter(r => r.actual != null);
    $('record-count').textContent =
        `${rows.length} meals · ${done.length} entered${closed ? ' · closed' : ''}`;

    if (!done.length) {
        $('kpiAccuracy').textContent = '—';
        $('kpiBuffer').textContent = '—';
        $('kpiBufferFill').style.width = '0%';
        $('kpiService').textContent = '—';
        $('kpiWaste').textContent = '—';
        $('kpiShort').textContent = '—';
        return;
    }

   
    // Forecast accuracy = 100 - WMAPE (volume-weighted, so low-volume meals don't dominate)
    let absErr = 0, totActual = 0;
    done.forEach(r => {
        absErr    += Math.abs(Math.round(r.actual) - Math.round(r.predicted_demand));
        totActual += Math.round(r.actual);
    });
    const acc = totActual ? Math.max(0, 100 - (absErr / totActual) * 100) : 0;
    $('kpiAccuracy').textContent = acc.toFixed(1) + '%';

    // Buffer used 
    let bufUsed = 0, bufTotal = 0;
    done.forEach(r => {
        const over = Math.round(r.actual) - Math.round(r.predicted_demand);
        bufUsed += Math.min(Math.max(over, 0), Math.round(r.safety_stock));
        bufTotal += Math.round(r.safety_stock);
    });
    const bufPct = bufTotal ? Math.round((bufUsed / bufTotal) * 100) : 0;
    $('kpiBuffer').textContent = bufPct + '%';
    $('kpiBufferFill').style.width = Math.min(bufPct, 100) + '%';

    // Service level achieved 
    const hit = done.filter(r => Math.round(r.planned_prep) >= Math.round(r.actual)).length;
    $('kpiService').textContent = Math.round((hit / done.length) * 100) + '%';

    // Waste vs shortfall 
    let waste = 0, shortfall = 0;
    done.forEach(r => {
        const d = Math.round(r.planned_prep) - Math.round(r.actual);
        if (d > 0) waste += d; else shortfall += -d;
    });
    $('kpiWaste').textContent = fmt(waste);
    $('kpiShort').textContent = fmt(shortfall);
}

// entering actuals 
$('actual-rows').addEventListener('input', e => {
    const input = e.target.closest('.actual-input');
    if (!input) return;
    const i = parseInt(input.dataset.row, 10);
    const v = input.value === '' ? null : Math.max(0, parseInt(input.value, 10) || 0);
    rows[i].actual = v;
    renderVariance(i);
    recompute();
});


$('actual-rows').addEventListener('click', e => {
    const chartBtn = e.target.closest('.chart-btn');
    if (chartBtn) { openChart(parseInt(chartBtn.dataset.chart, 10)); return; }
    const step = e.target.closest('.actual-step');
    if (!step || closed) return;
    const i = parseInt(step.dataset.row, 10);
    const input = document.querySelector(`.actual-input[data-row="${i}"]`);
    const cur = input.value === '' ? 0 : (parseInt(input.value, 10) || 0);
    const next = Math.max(0, cur + parseInt(step.dataset.step, 10));
    input.value = next;
    rows[i].actual = next;
    renderVariance(i);
    recompute();
});

// simulate actuals
function gaussian(mean, sd) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + sd * n;
}


const SIM_NOISE = 0.3;

$('prefillBtn').addEventListener('click', () => {
    if (closed) return;
    rows.forEach(r => {
        const fc = Math.round(r.predicted_demand);
        const sd = SIM_NOISE * Math.max(Math.round(r.safety_stock) / 1.645, fc * 0.08);
        r.actual = Math.max(0, Math.round(gaussian(fc, sd)));
    });
    render();
    recompute();
});

// save actuals and close  week 
$('save-actuals').addEventListener('click', async () => {
    if (closed) { window.location.href = '/'; return; }
    const entered = rows.filter(r => r.actual != null);
    if (entered.length !== rows.length) {
        alert(`Enter an actual sales value for all ${rows.length} meals before closing the week (${entered.length} done).`);
        return;
    }
    const btn = $('save-actuals');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const items = rows.map(r => ({ meal_id: r.meal_id, actual_sales: Math.round(r.actual) }));
    const res = await fetch('/api/actuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ centre_id: Number(CENTRE_ID), week, items }),
    });
    const result = await res.json();

    if (result.status !== 'ok') {
        alert('Could not save: ' + (result.message || 'unknown error'));
        btn.disabled = false;
        btn.textContent = `Save Actuals & Close Week ${week}`;
        return;
    }

    // week is now closed — freeze the table, keep KPIs on screen
    closed = true;
    document.querySelectorAll('.actual-input').forEach(el => (el.disabled = true));
    showBanner(`Week ${week} closed`,
        `Actual sales saved. The forecast has rolled forward to week ${result.next_week}.`);
    recompute();
    btn.disabled = false;
    btn.textContent = 'Go to Forecast →';
});


(() => {
    const root = document.documentElement;
    const btn  = $('themeToggle');
    const sun  = btn.querySelector('.theme-sun');
    const moon = btn.querySelector('.theme-moon');
    const sync = () => {
        const dark = root.classList.contains('dark');
        sun.classList.toggle('hidden', !dark);
        moon.classList.toggle('hidden', dark);
    };
    sync();
    btn.addEventListener('click', () => {
        root.classList.toggle('dark');
        localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
        sync();
        if (rowChart && !chartModal.classList.contains('hidden')) rowChart.__rerender();
    });
})();


const sidebar = $('sidebar');
const backdrop = $('backdrop');
$('openSidebar').addEventListener('click', () => {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
});
const closeSidebar = () => {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
};
$('closeSidebar').addEventListener('click', closeSidebar);
backdrop.addEventListener('click', closeSidebar);


// ---- charts: plan vs actual ----
let rowChart = null;

const crosshair = {
    id: 'crosshair',
    afterDraw(chart) {
        const active = chart.getActiveElements();
        if (!active.length) return;
        const x = active[0].element.x;
        const { top, bottom } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, top); ctx.lineTo(x, bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = document.documentElement.classList.contains('dark') ? 'rgba(241,245,249,0.18)' : 'rgba(15,23,42,0.15)';
        ctx.stroke(); ctx.restore();
    },
};

const chip = (label, val, accent) => `
    <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-panel border border-line">
      <span class="text-[10px] uppercase font-semibold text-slate500">${label}</span>
      <span class="font-mono font-bold text-[12px] ${accent ? 'text-accent' : 'text-slate900'}">${typeof val === 'number' ? val.toLocaleString() : val}</span>
    </span>`;

const chartTheme = () => {
    const dark = document.documentElement.classList.contains('dark');
    return {
        accent: dark ? '#00d4aa' : '#00c896',
        fill:   dark ? 'rgba(0,212,170,0.10)' : 'rgba(0,200,150,0.08)',
        fcDot:  '#0a0d14',
        actual:       dark ? '#ffffff' : '#0a0d14',
        actualBorder: dark ? '#0a0d14' : '#ffffff',
        rec:    dark ? '#475569' : '#94a3b8',
        grid:   dark ? 'rgba(148,163,184,0.14)' : '#f1f5f9',
        tick:   '#94a3b8',
        legend: dark ? '#94a3b8' : '#475569',
        tooltip:'#0a0d14',
    };
};

const chartModal = $('chartModal');
const chartCard  = $('chartCard');
const chartBd    = $('chartBackdrop');

// one meal
function openChart(i) {
    const r = rows[i];
    openChartModal({
        title: `${r.category} #${r.meal_id}`,
        sub:   `${r.cuisine} · forecast vs actual`,
        stats: chip('Forecast', Math.round(r.predicted_demand), true)
             + chip('Planned', Math.round(r.planned_prep))
             + chip('Actual', r.actual == null ? '—' : Math.round(r.actual)),
        hist:  (r.history || []).map(v => v == null ? null : v),
        fc:    Math.round(r.predicted_demand),
        plan:  Math.round(r.planned_prep),
        actual: r.actual == null ? null : Math.round(r.actual),
        rerender: () => openChart(i),
    });
}

// all meals -> summed weekly series
function openOverallChart() {
    const n = histWeeks.length;
    const hist = new Array(n).fill(0);
    let fc = 0, plan = 0, actual = 0, anyActual = false;
    rows.forEach(r => {
        (r.history || []).forEach((v, i) => { hist[i] += (v || 0); });
        fc   += Math.round(r.predicted_demand);
        plan += Math.round(r.planned_prep);
        if (r.actual != null) { actual += Math.round(r.actual); anyActual = true; }
    });
    openChartModal({
        title: 'Forecast vs Actual',
        sub:   `All ${rows.length} meals · total weekly demand`,
        stats: chip('Forecast', fc, true) + chip('Planned', plan)
             + chip('Actual', anyActual ? actual : '—') + chip('Meals', rows.length),
        hist, fc, plan, actual: anyActual ? actual : null,
        rerender: openOverallChart,
    });
}

function openChartModal(d) {
    const C = chartTheme();
    $('chartTitle').textContent = d.title;
    $('chartSub').textContent = d.sub;
    $('chartStats').innerHTML = d.stats;

    const labels = histWeeks.map(w => 'W' + w).concat('W' + week);
    const FC = d.hist.length;                        
    const demandLine  = [...d.hist, d.fc];
    const actualCurve = d.actual == null ? labels.map(() => null) : [...d.hist, d.actual];

    chartModal.classList.remove('hidden');
    chartModal.classList.add('flex');
    requestAnimationFrame(() => {
        chartBd.classList.remove('opacity-0');
        chartCard.classList.remove('opacity-0', 'scale-95');
    });

    if (rowChart) rowChart.destroy();
    rowChart = new Chart($('rowChart'), {
        type: 'line',
        plugins: [crosshair],
        data: {
            labels,
            datasets: [
                { label: 'Demand', data: demandLine, borderColor: C.accent, backgroundColor: C.fill,
                  fill: true, tension: 0.35, borderWidth: 2, spanGaps: true,
                  pointRadius: ctx => ctx.dataIndex === FC ? 5 : 3,
                  pointStyle: ctx => ctx.dataIndex === FC ? 'rectRot' : 'circle',
                  pointBackgroundColor: ctx => ctx.dataIndex === FC ? C.fcDot : C.accent,
                  pointBorderColor: C.accent,
                  segment: { borderDash: ctx => ctx.p1DataIndex === FC ? [5, 4] : undefined } },
                { label: 'Actual', data: actualCurve, borderColor: 'transparent', backgroundColor: 'transparent',
                  tension: 0.35, borderWidth: 2, spanGaps: true,
                  segment: {
                    borderColor: ctx => ctx.p1DataIndex === FC ? C.actual : 'transparent',
                    borderDash: ctx => ctx.p1DataIndex === FC ? [5, 4] : undefined },
                  pointRadius: ctx => ctx.dataIndex === FC ? 6 : 0,
                  pointStyle: 'circle',
                  pointBackgroundColor: C.actual, pointBorderColor: C.actualBorder, pointBorderWidth: 2 },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top', onClick: () => {},
                    labels: {
                        usePointStyle: true, boxWidth: 8, padding: 16, color: C.legend, font: { family: 'Geist', size: 12 },
                        generateLabels: () => [
                            { text: 'Demand',   fillStyle: C.accent, strokeStyle: C.accent, pointStyle: 'circle',  lineWidth: 0 },
                            { text: 'Forecast', fillStyle: C.fcDot,  strokeStyle: C.accent, pointStyle: 'rectRot', lineWidth: 1 },
                            { text: 'Actual Sales', fillStyle: C.actual, strokeStyle: C.actual, pointStyle: 'circle',  lineWidth: 0 },
                        ],
                    },
                },
                tooltip: {
                    backgroundColor: C.tooltip, padding: 10, cornerRadius: 8,
                    titleFont: { family: 'Geist' }, bodyFont: { family: 'IBM Plex Mono' },
                    filter: item => item.datasetIndex === 1 ? item.dataIndex === FC : true,
                    callbacks: {
                        title: items => items[0].label,
                        label: item => {
                            if (item.datasetIndex === 1) return `Actual Sales: ${item.formattedValue}`;
                            return `${item.dataIndex === FC ? 'Forecast' : 'Demand'}: ${item.formattedValue}`;
                        },
                    },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: C.tick, font: { family: 'IBM Plex Mono', size: 11 } } },
                y: { grid: { color: C.grid }, ticks: { color: C.tick, font: { family: 'IBM Plex Mono', size: 11 } } },
            },
        },
    });
    rowChart.__rerender = d.rerender;
}

function closeChart() {
    chartBd.classList.add('opacity-0');
    chartCard.classList.add('opacity-0', 'scale-95');
    setTimeout(() => { chartModal.classList.add('hidden'); chartModal.classList.remove('flex'); }, 200);
}

$('chartClose').addEventListener('click', closeChart);
$('overallChart').addEventListener('click', openOverallChart);
chartBd.addEventListener('click', closeChart);
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !chartModal.classList.contains('hidden')) closeChart();
});

load();
