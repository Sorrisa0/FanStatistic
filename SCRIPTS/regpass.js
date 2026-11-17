document.addEventListener('DOMContentLoaded', function () {
    const ROLE = 'tanar';              // a regpassdiak.js-ben: 'diak'
    const TARGET_PAGE = 'altanar.html'; // a regpassdiak.js-ben: 'aldiak.html'

    const loginForm = document.getElementById('loginForm');
    const loginAlert = document.getElementById('loginAlert');
    const registerForm = document.getElementById('registerForm');
    const registerAlert = document.getElementById('registerAlert');

    function showAlert(element, message, type) {
        element.textContent = message;
        element.className = `alert alert-${type} mt-3`;
        element.classList.remove('d-none');
    }

    function getUsers() {
        try {
            return JSON.parse(localStorage.getItem('bandUsers')) || [];
        } catch (e) {
            return [];
        }
    }

    // Jelszó hashelése (SHA-256), hogy ne sima szövegként kerüljön a tárolóba
    async function hashPassword(password) {
        const data = new TextEncoder().encode(password);
        const buffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ---------- REGISZTRÁCIÓ ----------
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('regEmail').value.trim().toLowerCase();
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regPasswordConfirm').value;

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showAlert(registerAlert, 'Hiba: Érvénytelen email cím!', 'danger');
                return;
            }
            if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
                showAlert(registerAlert, 'Hiba: A jelszó legalább 8 karakter legyen, és tartalmazzon kis- és nagybetűt is!', 'danger');
                return;
            }
            if (password !== confirm) {
                showAlert(registerAlert, 'Hiba: A két jelszó nem egyezik!', 'danger');
                return;
            }

            const users = getUsers();
            if (users.some(u => u.email === email && u.role === ROLE)) {
                showAlert(registerAlert, 'Hiba: Ezzel az email címmel már regisztráltak!', 'danger');
                return;
            }

            users.push({
                email: email,
                password: await hashPassword(password),
                role: ROLE
            });
            localStorage.setItem('bandUsers', JSON.stringify(users));

            registerForm.reset();
            showAlert(registerAlert, 'Sikeres regisztráció! Most már beléphet.', 'success');

            // Átváltás a Belépés fülre kb. 1,5 mp után
            setTimeout(function () {
                const loginTab = document.getElementById('login-tab');
                if (loginTab) loginTab.click();
            }, 1500);
        });
    }

    // ---------- BELÉPÉS ----------
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value.trim().toLowerCase();
            const password = document.getElementById('loginPassword').value;
            const hashed = await hashPassword(password);

            const foundUser = getUsers().find(u =>
                u.email === email && u.password === hashed && u.role === ROLE);

            if (!foundUser) {
                showAlert(loginAlert, 'Hiba: Hibás email cím vagy jelszó!', 'danger');
                return;
            }

            localStorage.setItem('loggedInUser', email);
            localStorage.setItem('loggedInRole', ROLE);
            showAlert(loginAlert, 'Sikeres bejelentkezés! Átirányítás...', 'success');
            window.location.replace(TARGET_PAGE);
        });
    }
});