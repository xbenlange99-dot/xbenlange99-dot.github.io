/* LCA-Besucherstatistik (cookielos). Quelle: quelle/lca-statistik.js (aus Websiteentwurf/src übernommen) – quelle/build.py setzt die Konfiguration K ein (quelle/statistik.py).
   Zaehlt Seitenaufrufe und wenige Ereignisse ueber die oeffentliche Schnittstelle des Anbieters (K.anbieter: 'umami' =
   POST /api/send mit Website-ID, 'plausible' = POST /api/event). Keine Cookies, keine Geraeteeigenschaften:
   gesendet werden nur Seitenadresse (ohne Parameter ausser utm_*), Herkunftsseite (ohne Parameter), Ereignisname und
   feste Zusatzangaben; bei Umami weder Sprache noch Bildschirmgroesse noch Seitentitel. Widerspruch: Schalter auf /datenschutz/ (Vermerk "lca-statistik" im Browserspeicher), GPC/DNT. */
(() => {
  'use strict';
  const K = {"modus": "aus", "anbieter": "umami", "domain": "", "website": "", "endpunkt": "https://gateway.umami.is/api/send", "dienst": "mit Umami auf Servern in der EU", "hosts": ["lcainfo.de", "www.lcainfo.de"]};
  const SCHLUESSEL = 'lca-statistik';
  const skript = document.currentScript;
  const art = skript ? skript.getAttribute('data-seite') : null;
  const aufSeite = K.hosts.indexOf(location.hostname) >= 0;
  const signal = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';

  function lies() { try { return localStorage.getItem(SCHLUESSEL); } catch (e) { return null; } }
  function merke(wert) { try { if (wert) localStorage.setItem(SCHLUESSEL, wert); else localStorage.removeItem(SCHLUESSEL); } catch (e) { /* Speicher gesperrt: Wahl gilt nur fuer diese Seite */ } }

  function darf() {
    if (K.modus === 'aus' || !aufSeite) return false;
    const wahl = lies();
    return K.modus === 'einwilligung' ? wahl === 'ja' : wahl !== 'nein' && !signal;
  }

  function ohneParameter(href, kampagne) {
    try {
      const u = new URL(href, location.href);
      const q = new URLSearchParams();
      if (kampagne) u.searchParams.forEach((v, k) => { if (/^utm_(source|medium|campaign|content|term)$/.test(k)) q.append(k, v); });
      u.search = q.toString(); u.hash = ''; u.username = ''; u.password = '';
      return u.href;
    } catch (e) { return ''; }
  }

  // Adresse und Herkunft einmal beim Laden festhalten (die alte Onboarding-Seite schreibt ihre Adresse danach um).
  const adresse = ohneParameter(location.href, true);
  const herkunft = document.referrer ? ohneParameter(document.referrer, false) : '';

  // Nutzlast je Anbieter. Umami: Seitenaufruf = Ereignis ohne Namen, Adresse als Pfad (nur utm_* im Query), Zusatzangaben als "data".
  function paket(name, props) {
    if (K.anbieter === 'umami') {
      const u = new URL(adresse);
      const nutzlast = { website: K.website, hostname: u.hostname, url: u.pathname + u.search, referrer: herkunft };
      if (name !== 'pageview') nutzlast.name = name;
      if (props) nutzlast.data = props;
      return { type: 'event', payload: nutzlast };
    }
    const daten = { name, url: adresse, domain: K.domain, referrer: herkunft };
    if (props) daten.props = props;
    return daten;
  }

  function senden(name, props) {
    if (!darf() || !window.fetch) return false;
    try {
      fetch(K.endpunkt, { method: 'POST', body: JSON.stringify(paket(name, props)), keepalive: true, credentials: 'omit', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
      return true;
    } catch (e) { return false; }
  }

  const seite = location.pathname;
  const thema = () => { const t = document.getElementById('contact-topic'); return t ? t.value : ''; };
  const TERMIN = /^https:\/\/calendar\.google\.com\/calendar\/(u\/\d+\/)?appointments\//;

  function klick(e) {
    const ziel = e.target instanceof Element ? e.target.closest('a[href], #copy-message') : null;
    if (!ziel) return;
    if (ziel.id === 'copy-message') return void senden('Nachricht kopiert', { thema: thema() });
    if (ziel.id === 'open-mail') return void senden('E-Mail-Programm geöffnet', { thema: thema() });
    const href = ziel.href || '';
    let pfad = '';
    try { const u = new URL(href); if (u.origin === location.origin) pfad = u.pathname; } catch (e) { /* kein gueltiger Link */ }
    if (TERMIN.test(href) || pfad === '/termin/' || pfad === '/termin') senden('Terminplan geöffnet', { von: seite });
    else if (href.indexOf('mailto:') === 0) senden('E-Mail-Link geklickt', { von: seite });
    else if (href.indexOf('tel:') === 0) senden('Telefon-Link geklickt', { von: seite });
    else if (/^https:\/\/([a-z]+\.)?linkedin\.com\//.test(href)) senden('LinkedIn geöffnet', { von: seite });
  }

  // Alte Onboarding-Seite (fertiges React-Paket): Zustand an der sichtbaren Kennzeile ablesen; Firmenname wird nie gesendet.
  function onboarding() {
    let geoeffnet = false, abgeschickt = false;
    const beobachter = new MutationObserver(pruefe);
    function pruefe() {
      document.querySelectorAll('main .kicker').forEach(el => {
        const t = el.textContent.trim();
        if (t === 'Vielen Dank' && !abgeschickt) { abgeschickt = true; senden('Onboarding abgeschickt'); return; }
        if (geoeffnet) return;
        // Zustand steckt im Ereignisnamen: Zusatzangaben zeigt Plausible erst im Business-Tarif.
        const name = t === 'Link nicht gültig' ? 'Onboarding-Link ungültig' : t === 'Persönlicher Link erforderlich' ? 'Onboarding ohne Link' : t.indexOf('Onboarding für ') === 0 ? 'Onboarding geöffnet' : null;
        if (name) { geoeffnet = true; senden(name); }
      });
      if (abgeschickt) beobachter.disconnect();
    }
    beobachter.observe(document.body, { childList: true, subtree: true, characterData: true });
    pruefe();
  }

  // Schalter auf /datenschutz/ (Widerspruch bzw. Einwilligung und Widerruf).
  function schalter() {
    const box = document.querySelector('[data-statistik-schalter]');
    if (!box) return () => {};
    const status = box.querySelector('[data-statistik-status]');
    const knopf = box.querySelector('button');
    function zeigen() {
      const wahl = lies();
      let text, label = '';
      if (K.modus === 'aus') text = 'Auf dieser Website ist derzeit keine Besucherstatistik eingeschaltet.';
      else if (K.modus === 'einwilligung') {
        text = wahl === 'ja' ? 'Sie haben der Besucherstatistik zugestimmt. Ihr Browser wird gezählt.' : 'Sie haben der Besucherstatistik nicht zugestimmt. Ihr Browser wird nicht gezählt.';
        label = wahl === 'ja' ? 'Einwilligung widerrufen' : 'Zählung erlauben';
      } else if (signal) text = 'Ihr Browser sendet ein Datenschutzsignal (Global Privacy Control oder Do Not Track). Er wird deshalb nicht gezählt.';
      else {
        text = wahl === 'nein' ? 'Sie haben widersprochen. Ihr Browser wird nicht gezählt.' : 'Ihr Browser wird derzeit anonym gezählt.';
        label = wahl === 'nein' ? 'Wieder zählen' : 'Nicht mehr zählen';
      }
      if (!aufSeite && K.modus !== 'aus') text += ' In dieser Vorschau wird ohnehin nichts gesendet.';
      status.textContent = text;
      knopf.hidden = !label;
      knopf.textContent = label;
    }
    knopf.addEventListener('click', () => {
      const wahl = lies();
      if (K.modus === 'einwilligung') {
        merke(wahl === 'ja' ? 'nein' : 'ja');
        if (wahl !== 'ja') senden('pageview');
        const hinweis = document.querySelector('.lca-hinweis');
        if (hinweis) hinweis.remove();
      } else merke(wahl === 'nein' ? '' : 'nein');
      zeigen();
    });
    box.hidden = false;
    zeigen();
    return zeigen;
  }

  // Hinweisbalken nur im Modus "einwilligung", solange keine Wahl vorliegt.
  function hinweis(aktualisieren) {
    if (K.modus !== 'einwilligung' || !aufSeite || lies()) return;
    const stil = document.createElement('style');
    // Genf: weißes Glas mit feiner Kante, Navy-Schrift, Knöpfe wie .knopf / .knopf-rahmen
    stil.textContent = '.lca-hinweis{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:80;width:min(100% - 2rem,44rem);display:flex;align-items:center;gap:1rem 1.5rem;padding:14px 14px 14px 22px;border:1px solid rgba(255,255,255,.9);border-radius:2px;background:rgba(255,255,255,.82);-webkit-backdrop-filter:blur(20px) saturate(1.15);backdrop-filter:blur(20px) saturate(1.15);box-shadow:0 0 0 1px rgba(0,48,83,.08),0 16px 44px rgba(0,34,60,.16);color:#0b2e42;font-size:.8rem;line-height:1.55}'
      + '.lca-hinweis p{margin:0;flex:1}.lca-hinweis a{color:#003053;text-decoration:underline;text-underline-offset:3px}.lca-hinweis div{display:flex;gap:6px;flex:none}'
      + '.lca-hinweis button{min-height:44px;padding:10px 18px;border:1px solid #003053;border-radius:2px;background:transparent;color:#003053;font:inherit;font-size:.66rem;font-weight:540;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;cursor:pointer}'
      + '.lca-hinweis button[data-wahl="ja"]{background:#003053;color:#fff}.lca-hinweis button:hover{background:#00223c;border-color:#00223c;color:#fff}.lca-hinweis button:focus-visible{outline:2px solid #003053;outline-offset:3px}'
      + '@media(max-width:600px){.lca-hinweis{flex-direction:column;align-items:stretch;padding:16px}.lca-hinweis div{justify-content:stretch}.lca-hinweis button{flex:1}}'
      + '@supports not (backdrop-filter:blur(1px)){.lca-hinweis{background:#fff}}';
    const el = document.createElement('div');
    el.className = 'lca-hinweis';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Besucherstatistik');
    el.innerHTML = '<p>Dürfen wir euren Besuch anonym zählen? Ohne Cookies, ' + K.dienst + '. <a href="/datenschutz/#statistik">Mehr dazu</a></p>'
      + '<div><button type="button" data-wahl="nein">Nicht zählen</button><button type="button" data-wahl="ja">Zählen erlauben</button></div>';
    el.addEventListener('click', e => {
      const b = e.target instanceof Element ? e.target.closest('button[data-wahl]') : null;
      if (!b) return;
      merke(b.getAttribute('data-wahl'));
      el.remove();
      if (b.getAttribute('data-wahl') === 'ja') senden('pageview');
      aktualisieren();
    });
    document.head.appendChild(stil);
    document.body.appendChild(el);
  }

  window.lcaStatistik = { ereignis: (name, props) => senden(String(name), props), zaehlt: darf };
  if (K.modus === 'aus') return;
  document.addEventListener('click', klick, true);
  document.addEventListener('auxclick', e => { if (e.button === 1) klick(e); }, true);
  document.addEventListener('submit', e => {
    if (!(e.target instanceof HTMLFormElement) || e.target.id !== 'contact-form') return;
    const vorschau = document.getElementById('message-preview');
    if (vorschau && !vorschau.hidden) senden('Nachricht vorbereitet', { thema: thema() });
  });
  const aktualisieren = schalter();
  hinweis(aktualisieren);
  senden('pageview');
  if (art === '404') senden('Seite nicht gefunden', { pfad: seite.slice(0, 300) });
  if (art === 'onboarding') onboarding();
})();
