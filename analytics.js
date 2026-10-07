// Google Analytics 4 for www.ilo.net.au (property stream G-DFLNQL7WQ5)
// Loaded on every page. Also records the actions that matter for leads:
// WhatsApp clicks, email clicks, phone clicks and successful form submissions.
(function () {
    var ID = 'G-DFLNQL7WQ5';
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;
    gtag('js', new Date());
    gtag('config', ID, { send_page_view: true });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);

    // Shared helper used by main.js and structural.js after a form really sends.
    window.iloTrack = function (name, params) {
        try { gtag('event', name, params || {}); } catch (e) { }
    };

    // Lead-intent clicks anywhere on the page.
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href') || '';
        var text = (a.textContent || '').trim().slice(0, 60);
        if (href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp') !== -1) {
            window.iloTrack('whatsapp_click', { link_text: text, page_path: location.pathname });
        } else if (href.indexOf('mailto:') === 0) {
            window.iloTrack('email_click', { link_text: text, page_path: location.pathname });
        } else if (href.indexOf('tel:') === 0) {
            window.iloTrack('phone_click', { link_text: text, page_path: location.pathname });
        }
    }, true);
})();
