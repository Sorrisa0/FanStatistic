(function () {
    'use strict';

    const HOME = {
        tanar: { inner: 'altanar.html', login: 'tanar.html' },
        diak: { inner: 'aldiak.html', login: 'diak.html' }
    };

    // Csak akkor számít belépettnek, ha van felhasználó ÉS érvényes szerepkör is
    function getRole() {
        const user = localStorage.getItem('loggedInUser');
        const role = localStorage.getItem('loggedInRole');
        return (user && HOME[role]) ? role : null;
    }

    function currentPage() {
        return location.pathname.split('/').pop() || 'index_1.html';
    }

    // Oldalvédelem és átirányítás
    function guard() {
        const role = getRole();
        const page = currentPage();

        // Belépési oldalak: ha már be van lépve a megfelelő szerepkörben, azonnal a belső oldalra
        if (page === 'tanar.html' && role === 'tanar') { location.replace('altanar.html'); return; }
        if (page === 'diak.html' && role === 'diak') { location.replace('aldiak.html'); return; }

        // Belső oldalak: csak a saját szerepkör léphet be
        if (page === 'altanar.html' && role !== 'tanar') { location.replace('tanar.html'); return; }
        if (page === 'aldiak.html' && role !== 'diak') { location.replace('diak.html'); return; }
    }

    function logout() {
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('loggedInRole');
        location.replace('index_1.html');
    }

    // Menü: a saját szerepkör linkje a belső oldalra mutat + Kilépés gomb
    function updateNav() {
        const role = getRole();
        if (!role) return;

        const target = HOME[role];
        document.querySelectorAll('a[href="' + target.login + '"]').forEach(function (a) {
            a.setAttribute('href', target.inner);
        });

        const menu = document.querySelector('#menu .navbar-nav');
        if (menu && !document.getElementById('logoutLink')) {
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.innerHTML = '<a class="nav-link" href="#" id="logoutLink">Kilépés</a>';
            li.querySelector('a').addEventListener('click', function (e) {
                e.preventDefault();
                logout();
            });
            menu.appendChild(li);
        }
    }

    // Azonnal fut (a <head>-ben), így az oldal tartalma nem villan fel
    guard();

    // Vissza gombbal a gyorsítótárból visszaállított oldalnál is lefut
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) { guard(); updateNav(); }
    });

    document.addEventListener('DOMContentLoaded', updateNav);
})();