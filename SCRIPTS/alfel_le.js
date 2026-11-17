// Az "Aktuális feladatok" kártya kirajzolása (aldiak.html).
// A feladatokat az altanar.html menti a localStorage "statTasks" kulcsába (SCRIPTS/pdf-tasks.js),
// a letöltési listát és a diák megoldás-szerkesztőjét a pdf-tasks.js és az aldiak.js kezeli.
document.addEventListener('DOMContentLoaded', function () {
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const studentTasksContainer = document.getElementById('studentTasksContainer');
    if (!studentTasksContainer) return;

    let tasks = [];
    try { tasks = JSON.parse(localStorage.getItem('statTasks')) || []; } catch (e) { tasks = []; }
    if (!Array.isArray(tasks) || tasks.length === 0) return;

    studentTasksContainer.innerHTML = tasks.map(t => `
        <div class="card mb-3">
            <div class="card-body">
                <h5 class="card-title">${esc(t.title)}</h5>
                <h6 class="card-subtitle mb-2 text-muted">Közzétéve: ${esc(t.date)}</h6>
                <p class="card-text" style="white-space: pre-line;">${esc(t.description)}</p>
            </div>
        </div>
    `).join('');

    // MathJax újrafeldolgozás, hogy a dinamikusan betöltött képletek megjelenjenek
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        window.MathJax.typesetPromise([studentTasksContainer]).catch(err => console.log(err));
    }
});
