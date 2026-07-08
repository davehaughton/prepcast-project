const CENTRE_ID = document.body.dataset.centreId;   // reads data-centre-id

            let currentRows = [];
            // populate Centres dropdown
            // async function loadCentres() {
            //     const res = await fetch("/api/centres");
            //     const centres = await res.json();
            //     document.getElementById("centre-picker").innerHTML = centres
            //     .map(c => `<option value="${c.centre_id}">Centre ${c.centre_id}</option>`)
            //     .join("");
            // }
            // load forecast per Centre
            async function loadForecast() {
                //console.log(centre_id);
                
                // const res = await fetch(`/api/forecast?centre_id=${centre_id}`);
                const centre_id = CENTRE_ID;         
                // const centre_id = document.getElementById("centre-picker").value;
                //const promo = document.getElementById("promo").checked ? 1 : 0;
                //const discount = document.getElementById("discount").value;
                const promo = document.getElementById("promoToggle").getAttribute("aria-checked") === "true" ? 1 : 0;
                const discount = document.getElementById("discountRange").value / 100; 

                //const service = document.getElementById("service").value;
                const service = Math.min(committed, 99) / 100;

                showLoading();   // dim current figures + float a spinner over them

                const res = await fetch(`/api/forecast?centre_id=${centre_id}&promo=${promo}&discount=${discount}&service_level=${service}`);

                currentRows = await res.json();
                renderForecast();
                hideLoading();

            }

            // loading overlay: keep the current table visible but dimmed, spinner on top (no layout shift)
            function showLoading() {
                const rows = document.getElementById("forecast-rows");
                rows.style.transition = "opacity 0.15s";
                rows.style.opacity = "0.35";
                rows.style.pointerEvents = "none";
                let ov = document.getElementById("forecast-loading");
                if (!ov) {
                    rows.parentElement.style.position = "relative";
                    ov = document.createElement("div");
                    ov.id = "forecast-loading";
                    ov.className = "absolute inset-0 flex items-start justify-center pt-24 pointer-events-none";
                    ov.innerHTML = `
                        <span class="flex items-center gap-3 px-4 py-2 rounded-lg bg-surface/90 border border-line shadow-sm">
                            <span class="size-5 rounded-full border-2 border-line border-t-accent animate-spin"></span>
                            <span class="font-mono text-[13px] text-slate500">Calculating…</span>
                        </span>`;
                    rows.parentElement.appendChild(ov);
                }
                ov.style.display = "flex";
            }

            function hideLoading() {
                const rows = document.getElementById("forecast-rows");
                rows.style.opacity = "";
                rows.style.pointerEvents = "";
                const ov = document.getElementById("forecast-loading");
                if (ov) ov.style.display = "none";
            }
            function renderForecast() {
                const rowHtml = (r, i) => {
                    const safety = r.safety_stock;
                    const rec    = r.recommended_prep;
                    const fc     = r.predicted_demand;
                    const lweek  = r.last_week_orders;
                    const up     = fc >= lweek;
                    const delta  = lweek ? Math.round(((fc - lweek) / lweek) * 100) : 0;  
                    const lo     = Math.round(fc);             
                    const hi     = Math.round(fc + safety);
                    const visIcon = '<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';


                    return `
                    <div class="group flex items-center justify-between px-6 py-4 ${i % 2 ? 'bg-canvas' : 'bg-surface'} border-l-2 border-transparent transition-colors hover:bg-accent/6 hover:border-accent">
                    <button data-chart="${i}" class="flex items-center gap-2 w-[200px] text-left cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-accent/40 rounded-sm" aria-label="View chart for ${r.category} #${r.meal_id}">
                        <span class="font-semibold text-[14px] text-slate900 group-hover:text-accent transition-colors">${r.category}</span>
                        <span class="font-mono text-[11px] text-slate600">#${r.meal_id}</span>
                    </button>
                    <span class="w-[120px] text-[13px] text-slate500">${r.cuisine}</span>
                    <span class="w-[100px] text-right font-mono text-[14px] text-slate900">${lweek}</span>
                    <div class="w-[140px] flex flex-col items-end gap-0.5">
                        <span class="font-mono font-bold text-[15px] text-slate900">${fc}</span>
                        <div class="flex items-center gap-1">
                        <span class="font-mono text-[11px] text-slate600">${lo}–${hi}</span>
                        <span class="font-mono font-bold text-[11px] ${up ? 'text-accent' : 'text-danger'}">${up ? '▲' : '▼'} ${delta}%</span>
                        </div>
                    </div>
                    <span class="w-[130px] text-right font-mono text-[13px] text-slate500">${safety}</span>
                    <div class="w-[160px] flex justify-end">
                        <span class="font-mono font-bold text-[15px] text-accent">${rec}</span>
                    </div>
                    <div class="plan-cell relative flex items-center justify-end w-[100px]" data-row="${i}"></div>
                    <div class="w-10 flex justify-center">
                <button data-chart="${i}" class="vis-btn p-1 rounded-sm text-slate400 transition-colors hover:text-accent hover:bg-accent/10 group-hover:text-accent focus:outline-hidden focus:ring-2 focus:ring-accent/40" aria-label="View chart for ${r.category} #${r.meal_id}">${visIcon}</button>
                </div>
                    </div>`;
                };

                document.getElementById("forecast-rows").innerHTML = currentRows.map(rowHtml).join("");

                document.querySelectorAll('#forecast-rows [data-chart]').forEach(b =>
                    b.addEventListener('click', () => openChart(parseInt(b.dataset.chart, 10)))
                );

                renderPlanCells();

                const totalPrep = currentRows.reduce((sum, r) => sum + r.recommended_prep, 0);

                document.getElementById("portionsTotal").textContent = Math.round(totalPrep).toLocaleString("en-US");

                const totalLastWeek = currentRows.reduce((sum, r) => sum + r.last_week_orders, 0);
                const totalForecast = currentRows.reduce((sum, r) => sum + r.predicted_demand, 0);
                const delta = totalLastWeek ? Math.round(((totalForecast - totalLastWeek) / totalLastWeek) * 100) : 0;
                document.getElementById("growthIndex").textContent = `${delta >= 0 ? "+" : ""}${delta}%`;

                const up = delta >= 0;
                document.getElementById("growthIndex").textContent = `${up ? "+" : ""}${delta}%`;

                const arrow = document.getElementById("growthArrow");
                arrow.classList.toggle("rotate-180", !up);   
                arrow.classList.toggle("text-accent", up);  
                arrow.classList.toggle("text-danger", !up);  

                const num = document.getElementById("growthIndex");
                num.classList.toggle("text-accent", up);
                num.classList.toggle("text-danger", !up);

                document.getElementById("record-count").textContent = `${currentRows.length.toLocaleString("en-US")} meal records`;



            }

            // function renderForecast() {
                
            //     const rowHtml = r => {
            //        const safety = r.safety_stock;
            //         const rec    = r.predicted_demand + safety;
            //         const plan = r.planned_prep ?? rec;
            //         return `<tr class="border-t border-slate-100 hover:bg-slate-50">
            //         <td class="px-4 py-2">${r.category}</td>
            //         <td class="px-4 py-2">${r.cuisine}</td>
            //         <td class="px-4 py-2 text-right">${r.last_week_orders}</td>
            //         <td class="px-4 py-2 text-right">${r.predicted_demand}</td>
            //         <td class="px-4 py-2 text-right">${safety}</td>
            //         <td class="px-4 py-2 text-right">${rec}</td>
            //         <td class="px-4 py-2 text-right"><input type="text" class="border p-2 w-16" data-meal="${r.meal_id}" value="${plan}"></td>
            //         </tr>`;
            //     };

                
            //     document.getElementById("forecast-rows").innerHTML = currentRows.map(rowHtml).join("");
            // }

            // discount.addEventListener("input", () => {
            //     document.getElementById("discount-label").textContent =
            //         Math.round(discount.value * 100) + "%";
            // });
            // service.addEventListener("input", () => {
            //     document.getElementById("service-label").textContent =
            //         Math.round(service.value * 100) + "%";
            // });
            async function savePlan() {
                //console.log('save plan button works');
                if (!currentRows.length) return;
                // const centre_id = Number(document.getElementById("centre-picker").value);
                const centre_id = Number(CENTRE_ID); 
                const week = currentRows[0].week;
                //console.log(centre_id);
                //console.log(week);
                const items = currentRows.map(r => ({
                    meal_id: r.meal_id,
                    predicted_demand: r.predicted_demand,
                    safety_stock: r.safety_stock,
                    recommended_prep: r.recommended_prep,
                    planned_prep: Math.round(r.planned_prep ?? r.recommended_prep)
                }));
                const res = await fetch("/api/plan", {    
                    method: "POST",  
                    headers: { "Content-Type": "application/json" },                           
                    body: JSON.stringify({ centre_id, week, items })    
                });
                const result = await res.json();
               // alert(`Plan saved (${result.saved} rows)`);


            }
            

            async function init() {
                // await loadCentres();
                // const picker = document.getElementById("centre-picker");
               // const promo = document.getElementById("promo");
               // const discount = document.getElementById("discount");
              //  const service = document.getElementById("service");
                // picker.addEventListener("change", () => loadForecast());
               // promo.addEventListener("change", () => loadForecast());
              //  discount.addEventListener("change", () => loadForecast());
              //  service.addEventListener("change", () => loadForecast());
                document.getElementById("save-plan").addEventListener("click", () => savePlan());
                
                

                loadForecast();
            }
       



            // Adjust Service Level modal 
            const modal        = document.getElementById('adjustModal');
            const modalCard    = document.getElementById('modalCard');
            const modalBd      = document.getElementById('modalBackdrop');
            const serviceRange = document.getElementById('serviceRange');
            const modalFill    = document.getElementById('modalFill');
            const modalHandle  = document.getElementById('modalHandle');
            const modalVal     = document.getElementById('modalVal');
            const serviceVal     = document.getElementById('serviceVal');
            const serviceFill    = document.getElementById('serviceFill');
            const serviceCaption = document.getElementById('serviceCaption');

            let committed = 95;                   

            const pos = v => ((v - 50) / 50) * 100;
            const paintSlider = v => { modalFill.style.width = pos(v) + '%'; modalHandle.style.left = pos(v) + '%'; modalVal.textContent = v + '%'; };
            const openModal = () => { serviceRange.value = committed; paintSlider(committed); modal.classList.remove('hidden'); modal.classList.add('flex'); requestAnimationFrame(() => { modalBd.classList.remove('opacity-0'); modalCard.classList.remove('opacity-0', 'scale-95'); }); };
            const closeModal = () => { modalBd.classList.add('opacity-0'); modalCard.classList.add('opacity-0', 'scale-95'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 200); };
            const applyModal = () => {
            committed = parseInt(serviceRange.value, 10);
            serviceVal.textContent = committed + '%';
            serviceFill.style.width = committed + '%';
            serviceCaption.textContent = `Target service level: ${committed}%`;
            closeModal();
            loadForecast();                                 
            };

            serviceRange.addEventListener('input', () => paintSlider(parseInt(serviceRange.value, 10)));
            document.getElementById('adjustBtn').addEventListener('click', openModal);
            document.getElementById('modalClose').addEventListener('click', closeModal);
            document.getElementById('modalCancel').addEventListener('click', closeModal);
            document.getElementById('modalApply').addEventListener('click', applyModal);
            modalBd.addEventListener('click', closeModal);
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

            // Mobile sidebar (slide-in nav)
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('backdrop');
            const openSidebar = () => {
                sidebar.classList.remove('-translate-x-full');
                backdrop.classList.remove('opacity-0', 'pointer-events-none');
            };
            const closeSidebar = () => {
                sidebar.classList.add('-translate-x-full');
                backdrop.classList.add('opacity-0', 'pointer-events-none');
            };
            document.getElementById('openSidebar').addEventListener('click', openSidebar);
            document.getElementById('closeSidebar').addEventListener('click', closeSidebar);
            backdrop.addEventListener('click', closeSidebar);

            // Email promo toggle
            const toggle = document.getElementById('promoToggle');
            const knob = toggle.querySelector('span');
            toggle.addEventListener('click', () => {
            const on = toggle.getAttribute('aria-checked') === 'true';
            toggle.setAttribute('aria-checked', String(!on));
            toggle.classList.toggle('bg-accent', !on);
            toggle.classList.toggle('bg-line', on);
            knob.classList.toggle('translate-x-4', !on);
            knob.classList.toggle('translate-x-0', on);
            loadForecast();                                  
            });

            // Discount slider
            const range = document.getElementById('discountRange');
            const fill = document.getElementById('discountFill');
            const handle = document.getElementById('discountHandle');
            const valLabel = document.getElementById('discountVal');
            range.addEventListener('input', () => {
            const v = +range.value;
            const pct = (v / range.max) * 100;     
            fill.style.width = pct + '%';
            handle.style.left = pct + '%';
            valLabel.textContent = v + '%';       
            });

            range.addEventListener('change', () => loadForecast());   

            // Dark mode toggle 
            (() => {
            const root = document.documentElement;
            const btn  = document.getElementById('themeToggle');
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



            // Charts
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
                rec:    dark ? '#475569' : '#94a3b8',
                grid:   dark ? 'rgba(148,163,184,0.14)' : '#f1f5f9',
                tick:   '#94a3b8',
                legend: dark ? '#94a3b8' : '#475569',
                tooltip:'#0a0d14',
              };
            };

            // x-axis labels 
            const weekLabels = (fcWeek, n) => {
              const out = [];
              for (let i = n; i >= 1; i--) out.push('W' + (fcWeek - i));
              out.push('W' + fcWeek);
              return out;
            };

            // One meal 
            function openChart(i) {
              const r = currentRows[i];
              renderChart({
                title: `${r.category} #${r.meal_id}`,
                sub:   `${r.cuisine} · weekly demand & forecast`,
                stats: chip('Last Week', Math.round(r.last_week_orders)) + chip('Forecast', Math.round(r.predicted_demand), true) + chip('Rec Prep', Math.round(r.recommended_prep)),
                hist:  (r.history || []).map(v => v ?? null),
                fc: Math.round(r.predicted_demand), rec: Math.round(r.recommended_prep), week: r.week,
                rerender: () => openChart(i),
              });
            }

            // All meals → summed weekly series
            function openOverallChart() {
              const n = currentRows.length ? (currentRows[0].history || []).length : 0;
              const hist = new Array(n).fill(0);
              let last = 0, fc = 0, rec = 0;
              currentRows.forEach(r => {
                (r.history || []).forEach((v, i) => { hist[i] += (v || 0); });
                last += Math.round(r.last_week_orders);
                fc   += Math.round(r.predicted_demand);
                rec  += Math.round(r.recommended_prep);
              });
              renderChart({
                title: 'Portions to Prep',
                sub:   `All ${currentRows.length} meals · total weekly demand & forecast`,
                stats: chip('Last Week', last) + chip('Forecast', fc, true) + chip('Rec Prep', rec) + chip('SKUs', currentRows.length),
                hist, fc, rec, week: currentRows[0]?.week,
                rerender: openOverallChart,
              });
            }

            const chartModal = document.getElementById('chartModal');
            const chartCard  = document.getElementById('chartCard');
            const chartBd    = document.getElementById('chartBackdrop');

            function renderChart(d) {
              const C = chartTheme();
              document.getElementById('chartTitle').textContent = d.title;
              document.getElementById('chartSub').textContent = d.sub;
              document.getElementById('chartStats').innerHTML = d.stats;

              const labels  = weekLabels(d.week, d.hist.length);
              const FC = d.hist.length;                 
              const line    = [...d.hist, d.fc];
              const recLine = labels.map(() => d.rec);

              chartModal.classList.remove('hidden');
              chartModal.classList.add('flex');
              requestAnimationFrame(() => {
                chartBd.classList.remove('opacity-0');
                chartCard.classList.remove('opacity-0', 'scale-95');
              });

              if (rowChart) rowChart.destroy();
              rowChart = new Chart(document.getElementById('rowChart'), {
                type: 'line',
                plugins: [crosshair],
                data: {
                  labels,
                  datasets: [
                    { label: 'Demand', data: line, borderColor: C.accent, backgroundColor: C.fill,
                      fill: true, tension: 0.35, borderWidth: 2, spanGaps: true,
                      pointRadius:          ctx => ctx.dataIndex === FC ? 5 : 3,
                      pointStyle:           ctx => ctx.dataIndex === FC ? 'rectRot' : 'circle',
                      pointBackgroundColor: ctx => ctx.dataIndex === FC ? C.fcDot : C.accent,
                      pointBorderColor: C.accent,
                      segment: { borderDash: ctx => ctx.p1DataIndex === FC ? [5, 4] : undefined } },
                    { label: 'Rec Prep', data: recLine, borderColor: C.rec, borderDash: [3, 3],
                      borderWidth: 1.5, pointRadius: 0, fill: false },
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
                          { text: 'Rec Prep', fillStyle: C.rec,    strokeStyle: C.rec,    pointStyle: 'line',    lineWidth: 1 },
                        ],
                      },
                    },
                    tooltip: {
                      backgroundColor: C.tooltip, padding: 10, cornerRadius: 8,
                      titleFont: { family: 'Geist' }, bodyFont: { family: 'IBM Plex Mono' },
                      filter: item => item.datasetIndex === 1 ? item.dataIndex === FC : true,
                      callbacks: {
                        title: items => items[0].label,
                        label: item => item.datasetIndex === 1
                          ? `Rec Prep: ${item.formattedValue}`
                          : `${item.dataIndex === FC ? 'Forecast' : 'Demand'}: ${item.formattedValue}`,
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

            document.getElementById('chartClose').addEventListener('click', closeChart);
            document.getElementById('portionsChart').addEventListener('click', openOverallChart);
            chartBd.addEventListener('click', closeChart);
            document.addEventListener('keydown', e => {
              if (e.key === 'Escape' && !chartModal.classList.contains('hidden')) closeChart();
            });

            // plan cells
            const planFmt = n => Number(n).toLocaleString('en-US');
            const PLAN_PENCIL = '<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
            const PLAN_RESET  = '<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
            const planContainer = document.getElementById('forecast-rows');
            let planEditing = null;

            // out-of-range band 
            const planBounds = r => ({ mn: Math.round(r.predicted_demand), mx: Math.round(r.predicted_demand + r.safety_stock) });
            const planCellOf = i => planContainer.querySelector(`.plan-cell[data-row="${i}"]`);
            const planValue  = r => Math.round(r.planned_prep ?? r.recommended_prep);

            function renderPlanDisplay(i) {
              const cell = planCellOf(i); if (!cell) return;
              const r = currentRows[i];
              const plan = planValue(r), rec = Math.round(r.recommended_prep);
              const { mn, mx } = planBounds(r);
              const edited = plan !== rec;
              const oob = edited && (plan < mn || plan > mx);  
              const tone = oob
                ? 'border-amber-400 bg-amber-400/10 text-amber-500'
                : edited
                  ? 'border-accent bg-accent/[0.07] text-slate900'
                  : 'bg-panel border-line text-slate900 group-hover:border-accent group-hover:bg-surface';
              cell.innerHTML = `
                ${edited ? `<button class="plan-reset mr-1 text-slate400 hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity" title="Reset to recommended (${planFmt(rec)})">${PLAN_RESET}</button>` : ''}
                <button class="plan-display flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border font-mono text-[13px] transition-colors ${tone}"
                        title="${oob ? 'Outside forecast range ' + mn + '–' + mx : 'Click to edit'}">
                  <span>${planFmt(plan)}</span>
                  ${edited
                    ? '<span class="size-1.5 rounded-full bg-current shrink-0"></span>'
                    : `<span class="text-slate400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">${PLAN_PENCIL}</span>`}
                </button>`;
            }

            function renderPlanEdit(i) {
              const cell = planCellOf(i); if (!cell) return;
              const plan = planValue(currentRows[i]);
              cell.innerHTML = `
                <div class="plan-edit absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center gap-0.5 rounded-md border border-accent bg-surface px-1 py-0.5 shadow-md ring-2 ring-accent/30">
                  <button data-step="-1" class="plan-step flex items-center justify-center size-5 rounded-sm text-slate500 hover:bg-panel hover:text-slate900">−</button>
                  <input type="number" class="plan-input w-[46px] text-center font-mono text-[13px] text-slate900 bg-transparent outline-hidden [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="${plan}" />
                  <button data-step="1" class="plan-step flex items-center justify-center size-5 rounded-sm text-slate500 hover:bg-panel hover:text-slate900">+</button>
                </div>`;
              const input = cell.querySelector('.plan-input');
              input.focus(); input.select();

              let done = false;
              const finish = (save, next) => {
                if (done) return; done = true;
                if (save) {
                  let v = parseInt(input.value, 10);
                  if (isNaN(v)) v = planValue(currentRows[i]);
                  currentRows[i].planned_prep = Math.max(0, v);
                }
                planEditing = null;
                renderPlanDisplay(i);
                if (save && next && i + 1 < currentRows.length) enterPlanEdit(i + 1);
              };
              input.addEventListener('keydown', ev => {
                if (ev.key === 'Enter') { ev.preventDefault(); finish(true, true); }
                else if (ev.key === 'Escape') { ev.preventDefault(); finish(false, false); }
              });
              input.addEventListener('blur', () => setTimeout(() => finish(true, false), 80));
            }

            function enterPlanEdit(i) { planEditing = i; renderPlanEdit(i); }

          
            function renderPlanCells() { currentRows.forEach((_, i) => renderPlanDisplay(i)); }

           
            planContainer.addEventListener('mousedown', e => { if (e.target.closest('.plan-step')) e.preventDefault(); });

            planContainer.addEventListener('click', e => {
              const cell = e.target.closest('.plan-cell'); if (!cell) return;
              const i = parseInt(cell.dataset.row, 10);
              if (e.target.closest('.plan-reset')) { currentRows[i].planned_prep = Math.round(currentRows[i].recommended_prep); renderPlanDisplay(i); return; }
              const step = e.target.closest('.plan-step');
              if (step) {
                const input = cell.querySelector('.plan-input');
                input.value = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(step.dataset.step, 10));
                input.focus();
                return;
              }
              if (e.target.closest('.plan-display') && planEditing !== i) enterPlanEdit(i);
            });


            init();