// LCA – Entwurf Blau-Weiß 1 „Genf“. Wenig Skript: Kopfzeile, Menü, Bildöffnung beim Scrollen, Kapitelleiste, Kontaktformular.
(() => {
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)');

  // Als Datei geöffnet (file://): Seitenlinks ab der Wurzel auf die index.html-Dateien im Ordner umschreiben
  if (location.protocol === 'file:') {
    const wurzel = document.documentElement.dataset.wurzel || '';
    document.querySelectorAll('a[href^="/"]:not([href^="//"])').forEach(a => {
      const [, pfad, rest] = a.getAttribute('href').match(/^\/([^?#]*)(.*)$/);
      a.setAttribute('href', wurzel + (pfad === '' || pfad.endsWith('/') ? pfad + 'index.html' : pfad) + rest);
    });
  }
  const kopf = document.getElementById('kopf');
  const begrenze = v => Math.min(1, Math.max(0, v));

  // Kopfzeile: über dem Vollbild durchsichtig, danach weißes Glas mit dunkler Schrift
  const buehne = document.querySelector('.auftakt, .seitenkopf');
  const kopfStand = () => {
    if (!kopf) return;
    const grenze = buehne ? buehne.getBoundingClientRect().bottom - kopf.offsetHeight : -1;
    kopf.classList.toggle('gerollt', grenze <= 0);
  };
  kopfStand();
  addEventListener('scroll', kopfStand, { passive: true });
  addEventListener('resize', kopfStand);

  // Menü auf schmalen Bildschirmen
  const knopf = document.querySelector('.menue-knopf');
  if (knopf && kopf) {
    const wort = knopf.querySelector('.menue-wort');
    const setze = offen => {
      kopf.classList.toggle('offen', offen);
      knopf.setAttribute('aria-expanded', String(offen));
      if (wort) wort.textContent = offen ? 'Schließen' : 'Menü';
      document.documentElement.style.overflow = offen ? 'hidden' : '';
    };
    knopf.addEventListener('click', () => setze(knopf.getAttribute('aria-expanded') !== 'true'));
    addEventListener('keydown', ev => { if (ev.key === 'Escape' && kopf.classList.contains('offen')) { setze(false); knopf.focus(); } });
    document.querySelectorAll('.hauptnav a').forEach(a => a.addEventListener('click', () => setze(false)));
    matchMedia('(min-width: 901px)').addEventListener('change', m => { if (m.matches) setze(false); });
  }

  // Bildöffnung: Jedes große Bild beginnt als Rahmen und öffnet sich mit dem Scrollen.
  const bilder = [...document.querySelectorAll('[data-oeffnen]')];
  const sichtbar = new Set();
  let geplant = false;
  function zeichne() {
    geplant = false;
    const vh = innerHeight;
    sichtbar.forEach(el => {
      const r = el.getBoundingClientRect();
      const art = el.dataset.oeffnen;
      if (art === 'geschosse') {
        // Erst wachsen die Geschosse (in vier Stufen), danach wird der Bau breiter.
        const t = begrenze((vh - r.top) / (vh * 0.95));
        const a = t <= 0 ? 0 : Math.min(1, (Math.floor(Math.min(t / 0.6, 0.999) * 4) + 1) / 4);
        el.style.setProperty('--a', a.toFixed(3));
        el.style.setProperty('--b', begrenze((t - 0.62) / 0.3).toFixed(3));
        return;
      }
      const spanne = art === 'weg' ? 0.85 : 0.72;
      const v = begrenze((vh - r.top) / (vh * spanne));
      el.style.setProperty('--r', (1 - Math.pow(1 - v, 2.2)).toFixed(4));
    });
  }
  const plane = () => { if (!geplant) { geplant = true; requestAnimationFrame(zeichne); } };
  const offen = el => { el.style.setProperty('--r', '1'); el.style.setProperty('--a', '1'); el.style.setProperty('--b', '1'); };
  if (!ruhig.matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('oeffnen-bereit');
    const io = new IntersectionObserver(eintraege => {
      eintraege.forEach(en => (en.isIntersecting ? sichtbar.add(en.target) : sichtbar.delete(en.target)));
      plane();
    }, { rootMargin: '10% 0px 10% 0px' });
    bilder.forEach(el => io.observe(el));
    addEventListener('scroll', plane, { passive: true });
    addEventListener('scrollend', plane);
    addEventListener('resize', plane);
    // Bilder oberhalb des Sichtbereichs (z. B. nach einem Sprung auf einen Anker) gelten als geöffnet
    const oberhalb = () => bilder.forEach(el => { if (el.getBoundingClientRect().bottom < 0) offen(el); });
    oberhalb();
    addEventListener('hashchange', () => setTimeout(oberhalb, 60));
  } else {
    bilder.forEach(offen);
  }

  // Kapitelleiste: markiert das Kapitel, das gerade in der Mitte des Bildschirms steht
  const nav = document.getElementById('kapitelnav');
  if (nav && 'IntersectionObserver' in window) {
    const links = [...nav.querySelectorAll('a')];
    const markiere = n => links.forEach(a => {
      if (a.dataset.ziel === n) {
        a.setAttribute('aria-current', 'true');
        const box = a.parentElement;
        if (box.scrollWidth > box.clientWidth) box.scrollTo({ left: a.offsetLeft - 20, behavior: ruhig.matches ? 'auto' : 'smooth' });
      } else a.removeAttribute('aria-current');
    });
    const beobachter = new IntersectionObserver(en => en.forEach(e => { if (e.isIntersecting) markiere(e.target.dataset.kapitel); }), { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('[data-kapitel]').forEach(k => beobachter.observe(k));
  }

  // Kontaktformular: bereitet nur eine E-Mail an info@lcainfo.de vor, überträgt nichts
  const form = document.getElementById('contact-form');
  if (form) {
    form.hidden = false;
    form.noValidate = true;
    const vorschau = document.getElementById('message-preview');
    const nachricht = document.getElementById('prepared-message');
    const mail = document.getElementById('open-mail');
    const status = document.getElementById('form-status');
    const name = form.elements.namedItem('name');
    const thema = form.elements.namedItem('topic');
    const text = form.elements.namedItem('message');
    const gewaehlt = new URLSearchParams(location.search).get('thema');
    if ([...thema.options].some(o => o.value === gewaehlt)) thema.value = gewaehlt;
    const pflicht = [name, text];
    const fehler = { name: 'Bitte gebt euren Namen an.', message: 'Bitte beschreibt kurz, was ihr verändern möchtet.' };
    pflicht.forEach(f => f.addEventListener('input', () => { f.removeAttribute('aria-invalid'); document.getElementById(f.id + '-error').textContent = ''; }));
    form.addEventListener('input', () => { vorschau.hidden = true; status.textContent = ''; });
    const verlinke = () => { mail.href = 'mailto:info@lcainfo.de?subject=' + encodeURIComponent('Gesprächsanfrage: ' + thema.value) + '&body=' + encodeURIComponent(nachricht.value); };
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      let erster;
      pflicht.forEach(f => {
        const leer = !f.value.trim();
        f.setAttribute('aria-invalid', String(leer));
        document.getElementById(f.id + '-error').textContent = leer ? fehler[f.name] : '';
        if (leer && !erster) erster = f;
      });
      if (erster) { erster.focus(); return; }
      const firma = form.elements.namedItem('company').value.trim();
      nachricht.value = `Hallo Benjamin,\n\nich möchte mit euch sprechen. Thema: ${thema.value}.\n\n${text.value.trim()}\n\n${firma ? 'Unternehmen: ' + firma + '\n\n' : ''}Viele Grüße\n${name.value.trim()}`;
      verlinke();
      vorschau.hidden = false;
      document.getElementById('preview-title').focus();
      vorschau.scrollIntoView({ block: 'start', behavior: ruhig.matches ? 'auto' : 'smooth' });
      status.textContent = 'Eure Nachricht ist vorbereitet. Sie wurde noch nicht versendet.';
    });
    nachricht.addEventListener('input', verlinke);
    document.getElementById('copy-message').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(nachricht.value);
        status.textContent = 'Nachricht kopiert. Ihr könnt sie in eine E-Mail an info@lcainfo.de einfügen.';
      } catch {
        nachricht.focus(); nachricht.select();
        status.textContent = 'Automatisches Kopieren ist hier nicht möglich. Der Text ist markiert; kopiert ihn mit Strg+C oder ⌘C.';
      }
    });
  }
})();

/* Karriere: Aufruf mit Anker (#sales-development-representative) klappt die Stelle auf */
(function () {
  function oeffne() {
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS' && !el.open) { el.open = true; el.scrollIntoView({ block: 'start' }); }
  }
  oeffne();
  window.addEventListener('hashchange', oeffne);
})();
