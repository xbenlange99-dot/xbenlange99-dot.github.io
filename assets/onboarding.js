/* Onboarding-Fragebogen /onboarding/ (Texte: Webseite/Onboarding-Fragebogen.md, Bau: quelle/build.py).
   Übernommen aus Websiteentwurf/src/onboarding.js (geprüft 21.10.2026); für Genf nur Kopfzeile (#kopf) und Rahmen-Knopf (knopf-rahmen) angepasst.
   Keine Datenbank, keine Anfragen: Antworten bleiben im Browser (localStorage, Schluessel SPEICHER), bis abgeschickt oder geloescht.
   Abschicken = Nachricht an info@lcainfo.de im eigenen E-Mail-Programm, Kopieren oder Textdatei.
   Besucherstatistik (falls eingeschaltet): nur "Onboarding geoeffnet" und "Onboarding abgeschickt", ohne Inhalte oder Parameter. */
(() => {
  'use strict';
  const SPEICHER = 'lca-onboarding-v2';
  const AN = 'info@lcainfo.de';
  const form = document.getElementById('onboarding-form');
  if (!form) return;
  document.documentElement.classList.add('ob-js');

  const schritte = [...form.querySelectorAll('.ob-step')];
  const letzter = schritte.length; // letzter Schritt = Abschicken
  const sendSeite = document.getElementById('abschicken');
  const danke = document.getElementById('danke');
  const vorschau = document.getElementById('ob-nachricht');
  const status = document.getElementById('ob-status');
  const dankeStatus = document.getElementById('ob-danke-status');
  const fortschrittText = document.getElementById('ob-progress-text');
  const leiste = document.querySelector('.ob-bar');
  const punkte = [...document.querySelectorAll('.ob-steps a')];
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)');
  const kopfhoehe = () => { const k = document.getElementById('kopf'); return k ? Math.max(0, k.getBoundingClientRect().bottom) + 8 : 0; };
  let aktuell = 1;
  let gesendet = false;

  function statistik(name) { try { if (window.lcaStatistik) window.lcaStatistik.ereignis(name); } catch (e) { /* Statistik ist Nebensache */ } }

  // ---------------------------------------------------------------- Firma aus ?firma= (nur Anzeige und Vorbelegung; ?c= wird ignoriert)
  const firmaParam = (() => {
    try { return (new URLSearchParams(location.search).get('firma') || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120); } catch (e) { return ''; }
  })();
  const gruss = document.getElementById('ob-gruss');
  if (firmaParam && gruss && gruss.dataset.firma) {
    const [vor, nach] = gruss.dataset.firma.split('{Firma}');
    gruss.textContent = vor + firmaParam + (nach || '');
  }

  // ---------------------------------------------------------------- Zwischenspeicher
  function felder() { return [...form.querySelectorAll('input[name], textarea[name]')].filter(el => el.id !== 'ob-nachricht'); }
  function lesen() {
    try { const d = JSON.parse(localStorage.getItem(SPEICHER) || 'null'); return d && typeof d === 'object' && d.felder ? d : null; } catch (e) { return null; }
  }
  function werte() {
    const w = {};
    felder().forEach(el => {
      if (el.type === 'radio') { if (el.checked) w[el.name] = el.value; }
      else if (el.value.trim()) w[el.name] = el.value;
    });
    return w;
  }
  let speichernTimer = 0;
  function speichern() {
    clearTimeout(speichernTimer);
    speichernTimer = 0;
    const w = werte();
    try {
      if (Object.keys(w).length) localStorage.setItem(SPEICHER, JSON.stringify({ felder: w, schritt: aktuell, stand: new Date().toISOString() }));
      else localStorage.removeItem(SPEICHER);
    } catch (e) { /* Speicher gesperrt: Eingaben gelten nur bis zum Schliessen der Seite */ }
  }
  function spaeterSpeichern() { clearTimeout(speichernTimer); speichernTimer = setTimeout(speichern, 300); }
  function wiederherstellen(d) {
    felder().forEach(el => {
      const v = d.felder[el.name];
      if (typeof v !== 'string') return;
      if (el.type === 'radio') el.checked = el.value === v; else el.value = v;
    });
  }
  const gespeichert = lesen();
  if (gespeichert) wiederherstellen(gespeichert);
  const unternehmen = form.querySelector('#s1-1');
  if (firmaParam && unternehmen && !unternehmen.value.trim()) unternehmen.value = firmaParam;

  form.addEventListener('input', () => { markieren(); spaeterSpeichern(); });
  form.addEventListener('change', () => { markieren(); spaeterSpeichern(); });
  addEventListener('pagehide', () => { if (speichernTimer) speichern(); });
  form.addEventListener('submit', e => e.preventDefault());

  // ---------------------------------------------------------------- Schritte
  function markieren() {
    const w = werte();
    punkte.forEach(a => {
      const n = Number(a.dataset.ziel);
      const s = schritte[n - 1];
      const voll = n < letzter && [...s.querySelectorAll('[name]')].some(el => w[el.name]);
      a.classList.toggle('is-filled', voll);
    });
  }
  function zeigen(n, fokus) {
    aktuell = Math.min(Math.max(1, n), letzter);
    schritte.forEach((s, i) => s.classList.toggle('is-current', i + 1 === aktuell));
    punkte.forEach(a => { if (Number(a.dataset.ziel) === aktuell) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
    const n6 = letzter - 1;
    fortschrittText.textContent = aktuell === letzter ? 'Alle Schritte bearbeitet' : `Schritt ${aktuell} von ${n6}`;
    leiste.style.setProperty('--ob-anteil', `${Math.round(((aktuell - 1) / n6) * 100)}%`);
    if (aktuell === letzter) vorbereiten();
    if (fokus) {
      const ziel = matchMedia('(max-width: 820px)').matches ? document.querySelector('.ob-layout') : schritte[aktuell - 1];
      if (ziel.getBoundingClientRect().top < kopfhoehe()) ziel.scrollIntoView({ block: 'start', behavior: ruhig.matches ? 'auto' : 'smooth' });
      const h = schritte[aktuell - 1].querySelector('h2');
      if (h) h.focus({ preventScroll: true });
    }
    spaeterSpeichern();
  }
  form.addEventListener('click', e => {
    const b = e.target instanceof Element ? e.target.closest('[data-weiter], [data-zurueck]') : null;
    if (!b) return;
    zeigen(aktuell + (b.hasAttribute('data-weiter') ? 1 : -1), true);
  });
  punkte.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    if (!danke.hidden) dankeAus();
    zeigen(Number(a.dataset.ziel), true);
  }));

  // ---------------------------------------------------------------- Nachricht
  function firma() { return (unternehmen && unternehmen.value.trim()) || firmaParam; }
  function betreff() {
    const f = firma().replace(/\s+/g, ' ');
    return f ? sendSeite.dataset.betreffFirma.replace('{Firma}', () => f) : sendSeite.dataset.betreff;
  }
  function frage(feld) {
    const l = feld.matches('fieldset') ? feld.querySelector('legend') : feld.querySelector('label');
    const t = l ? l.textContent.trim() : '';
    return /[?.:]$/.test(t) ? t : t + ':';
  }
  function nachricht() {
    const w = werte();
    const bloecke = [];
    schritte.slice(0, letzter - 1).forEach(s => {
      const teile = [];
      s.querySelectorAll('[data-feld]').forEach(feld => {
        const v = w[feld.dataset.feld];
        if (v && v.trim()) teile.push(frage(feld) + '\n' + v.trim());
      });
      if (!teile.length) return;
      const kopf = `${s.dataset.schritt} · ${s.dataset.name}`;
      bloecke.push(kopf + '\n' + '='.repeat(kopf.length) + '\n\n' + teile.join('\n\n'));
    });
    return bloecke.join('\n\n\n');
  }
  const MAILTO_GRENZE = 1800; // laengere mailto-Links schneiden manche E-Mail-Programme ab
  const kleinHinweis = sendSeite.querySelector('.ob-small');
  const [kMail, kKopie, kDatei] = ['ob-mail', 'ob-kopieren', 'ob-datei'].map(id => document.getElementById(id));
  function vorbereiten() {
    vorschau.value = nachricht();
    const lang = !!vorschau.value && mailto().length > MAILTO_GRENZE;
    // Lange Nachricht: Hinweis hervorheben, Kopieren/Datei als empfohlener Weg zuerst; der Mail-Knopf bleibt nutzbar.
    kleinHinweis.classList.toggle('is-wichtig', lang);
    kMail.classList.toggle('knopf-rahmen', lang);
    kKopie.classList.toggle('knopf-rahmen', !lang);
    kDatei.classList.toggle('knopf-rahmen', !lang);
    if (lang) kMail.parentNode.append(kMail); else kMail.parentNode.prepend(kMail);
    status.textContent = vorschau.value ? (lang ? 'Eure Antworten sind lang. Kopiert sie oder speichert sie als Datei, damit nichts abgeschnitten wird.' : '') : 'Es sind noch keine Antworten ausgefüllt.';
  }
  function mailto() {
    const body = nachricht().replace(/\r?\n/g, '\r\n');
    return `mailto:${AN}?subject=${encodeURIComponent(betreff())}&body=${encodeURIComponent(body)}`;
  }
  function dateiname() {
    const f = firma().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return f ? `LCA-Onboarding-${f}.txt` : 'LCA-Onboarding.txt';
  }

  async function kopieren(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* Rueckfall unten */ }
    try {
      vorschau.focus(); vorschau.select();
      const ok = document.execCommand('copy');
      vorschau.setSelectionRange(0, 0);
      return ok;
    } catch (e) { return false; }
  }

  function abgeschickt(meldung, behalten) {
    if (!gesendet) { gesendet = true; statistik('Onboarding abgeschickt'); }
    if (!behalten) { // Kopieren/Datei: Antworten sind beim Kunden, Zwischenstand wird geloescht
      if (speichernTimer) clearTimeout(speichernTimer), speichernTimer = 0;
      try { localStorage.removeItem(SPEICHER); } catch (e) { /* nichts gespeichert */ }
    }
    dankeStatus.textContent = meldung;
    dankeLoeschen.hidden = false;
    dankeRueckfrage.hidden = true;
    form.hidden = true;
    danke.hidden = false;
    punkte.forEach(a => a.removeAttribute('aria-current'));
    punkte[punkte.length - 1].setAttribute('aria-current', 'step');
    leiste.style.setProperty('--ob-anteil', '100%');
    fortschrittText.textContent = 'Abgeschickt';
    const ziel = matchMedia('(max-width: 820px)').matches ? document.querySelector('.ob-layout') : danke;
    if (ziel.getBoundingClientRect().top < kopfhoehe()) ziel.scrollIntoView({ block: 'start', behavior: ruhig.matches ? 'auto' : 'smooth' });
    danke.querySelector('h2').focus({ preventScroll: true });
  }
  function dankeAus() {
    danke.hidden = true;
    form.hidden = false;
    speichern(); // Antworten sind wieder in Bearbeitung: Zwischenstand erneut sichern
  }

  document.getElementById('ob-mail').addEventListener('click', e => {
    if (!nachricht()) { status.textContent = 'Es sind noch keine Antworten ausgefüllt.'; return; }
    const url = mailto();
    e.currentTarget.setAttribute('data-mailto', url);
    location.href = url;
    // Ob sich das E-Mail-Programm oeffnet, sieht die Seite nicht: Zwischenstand bleibt erhalten.
    abgeschickt(`Euer E-Mail-Programm öffnet eine Nachricht an ${AN}. Öffnet es sich nicht, kopiert eure Antworten oder speichert sie als Datei. Eure Eingaben bleiben in diesem Browser gespeichert, bis ihr sie löscht.`, true);
  });
  document.getElementById('ob-kopieren').addEventListener('click', async () => {
    const text = nachricht();
    if (!text) { status.textContent = 'Es sind noch keine Antworten ausgefüllt.'; return; }
    if (await kopieren(text)) abgeschickt(`Eure Antworten sind kopiert. Fügt sie in eine E-Mail an ${AN} ein.`);
    else { status.textContent = 'Kopieren hat nicht geklappt. Markiert den Text in der Vorschau und kopiert ihn mit Strg+C oder ⌘C.'; vorschau.focus(); vorschau.select(); }
  });
  document.getElementById('ob-datei').addEventListener('click', () => {
    if (!nachricht()) { status.textContent = 'Es sind noch keine Antworten ausgefüllt.'; return; }
    const text = `An: ${AN}\nBetreff: ${betreff()}\n\n${nachricht()}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = dateiname(); a.hidden = true;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    abgeschickt(`Eure Antworten sind als Datei „${a.download}“ gespeichert. Schickt sie an ${AN}.`);
  });
  // Eingaben loeschen auch in der Danke-Ansicht (mit Rueckfrage)
  const dankeLoeschen = document.getElementById('ob-danke-loeschen');
  const dankeRueckfrage = document.getElementById('ob-danke-rueckfrage');
  dankeLoeschen.addEventListener('click', () => { dankeRueckfrage.hidden = !dankeRueckfrage.hidden; dankeLoeschen.setAttribute('aria-expanded', String(!dankeRueckfrage.hidden)); if (!dankeRueckfrage.hidden) document.getElementById('ob-danke-nein').focus(); });
  document.getElementById('ob-danke-nein').addEventListener('click', () => { dankeRueckfrage.hidden = true; dankeLoeschen.setAttribute('aria-expanded', 'false'); dankeLoeschen.focus(); });
  dankeRueckfrage.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('ob-danke-nein').click(); });
  document.getElementById('ob-danke-ja').addEventListener('click', () => {
    alleLoeschen();
    dankeRueckfrage.hidden = true;
    dankeLoeschen.hidden = true;
    dankeLoeschen.setAttribute('aria-expanded', 'false');
    dankeStatus.textContent = 'Eure Eingaben sind gelöscht.';
    danke.querySelector('h2').focus({ preventScroll: true });
  });
  document.getElementById('ob-zurueck-antworten').addEventListener('click', () => { dankeAus(); zeigen(letzter, true); });

  // ---------------------------------------------------------------- Eingaben loeschen (mit Rueckfrage)
  const loeschen = document.getElementById('ob-loeschen');
  const rueckfrage = document.getElementById('ob-rueckfrage');
  function rueckfrageZeigen(an) {
    rueckfrage.hidden = !an;
    loeschen.setAttribute('aria-expanded', String(an));
    if (an) document.getElementById('ob-loeschen-nein').focus(); else loeschen.focus();
  }
  loeschen.addEventListener('click', () => rueckfrageZeigen(rueckfrage.hidden));
  document.getElementById('ob-loeschen-nein').addEventListener('click', () => rueckfrageZeigen(false));
  rueckfrage.addEventListener('keydown', e => { if (e.key === 'Escape') rueckfrageZeigen(false); });
  function alleLoeschen() {
    clearTimeout(speichernTimer); speichernTimer = 0;
    form.reset();
    try { localStorage.removeItem(SPEICHER); } catch (e) { /* nichts gespeichert */ }
    if (firmaParam && unternehmen) unternehmen.value = firmaParam;
    markieren();
  }
  document.getElementById('ob-loeschen-ja').addEventListener('click', () => {
    alleLoeschen();
    rueckfrage.hidden = true;
    loeschen.setAttribute('aria-expanded', 'false');
    markieren();
    zeigen(1, true);
    clearTimeout(speichernTimer); speichernTimer = 0; // nach dem Loeschen nichts neu anlegen
    status.textContent = '';
  });

  // ---------------------------------------------------------------- Start
  markieren();
  aktuell = gespeichert && Number(gespeichert.schritt) >= 1 ? Number(gespeichert.schritt) : 1;
  schritte.forEach((s, i) => s.classList.toggle('is-current', i + 1 === aktuell));
  zeigen(aktuell, false);
  clearTimeout(speichernTimer); speichernTimer = 0; // Laden allein speichert nichts
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => statistik('Onboarding geöffnet'), { once: true });
  else statistik('Onboarding geöffnet');
})();
