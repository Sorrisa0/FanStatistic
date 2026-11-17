/*
 * Beérkezett üzenetek listája (altanar.html).
 * Az üzeneteket a Kapcsolat űrlap (kapcsolat.html + SCRIPTS/script.js) menti a localStorage
 * "contactMessages" kulcsába; ez a fájl csak megjeleníti és kezeli őket.
 */
(function () {
    'use strict';

    const KEY = 'contactMessages';
    const $ = function (id) { return document.getElementById(id); };
    const openIds = new Set();   // melyik üzenet van éppen kinyitva (újrarajzolásnál megmarad)

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getAll() {
        try {
            const a = JSON.parse(localStorage.getItem(KEY));
            return Array.isArray(a) ? a : [];
        } catch (e) { return []; }
    }
    function saveAll(a) { localStorage.setItem(KEY, JSON.stringify(a)); }

    function fmtDate(ts) {
        return new Date(ts).toLocaleString('hu-HU', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    }

    function sorted(items, mode) {
        const list = items.slice();
        const byDateDesc = function (a, b) { return (b.ts || 0) - (a.ts || 0); };
        if (mode === 'date-asc') list.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
        else if (mode === 'name-asc') list.sort(function (a, b) {
            return String(a.name).localeCompare(String(b.name), 'hu', { sensitivity: 'base' }) || byDateDesc(a, b);
        });
        else list.sort(byDateDesc);
        return list;
    }

    function updateUnreadBadge(items) {
        const badge = $('msgUnread');
        if (!badge) return;
        const n = items.filter(function (m) { return !m.read; }).length;
        badge.textContent = n + ' új';
        badge.classList.toggle('d-none', n === 0);
    }

    function render() {
        const list = $('messageList');
        if (!list) return;
        const all = getAll();
        updateUnreadBadge(all);

        if (all.length === 0) {
            list.innerHTML = '<p class="text-muted mb-0">Még nem érkezett üzenet.</p>';
            return;
        }

        list.innerHTML = sorted(all, $('msgSort').value).map(function (m) {
            const open = openIds.has(m.id);
            const subject = encodeURIComponent('Válasz az üzenetedre');
            return '<div class="list-group-item" data-id="' + esc(m.id) + '">'
                + '<button type="button" class="btn p-0 border-0 w-100 text-start d-flex flex-wrap justify-content-between align-items-center gap-2" data-act="toggle" aria-expanded="' + open + '">'
                + '<span><strong' + (m.read ? '' : ' class="text-primary"') + '>' + esc(m.name) + '</strong>'
                + (m.read ? '' : ' <span class="badge bg-danger ms-2" data-new>Új</span>') + '</span>'
                + '<span class="text-muted small">' + esc(fmtDate(m.ts)) + '</span>'
                + '</button>'
                + '<div class="mt-3' + (open ? '' : ' d-none') + '" data-body>'
                + '<div class="small text-muted mb-2">E-mail: <a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a></div>'
                + '<div style="white-space:pre-wrap;word-break:break-word;">' + esc(m.text) + '</div>'
                + '<div class="mt-3 d-flex flex-wrap gap-2">'
                + '<a class="btn btn-outline-primary btn-sm" href="mailto:' + esc(m.email) + '?subject=' + subject + '">Válasz e-mailben</a>'
                + '<button type="button" class="btn btn-outline-danger btn-sm" data-act="delete">Törlés</button>'
                + '</div></div></div>';
        }).join('');
    }

    function onClick(e) {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const item = btn.closest('[data-id]');
        const id = item.dataset.id;

        if (btn.dataset.act === 'toggle') {
            const body = item.querySelector('[data-body]');
            const nowOpen = body.classList.contains('d-none');
            body.classList.toggle('d-none', !nowOpen);
            btn.setAttribute('aria-expanded', nowOpen);
            if (nowOpen) {
                openIds.add(id);
                // Megnyitáskor olvasottnak számít
                const all = getAll();
                const m = all.find(function (x) { return x.id === id; });
                if (m && !m.read) {
                    m.read = true;
                    try { saveAll(all); } catch (err) { /* nem baj */ }
                    const badge = item.querySelector('[data-new]');
                    if (badge) badge.remove();
                    const nameEl = item.querySelector('strong');
                    if (nameEl) nameEl.classList.remove('text-primary');
                    updateUnreadBadge(all);
                }
            } else {
                openIds.delete(id);
            }
        } else if (btn.dataset.act === 'delete') {
            const m = getAll().find(function (x) { return x.id === id; });
            if (m && confirm('Biztosan törlöd "' + m.name + '" üzenetét?')) {
                saveAll(getAll().filter(function (x) { return x.id !== id; }));
                openIds.delete(id);
                render();
            }
        }
    }

    function init() {
        if (!$('messageList')) return;
        render();
        $('messageList').addEventListener('click', onClick);
        $('msgSort').addEventListener('change', render);
        // Ha közben a Kapcsolat űrlapon új üzenet érkezik (másik lapon), a lista frissül
        window.addEventListener('storage', function (e) { if (e.key === KEY) render(); });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
