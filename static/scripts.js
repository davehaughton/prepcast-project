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


                const res = await fetch(`/api/forecast?centre_id=${centre_id}&promo=${promo}&discount=${discount}&service_level=${service}`);

                currentRows = await res.json();
                renderForecast();

            }
            function renderForecast() {
                const rowHtml = (r, i) => {
                    const safety = r.safety_stock;
                    const rec    = r.recommended_prep;
                    const plan   = r.planned_prep ?? rec;
                    const fc     = r.predicted_demand;
                    const lweek  = r.last_week_orders;
                    const up     = fc >= lweek;
                    const delta  = lweek ? Math.round(((fc - lweek) / lweek) * 100) : 0;  
                    const lo     = Math.round(fc);             
                    const hi     = Math.round(fc + safety);
                    const visIcon = '<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';


                    return `
                    <div class="group flex items-center justify-between px-6 py-4 ${i % 2 ? 'bg-canvas' : 'bg-surface'} border-l-2 border-transparent transition-colors hover:bg-accent/6 hover:border-accent">
                    <div class="flex items-center gap-2 w-[200px]">
                        <span class="font-semibold text-[14px] text-slate900">${r.category}</span>
                        <span class="font-mono text-[11px] text-slate600">#${r.meal_id}</span>
                    </div>
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
                    <div class="w-[100px] flex justify-end">
                        <input type="text" data-meal="${r.meal_id}" value="${plan}"
                            class="w-[70px] text-right font-mono text-[13px] px-2 py-1 rounded-md border border-line bg-panel text-slate900 focus:outline-hidden focus:ring-2 focus:ring-accent/40">
                    </div>
                    <div class="w-10 flex justify-center">
                <button data-chart="" class="vis-btn p-1 rounded-sm text-slate400 transition-colors hover:text-accent hover:bg-accent/10 group-hover:text-accent focus:outline-hidden focus:ring-2 focus:ring-accent/40" aria-label="View chart for ">${visIcon}</button>
                </div>
                    </div>`;
                };

                document.getElementById("forecast-rows").innerHTML = currentRows.map(rowHtml).join("");
                
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
                const items = currentRows.map(r => {
                    const input = document.querySelector(`#forecast-rows input[data-meal="${r.meal_id}"]`);
                    return {
                        meal_id: r.meal_id,
                        recommended_prep: r.recommended_prep,
                        planned_prep: Number(input.value)              
                    };
                });
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
       



            // ---- Adjust Service Level modal ----
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
            const status = committed >= 95 ? 'on track' : committed >= 80 ? 'monitor' : 'at risk';
            serviceCaption.textContent = `Target: ${committed}% · Current: ${status}`;
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

            // ---- Email promo toggle ----
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

            // ---- Discount slider ----
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

            // ---- Dark mode toggle ----
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
            });
            })();



            init();