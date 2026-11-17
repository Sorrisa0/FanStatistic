/*
 * Közös feladat- és PDF-kezelő az altanar.html és az aldiak.html oldalhoz.
 *  - a mentett feladatok a localStorage "statTasks" kulcsában vannak
 *  - a letöltési lista (#taskDownloadList) automatikusan kirajzolódik
 *  - a feladat- és megoldás-PDF a mentett adatokból, kattintáskor készül
 * Szükséges: html2pdf (és a MathJax a képletekhez) betöltve az oldalon.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'statTasks';
    const LIST_ID = 'taskDownloadList';

    // ---------- segédfüggvények ----------
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function textToHtml(s) {
        return escapeHtml(s).replace(/\n/g, '<br>');
    }

    // Ékezetmentes, fájlnévbarát cím: "Hőmérséklet adatok" -> "Homerseklet_adatok"
    function safeFileName(title) {
        const name = String(title || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        return name || 'feladat';
    }

    // ---------- tárolás ----------
    function getTasks() {
        let tasks;
        try {
            tasks = JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch (e) {
            tasks = null;
        }
        if (!Array.isArray(tasks)) return [];

        // A régi bejegyzéseknek nincs azonosítójuk: pótoljuk és el is mentjük
        let changed = false;
        tasks.forEach(function (t, i) {
            if (!t.id) { t.id = 'regi' + i + Date.now().toString(36); changed = true; }
        });
        if (changed) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) { /* nem baj */ } }
        return tasks;
    }

    // Ugyanolyan című feladat esetén felülírja a régit (így a szerkesztett feladat nem duplázódik).
    // 'added' vagy 'updated' az eredmény; a tárhely megtelésekor kivételt dob.
    function saveTask(task) {
        const tasks = getTasks();
        const key = String(task.title).trim().toLowerCase();
        const i = tasks.findIndex(function (t) { return String(t.title).trim().toLowerCase() === key; });
        if (i >= 0) { task.id = tasks[i].id; tasks[i] = task; } else { tasks.push(task); }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        return i >= 0 ? 'updated' : 'added';
    }

    function deleteTask(id) {
        const tasks = getTasks().filter(function (t) { return t.id !== id; });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    // ---------- PDF ----------
    // A PDF-hez külön táblázat készül beégetett stílusokkal, mert az oldal sötét témája
    // (fehér szöveg) és a Bootstrap osztályok nem érvényesülnének a PDF-ben.
    function tableHtml(rows) {
        if (!rows || rows.length === 0) return '';
        const cell = 'border:1px solid #888;padding:6px 10px;color:#000;';
        let html = '<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:13px;">'
            + '<thead><tr>'
            + '<th style="' + cell + 'background:#e9ecef;text-align:left;">Érték / Intervallum</th>'
            + '<th style="' + cell + 'background:#e9ecef;text-align:left;">Gyakoriság (db)</th>'
            + '</tr></thead><tbody>';
        rows.forEach(function (r) {
            html += '<tr style="page-break-inside:avoid;"><td style="' + cell + '">' + escapeHtml(r[0])
                + '</td><td style="' + cell + '">' + escapeHtml(r[1]) + '</td></tr>';
        });
        return html + '</tbody></table>';
    }

    // Közös PDF-készítő: a tartalmat rejtett, fehér hátterű elemben rendereli, lefuttatja rajta
    // a MathJax-ot (képletek), majd letölti a PDF-et.
    async function buildPdf(innerHtml, fileName) {
        if (typeof html2pdf === 'undefined') {
            alert('A PDF-készítő könyvtár (html2pdf) nem töltődött be. Ellenőrizd az internetkapcsolatot, és frissítsd az oldalt.');
            return;
        }

        // A rejtett tároló viszi ki a képernyőről az elemet; maga a "wrap" nem kap pozicionálást,
        // mert az html2pdf a stílusait is másolja, és a képernyőn kívüli elemből üres PDF lenne.
        const holder = document.createElement('div');
        holder.style.cssText = 'position:fixed;left:-10000px;top:0;';
        const wrap = document.createElement('div');
        wrap.style.cssText = 'width:700px;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;';
        wrap.innerHTML = innerHtml;
        holder.appendChild(wrap);
        document.body.appendChild(holder);

        // Az html2pdf az aktuális görgetéshez képest rajzol: görgetett oldalról üres PDF lenne.
        // A Bootstrap sima görgetése miatt az ugrásnak azonnalinak ('instant') kell lennie.
        const prevScrollY = window.scrollY;
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        try {
            if (window.MathJax && window.MathJax.typesetPromise) {
                if (window.MathJax.startup && window.MathJax.startup.promise) {
                    await window.MathJax.startup.promise;
                }
                await window.MathJax.typesetPromise([wrap]);
            }
            await html2pdf().set({
                margin: 12,
                filename: fileName,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'img'] }
            }).from(wrap).save();
        } finally {
            holder.remove();
            window.scrollTo({ top: prevScrollY, left: 0, behavior: 'instant' });
        }
    }

    function chartBlock(task) {
        return (task.chartImg && task.rows && task.rows.length)
            ? '<div style="text-align:center;margin:15px 0;"><img src="' + task.chartImg + '" style="max-width:380px;"></div>'
            : '';
    }

    // task: { title, description, solution, rows: [[érték, gyakoriság], ...], chartImg }
    async function exportTaskPdf(task) {
        const title = String(task.title || '').trim() || 'Feladat';
        const chartHtml = chartBlock(task);
        await buildPdf(
            '<h2 style="margin:0 0 15px 0;color:#000;">' + escapeHtml(title) + '</h2>'
            + '<div style="color:#000;"><strong>Feladat:</strong><br>' + textToHtml(task.description) + '</div>'
            + tableHtml(task.rows) + chartHtml,
            safeFileName(title) + '_feladat.pdf'
        );
    }

    async function exportSolutionPdf(task) {
        const title = String(task.title || '').trim() || 'Feladat';
        await buildPdf(
            '<h2 style="margin:0 0 15px 0;color:#000;">' + escapeHtml(title) + ' – Kidolgozott megoldás</h2>'
            + '<div style="color:#000;">' + textToHtml(task.solution) + '</div>',
            safeFileName(title) + '_megoldas.pdf'
        );
    }

    // A diák saját megoldása: { title, owner, date, solution, rows, chartImg }
    async function exportStudentSolutionPdf(sol) {
        const title = String(sol.title || '').trim() || 'Feladat';
        const meta = (sol.owner ? 'Beküldő: ' + escapeHtml(sol.owner) + ' · ' : '') + escapeHtml(sol.date || '');
        await buildPdf(
            '<h2 style="margin:0 0 6px 0;color:#000;">' + escapeHtml(title) + ' – Diák megoldása</h2>'
            + '<div style="color:#555;font-size:12px;margin-bottom:14px;">' + meta + '</div>'
            + '<div style="color:#000;">' + textToHtml(sol.solution) + '</div>'
            + tableHtml(sol.rows) + chartBlock(sol),
            safeFileName(title) + '_diak_megoldas.pdf'
        );
    }

    // ---------- letöltési lista ----------
    function renderList() {
        const container = document.getElementById(LIST_ID);
        if (!container) return;
        const canDelete = container.dataset.canDelete === 'true';
        const tasks = getTasks().slice().reverse(); // legújabb elöl

        if (tasks.length === 0) {
            container.innerHTML = '<p class="text-muted mb-0">Még nincs mentett feladat.</p>';
            return;
        }

        container.innerHTML = tasks.map(function (t) {
            const hasSolution = String(t.solution || '').trim() !== '';
            return '<div class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">'
                + '<div><strong>' + escapeHtml(t.title) + '</strong>'
                + (t.date ? ' <span class="text-muted small">(' + escapeHtml(t.date) + ')</span>' : '') + '</div>'
                + '<div class="d-flex flex-wrap gap-2">'
                + '<button type="button" class="btn btn-outline-primary btn-sm" data-act="task" data-id="' + escapeHtml(t.id) + '">Feladat PDF</button>'
                + '<button type="button" class="btn btn-outline-success btn-sm" data-act="solution" data-id="' + escapeHtml(t.id) + '"'
                + (hasSolution ? '' : ' disabled title="Ehhez a feladathoz nincs mentett megoldás"') + '>Megoldás PDF</button>'
                + (canDelete ? '<button type="button" class="btn btn-outline-danger btn-sm" data-act="delete" data-id="' + escapeHtml(t.id) + '">Törlés</button>' : '')
                + '</div></div>';
        }).join('');
    }

    function init() {
        const container = document.getElementById(LIST_ID);
        if (!container) return;
        renderList();

        container.addEventListener('click', async function (e) {
            const btn = e.target.closest('button[data-act]');
            if (!btn || btn.disabled) return;
            const task = getTasks().find(function (t) { return t.id === btn.dataset.id; });
            if (!task) { renderList(); return; }

            if (btn.dataset.act === 'delete') {
                if (confirm('Biztosan törlöd a(z) "' + task.title + '" feladatot és a megoldását?')) {
                    deleteTask(task.id);
                    renderList();
                }
                return;
            }

            const label = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Készül…';
            try {
                if (btn.dataset.act === 'task') await exportTaskPdf(task);
                else await exportSolutionPdf(task);
            } catch (err) {
                console.error(err);
                alert('Nem sikerült elkészíteni a PDF-et: ' + err);
            } finally {
                btn.disabled = false;
                btn.textContent = label;
            }
        });

        // Ha a tanár egy másik lapon ment új feladatot, a lista itt is frissül
        window.addEventListener('storage', function (e) {
            if (e.key === STORAGE_KEY) renderList();
        });
    }

    window.PdfTasks = {
        saveTask: saveTask,
        deleteTask: deleteTask,
        getTasks: getTasks,
        renderList: renderList,
        exportTaskPdf: exportTaskPdf,
        exportSolutionPdf: exportSolutionPdf,
        exportStudentSolutionPdf: exportStudentSolutionPdf,
        tableHtml: tableHtml,
        escapeHtml: escapeHtml,
        textToHtml: textToHtml
    };

    document.addEventListener('DOMContentLoaded', init);
})();
