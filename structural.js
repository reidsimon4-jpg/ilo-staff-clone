// Infinity Structural page: menu toggle + Netlify Forms AJAX submit.
(function () {
    const menuButton = document.querySelector('.menu-toggle');
    const navigation = document.getElementById('navigation');
    if (menuButton && navigation) {
        const closeMenu = () => {
            navigation.classList.remove('open');
            menuButton.setAttribute('aria-expanded', 'false');
        };
        menuButton.addEventListener('click', () => {
            const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
            menuButton.setAttribute('aria-expanded', String(expanded));
            navigation.classList.toggle('open', expanded);
        });
        navigation.addEventListener('click', (event) => {
            if (event.target.closest('a')) closeMenu();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && navigation.classList.contains('open')) {
                closeMenu();
                menuButton.focus();
            }
        });
    }

    const form = document.getElementById('enquiry-form');
    const status = document.getElementById('form-status');
    if (!form || !status) return;

    const MAX_FILE = 8 * 1024 * 1024; // Netlify Forms accepts up to 10 MB per submission.
    const fileInput = form.querySelector('input[type="file"]');

    const show = (html, isError) => {
        status.innerHTML = html;
        status.classList.toggle('error', !!isError);
        status.hidden = false;
        status.focus();
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        if (fileInput && fileInput.files[0] && fileInput.files[0].size > MAX_FILE) {
            show('<strong>That file is too large.</strong><p>Please attach a file under 8 MB, or send drawings by WhatsApp or email.</p>', true);
            return;
        }
        const btn = form.querySelector('button[type="submit"]');
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Sending…';

        fetch(form.getAttribute('action') || '/', { method: 'POST', body: new FormData(form) })
            .then((res) => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                form.reset();
                btn.textContent = original;
                btn.disabled = false;
                show('<strong>Thanks, your enquiry is in.</strong><p>Our project team will reply by email or WhatsApp. ' +
                    'To speed things up, you can also message us now on ' +
                    '<a href="https://wa.me/6285739888885" target="_blank" rel="noopener">WhatsApp</a>.</p>', false);
                if (window.iloTrack) window.iloTrack('generate_lead', { form_name: 'structural-enquiry' });
            })
            .catch(() => {
                btn.textContent = original;
                btn.disabled = false;
                show('<strong>Sorry, that did not send.</strong><p>Please try again, or email ' +
                    '<a href="mailto:structural@ilo.net.au">structural@ilo.net.au</a> or ' +
                    '<a href="https://wa.me/6285739888885" target="_blank" rel="noopener">WhatsApp us</a>.</p>', true);
            });
    });
    form.addEventListener('input', () => { status.hidden = true; });
})();
