/*
 * Diák felület (aldiak.html):
 *  - megoldás-szerkesztő: a diák írja a megoldást, a MathJax csak megjeleníti (nincs generálás)
 *  - a beküldött megoldások (localStorage) és a feltöltött fájlok (IndexedDB) a "Saját megoldásaim" listában
 * Szükséges: SCRIPTS/pdf-tasks.js (PdfTasks), MathJax, Chart.js, html2pdf.
 */
(function () {
    'use strict';

    const SOL_KEY = 'studentSolutions';
    const DB_NAME = 'statisztikaDiak';
    const STORE = 'files';
    const MAX_FILE = 10 * 1024 * 1024;
    const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'];

    const $ = function (id) { return document.getElementById(id); };
    const esc = PdfTasks.escapeHtml;

    function getOwner() { return localStorage.getItem('loggedInUser') || ''; }
    function today() { return new Date().toLocaleDateString('hu-HU'); }
    function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    function typeset(el) {
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            window.MathJax.typesetPromise([el]).catch(function (err) { console.log(err); });
        }
    }

    function showAlert(el, text, type) {
        el.className = 'alert alert-' + type;
        el.textContent = text;
    }

    // =============== beküldött megoldások (localStorage) ===============
    function getSolutions() {
        try {
            const a = JSON.parse(localStorage.getItem(SOL_KEY));
            return Array.isArray(a) ? a : [];
        } catch (e) { return []; }
    }
    function setSolutions(a) { localStorage.setItem(SOL_KEY, JSON.stringify(a)); }

    // =============== feltöltött fájlok (IndexedDB: a nagy fájlok nem férnek a localStorage-ba) ===============
    function openDb() {
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) { reject(new Error('Az IndexedDB nem érhető el ebben a böngészőben.')); return; }
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }
    function idb(mode, fn) {
        return openDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                const tx = db.transaction(STORE, mode);
                const req = fn(tx.objectStore(STORE));
                tx.oncomplete = function () { db.close(); resolve(req && req.result); };
                tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
            });
        });
    }
    const idbPut = function (rec) { return idb('readwrite', function (s) { return s.put(rec); }); };
    const idbAll = function () { return idb('readonly', function (s) { return s.getAll(); }); };
    const idbGet = function (id) { return idb('readonly', function (s) { return s.get(id); }); };
    const idbDelete = function (id) { return idb('readwrite', function (s) { return s.delete(id); }); };

    function formatSize(bytes) {
        return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    // =============== a megoldás-szerkesztő ===============
    const SYMBOLS = [
        [
            { l: 'x̄', t: ' $\\overline{x}$ ', h: 'Átlag (x vonallal)' },
            { l: 'Mo', t: ' Mo ', h: 'Módusz jelölése' },
            { l: 'Me', t: ' Me ', h: 'Medián jelölése' },
            { l: 'σ', t: ' $\\sigma$ ', h: 'Szórás (szigma)' },
            { l: 'Σ', t: ' $\\sum$ ', h: 'Összegzés (szumma)' },
            { l: 'N', t: ' N ', h: 'Elemszám' }
        ],
        [
            { l: 'x²', t: ' $x^{2}$ ', h: 'Négyzet (felső index)' },
            { l: 'xᵢ', t: ' $x_{i}$ ', h: 'Alsó index (i)' },
            { l: 'a/b', t: ' $\\frac{a}{b}$ ', h: 'Tört' },
            { l: '√', t: ' $\\sqrt{x}$ ', h: 'Négyzetgyök' }
        ],
        [
            { l: '≤', t: ' $\\le$ ', h: 'Kisebb vagy egyenlő' },
            { l: '≥', t: ' $\\ge$ ', h: 'Nagyobb vagy egyenlő' },
            { l: '≈', t: ' $\\approx$ ', h: 'Közelítőleg egyenlő' },
            { l: '·', t: ' $\\cdot$ ', h: 'Szorzás pont' },
            { l: '%', t: ' % ', h: 'Százalék' }
        ]
    ];

    function buildToolbar() {
        $('symbolToolbar').innerHTML = SYMBOLS.map(function (group, gi) {
            return '<div class="btn-group btn-group-sm" role="group">' + group.map(function (b, bi) {
                return '<button type="button" class="btn btn-outline-secondary" data-g="' + gi + '" data-b="' + bi
                    + '" title="' + esc(b.h) + '">' + esc(b.l) + '</button>';
            }).join('') + '</div>';
        }).join('');

        $('symbolToolbar').addEventListener('click', function (e) {
            const btn = e.target.closest('button[data-g]');
            if (!btn) return;
            insertAtCursor(SYMBOLS[btn.dataset.g][btn.dataset.b].t);
        });
    }

    function insertAtCursor(text) {
        const ta = $('solText');
        const start = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + text + ta.value.substring(end);
        ta.focus();
        ta.setSelectionRange(start + text.length, start + text.length);
        updatePreview();
    }

    // ----- táblázat -----
    function appendRow(v1, v2) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><input type="text" class="form-control form-control-sm" placeholder="Pl. 150-160"></td>'
            + '<td><input type="number" class="form-control form-control-sm" placeholder="db"></td>'
            + '<td class="text-center align-middle"><button type="button" class="btn btn-outline-danger btn-sm py-0 px-2" data-del title="Sor törlése">×</button></td>';
        const inputs = tr.querySelectorAll('input');
        inputs[0].value = v1 == null ? '' : v1;
        inputs[1].value = v2 == null ? '' : v2;
        $('solTableGrid').appendChild(tr);
    }

    function showTable() {
        $('solTableWrap').classList.remove('d-none');
        $('solChartCard').classList.remove('d-none');
    }

    function collectRows() {
        const rows = [];
        $('solTableGrid').querySelectorAll('tr').forEach(function (tr) {
            const inputs = tr.querySelectorAll('input');
            if (inputs.length >= 2 && inputs[0].value.trim() !== '') {
                rows.push([inputs[0].value.trim(), inputs[1].value.trim()]);
            }
        });
        return rows;
    }

    function useTable() { return $('solUseTable').checked; }

    // ----- diagram -----
    let chart = null;
    function updateChart() {
        const canvas = $('solChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const rows = useTable() ? collectRows() : [];
        if (rows.length === 0) {
            if (chart) { chart.destroy(); chart = null; }
            return;
        }
        const type = $('solChartType').value;
        if (chart) chart.destroy();
        chart = new Chart(canvas.getContext('2d'), {
            type: type,
            data: {
                labels: rows.map(function (r) { return r[0]; }),
                datasets: [{
                    label: 'Gyakoriság',
                    data: rows.map(function (r) { return parseFloat(r[1]) || 0; }),
                    backgroundColor: type === 'pie'
                        ? ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff']
                        : 'rgba(54, 162, 235, 0.6)',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, scales: type === 'pie' ? {} : { y: { beginAtZero: true } } }
        });
    }

    // ----- előnézet (MathJax) -----
    function updatePreview() {
        const text = $('solText').value;
        const rows = useTable() ? collectRows() : [];
        let html = '';
        if (text.trim() !== '') html += '<div>' + PdfTasks.textToHtml(text) + '</div>';
        if (rows.length > 0) html += PdfTasks.tableHtml(rows);
        const el = $('solPreview');
        if (html === '') {
            el.innerHTML = '<span class="text-muted fst-italic">A megoldásod itt jelenik meg...</span>';
        } else {
            el.innerHTML = html;
            typeset(el);
        }
        updateChart();
    }

    function applyTableToggle() {
        const on = useTable();
        $('solTableCard').classList.toggle('d-none', !on);
        $('solChartCard').classList.toggle('d-none', !(on && $('solTableGrid').children.length > 0));
        updatePreview();
    }

    // ----- feladat kiválasztása -----
    function refreshTaskOptions(keep) {
        const sel = $('solTask');
        const tasks = PdfTasks.getTasks();
        sel.innerHTML = '<option value="">— Válassz feladatot —</option>'
            + tasks.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.title) + '</option>'; }).join('')
            + '<option value="__other">Egyéb (saját cím)</option>';
        if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
        onTaskChange();
    }

    function onTaskChange() {
        const v = $('solTask').value;
        $('solTitleWrap').classList.toggle('d-none', v !== '__other');
        const box = $('solTaskPreview');
        const task = PdfTasks.getTasks().find(function (t) { return t.id === v; });
        if (!task) { box.classList.add('d-none'); box.innerHTML = ''; return; }
        box.classList.remove('d-none');
        box.innerHTML = '<div><strong>Feladat: ' + esc(task.title) + '</strong><br>' + PdfTasks.textToHtml(task.description) + '</div>'
            + PdfTasks.tableHtml(task.rows)
            + ((task.chartImg && task.rows && task.rows.length)
                ? '<div class="text-center my-2"><img src="' + task.chartImg + '" style="max-width:350px;" alt="Diagram"></div>' : '');
        typeset(box);
    }

    function currentSolution() {
        const v = $('solTask').value;
        let title = '', taskId = '';
        if (v === '__other') {
            title = $('solTitle').value.trim();
        } else if (v) {
            const t = PdfTasks.getTasks().find(function (x) { return x.id === v; });
            if (t) { title = t.title; taskId = t.id; }
        }
        const rows = useTable() ? collectRows() : [];
        let chartImg = '';
        if (rows.length > 0 && !$('solChartCard').classList.contains('d-none')) {
            chartImg = $('solChart').toDataURL('image/png');
        }
        return {
            title: title, taskId: taskId, owner: getOwner(), date: today(),
            solution: $('solText').value, rows: rows, chartImg: chartImg
        };
    }

    function validate(sol) {
        if (!sol.title) { alert('Válaszd ki a feladatot, vagy az "Egyéb" lehetőségnél add meg a címét!'); return false; }
        if (!sol.solution.trim()) { alert('Előbb írd be a megoldást!'); return false; }
        return true;
    }

    function loadIntoEditor(sol) {
        refreshTaskOptions(sol.taskId || '__other');
        if (!sol.taskId || $('solTask').value !== sol.taskId) {
            $('solTask').value = '__other';
            $('solTitle').value = sol.title;
        }
        onTaskChange();
        $('solText').value = sol.solution;
        $('solTableGrid').innerHTML = '';
        const hasTable = sol.rows && sol.rows.length > 0;
        $('solUseTable').checked = !!hasTable;
        if (hasTable) {
            sol.rows.forEach(function (r) { appendRow(r[0], r[1]); });
            showTable();
        }
        applyTableToggle();
        $('solutionEditorCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // =============== "Saját megoldásaim és feltöltött fájlok" lista ===============
    async function renderSubmissions() {
        const el = $('mySubmissionList');
        const owner = getOwner();
        const items = getSolutions().filter(function (s) { return s.owner === owner; })
            .map(function (s) { return { kind: 'sol', ts: s.ts || 0, data: s }; });

        let dbError = false;
        try {
            const files = await idbAll();
            files.filter(function (f) { return f.owner === owner; })
                .forEach(function (f) { items.push({ kind: 'file', ts: f.ts || 0, data: f }); });
        } catch (e) { dbError = true; }

        items.sort(function (a, b) { return b.ts - a.ts; });

        let html = items.map(function (it) {
            const d = it.data;
            if (it.kind === 'sol') {
                return '<div class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">'
                    + '<div><span class="badge bg-success me-2">Megoldás</span><strong>' + esc(d.title) + '</strong> '
                    + '<span class="text-muted small">(' + esc(d.date) + ')</span></div>'
                    + '<div class="d-flex flex-wrap gap-2">'
                    + '<button type="button" class="btn btn-outline-success btn-sm" data-act="sol-pdf" data-id="' + esc(d.id) + '">PDF</button>'
                    + '<button type="button" class="btn btn-outline-primary btn-sm" data-act="sol-edit" data-id="' + esc(d.id) + '">Szerkesztés</button>'
                    + '<button type="button" class="btn btn-outline-danger btn-sm" data-act="sol-del" data-id="' + esc(d.id) + '">Törlés</button>'
                    + '</div></div>';
            }
            return '<div class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">'
                + '<div><span class="badge bg-secondary me-2">Feltöltött fájl</span><strong>' + esc(d.name) + '</strong> '
                + '<span class="text-muted small">(' + esc(formatSize(d.size)) + ', ' + esc(d.date) + ')</span></div>'
                + '<div class="d-flex flex-wrap gap-2">'
                + '<button type="button" class="btn btn-outline-dark btn-sm" data-act="file-dl" data-id="' + esc(d.id) + '">Letöltés</button>'
                + '<button type="button" class="btn btn-outline-danger btn-sm" data-act="file-del" data-id="' + esc(d.id) + '">Törlés</button>'
                + '</div></div>';
        }).join('');

        if (items.length === 0) html = '<p class="text-muted mb-0">Még nincs beküldött megoldásod vagy feltöltött fájlod.</p>';
        if (dbError) html += '<p class="text-danger small mt-2 mb-0">A feltöltött fájlok nem érhetők el ebben a böngészőben (privát ablak?).</p>';
        el.innerHTML = html;
    }

    async function onListClick(e) {
        const btn = e.target.closest('button[data-act]');
        if (!btn || btn.disabled) return;
        const id = btn.dataset.id, act = btn.dataset.act;
        const sols = getSolutions();
        const sol = sols.find(function (s) { return s.id === id; });

        try {
            if (act === 'sol-edit' && sol) { loadIntoEditor(sol); return; }
            if (act === 'sol-del' && sol) {
                if (confirm('Biztosan törlöd a(z) "' + sol.title + '" megoldást?')) {
                    setSolutions(sols.filter(function (s) { return s.id !== id; }));
                    renderSubmissions();
                }
                return;
            }
            if (act === 'sol-pdf' && sol) {
                const label = btn.textContent;
                btn.disabled = true; btn.textContent = 'Készül…';
                try { await PdfTasks.exportStudentSolutionPdf(sol); }
                finally { btn.disabled = false; btn.textContent = label; }
                return;
            }
            if (act === 'file-dl') {
                const rec = await idbGet(id);
                if (!rec) { renderSubmissions(); return; }
                const url = URL.createObjectURL(rec.blob);
                const a = document.createElement('a');
                a.href = url; a.download = rec.name;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
                return;
            }
            if (act === 'file-del') {
                if (confirm('Biztosan törlöd ezt a feltöltött fájlt?')) {
                    await idbDelete(id);
                    renderSubmissions();
                }
            }
        } catch (err) {
            console.error(err);
            alert('Nem sikerült a művelet: ' + err);
        }
    }

    // =============== fájlfeltöltés ===============
    async function onUpload(e) {
        e.preventDefault();
        const input = $('solutionFileInput');
        const alertEl = $('uploadAlert');
        const files = Array.prototype.slice.call(input.files);
        if (files.length === 0) return;

        const ok = [], problems = [];
        for (const f of files) {
            const ext = f.name.split('.').pop().toLowerCase();
            if (ALLOWED.indexOf(ext) < 0) { problems.push('"' + f.name + '": nem engedélyezett fájltípus'); continue; }
            if (f.size > MAX_FILE) { problems.push('"' + f.name + '": nagyobb, mint 10 MB'); continue; }
            try {
                await idbPut({
                    id: newId('f'), owner: getOwner(), name: f.name, type: f.type, size: f.size,
                    date: today(), ts: Date.now(), blob: f
                });
                ok.push(f.name);
            } catch (err) {
                problems.push('"' + f.name + '": ' + (err && err.message ? err.message : 'a mentés nem sikerült'));
            }
        }

        if (ok.length > 0 && problems.length === 0) {
            showAlert(alertEl, ok.length === 1 ? 'A(z) "' + ok[0] + '" fájl sikeresen feltöltve!' : ok.length + ' fájl sikeresen feltöltve!', 'success');
        } else if (ok.length > 0) {
            showAlert(alertEl, ok.length + ' fájl feltöltve. Nem sikerült: ' + problems.join('; '), 'warning');
        } else {
            showAlert(alertEl, 'Nem sikerült a feltöltés: ' + problems.join('; '), 'danger');
        }
        $('solutionUploadForm').reset();
        renderSubmissions();
    }

    // =============== beküldés és PDF a szerkesztőből ===============
    function onSubmit(e) {
        e.preventDefault();
        const sol = currentSolution();
        if (!validate(sol)) return;
        sol.id = newId('s');
        sol.ts = Date.now();

        const list = getSolutions();
        const key = sol.title.trim().toLowerCase();
        const i = list.findIndex(function (s) { return s.owner === sol.owner && String(s.title).trim().toLowerCase() === key; });
        if (i >= 0) { sol.id = list[i].id; list[i] = sol; } else { list.push(sol); }

        const alertEl = $('solAlert');
        try {
            setSolutions(list);
            showAlert(alertEl, i >= 0
                ? 'A(z) "' + sol.title + '" megoldásod frissítve a listában.'
                : 'A(z) "' + sol.title + '" megoldásod elmentve, megjelent a "Saját megoldásaim" listában.', 'success');
            renderSubmissions();
        } catch (err) {
            showAlert(alertEl, 'A mentés nem sikerült (valószínűleg megtelt a böngésző tárhelye).', 'danger');
        }
    }

    async function onPdf() {
        const sol = currentSolution();
        if (!validate(sol)) return;
        const btn = $('solPdfBtn');
        const label = btn.textContent;
        btn.disabled = true; btn.textContent = 'Készül…';
        try { await PdfTasks.exportStudentSolutionPdf(sol); }
        catch (err) { console.error(err); alert('Nem sikerült elkészíteni a PDF-et: ' + err); }
        finally { btn.disabled = false; btn.textContent = label; }
    }

    // =============== indítás ===============
    function init() {
        if (!$('solutionForm')) return;
        buildToolbar();
        refreshTaskOptions();

        $('solTask').addEventListener('change', onTaskChange);
        $('solText').addEventListener('input', updatePreview);
        $('solUseTable').addEventListener('change', applyTableToggle);
        $('solChartType').addEventListener('change', updateChart);

        $('solGenTable').addEventListener('click', function () {
            const n = Math.min(15, Math.max(1, parseInt($('solTableRows').value, 10) || 1));
            $('solTableGrid').innerHTML = '';
            for (let i = 0; i < n; i++) appendRow('', '');
            showTable();
            updatePreview();
        });
        $('solAddRow').addEventListener('click', function () {
            appendRow('', '');
            showTable();
            updatePreview();
        });
        $('solTableGrid').addEventListener('input', updatePreview);
        $('solTableGrid').addEventListener('click', function (e) {
            const del = e.target.closest('button[data-del]');
            if (del) { del.closest('tr').remove(); updatePreview(); }
        });

        $('solutionForm').addEventListener('submit', onSubmit);
        $('solPdfBtn').addEventListener('click', onPdf);
        $('solutionUploadForm').addEventListener('submit', onUpload);
        $('mySubmissionList').addEventListener('click', onListClick);

        // Ha a tanár új feladatot ment egy másik lapon, a választó és a lista frissül
        window.addEventListener('storage', function (e) {
            if (e.key === 'statTasks') refreshTaskOptions($('solTask').value);
            if (e.key === SOL_KEY) renderSubmissions();
        });

        updatePreview();
        renderSubmissions();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
