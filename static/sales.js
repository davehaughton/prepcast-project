const CENTRE_ID = document.body.dataset.centreId;

let rows = [];         
let week = null;
let closed = false;     

const fmt = n => Number(n).toLocaleString('en-US');
const $ = id => document.getElementById(id);

// load  committed plan 
async function load() {
    const res = await fetch(`/api/actuals?centre_id=${CENTRE_ID}`);
    const data = await res.json();
    week = data.week;
    rows = data.items.map(r => ({ ...r, actual: r.actual_sales }));  
    closed = data.state === 'closed';

    $('topWeek').textContent = `WEEK ${week}`;
    $('save-actuals').textContent = `Save Actuals & Close Week ${week}`;

    if (data.state === 'no_plan') {
        showBanner('No committed plan for this week',
            `Commit a plan on the Forecast page first, then come back here to record week ${week}'s actual sales.`);
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

   
    let mapeSum = 0, mapeN = 0;
    done.forEach(r => {
        const a = Math.round(r.actual);
        if (a > 0) { mapeSum += Math.abs(a - Math.round(r.predicted_demand)) / a; mapeN++; }
    });
    const acc = mapeN ? Math.max(0, 100 - (mapeSum / mapeN) * 100) : 0;
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

$('prefillBtn').addEventListener('click', () => {
    if (closed) return;
    rows.forEach(r => {
        const fc = Math.round(r.predicted_demand);
        const sd = Math.max(Math.round(r.safety_stock) / 1.645, fc * 0.08);
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

load();
