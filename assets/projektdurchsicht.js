// LCA – Entwurf Blau-Weiß 1 „Genf“: Formular der Seite /projektdurchsicht/.
// Quelle: quelle/projektdurchsicht.js. Der Bau kopiert die Datei nach assets/ und bindet sie nur auf /projektdurchsicht/ ein,
// und nur bei CTA_PROJEKTDURCHSICHT = an; bei „aus“ entfernt er sie aus assets/.
(() => {
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)');
  // Projektdurchsicht: bereitet wie das Kontaktformular nur eine E-Mail an info@lcainfo.de vor, überträgt nichts.
  // Zeilenumbrüche gehen als CRLF (%0D%0A) in die mailto-Adresse (RFC 6068), Umlaute als UTF-8.
  const pd = document.getElementById('durchsicht-form');
  if (pd) {
    pd.hidden = false;
    pd.noValidate = true;
    const $ = id => document.getElementById(id);
    const vorschau = $('durchsicht-vorschau'), nachricht = $('durchsicht-nachricht'), mail = $('durchsicht-mail');
    const status = $('durchsicht-status'), danke = $('durchsicht-danke');
    const wer = pd.elements.namedItem('wer'), projekte = pd.elements.namedItem('projekte'), woher = pd.elements.namedItem('woher');
    const fehler = { wer: 'Bitte gebt Name und Firma an.', projekte: 'Bitte nennt eure letzten Projekte in Stichworten.' };
    const pflicht = [wer, projekte];
    pflicht.forEach(f => f.addEventListener('input', () => { f.removeAttribute('aria-invalid'); $(f.id + '-error').textContent = ''; }));
    pd.addEventListener('input', () => { vorschau.hidden = true; danke.hidden = true; status.textContent = ''; });
    const crlf = s => s.replace(/\r?\n/g, '\r\n');
    const verlinke = () => {
      mail.href = 'mailto:info@lcainfo.de?subject=' + encodeURIComponent('Projektdurchsicht ' + wer.value.trim().replace(/\s+/g, ' ')) +
        '&body=' + encodeURIComponent(crlf(nachricht.value));
    };
    pd.addEventListener('submit', ev => {
      ev.preventDefault();
      let erster;
      pflicht.forEach(f => {
        const leer = !f.value.trim();
        f.setAttribute('aria-invalid', String(leer));
        $(f.id + '-error').textContent = leer ? fehler[f.name] : '';
        if (leer && !erster) erster = f;
      });
      if (erster) { erster.focus(); return; }
      const w = woher.value.trim();
      nachricht.value = `Hallo Benjamin,\n\nwir möchten eine Projektdurchsicht anfragen.\n\nName und Firma: ${wer.value.trim()}\n\nUnsere letzten Projekte:\n${projekte.value.trim()}\n\n${w ? 'Woher wir euch kennen: ' + w + '\n\n' : ''}Viele Grüße\n${wer.value.trim()}`;
      verlinke();
      vorschau.hidden = false;
      danke.hidden = true;
      $('pd-vorschau-titel').focus();
      vorschau.scrollIntoView({ block: 'start', behavior: ruhig.matches ? 'auto' : 'smooth' });
      status.textContent = 'Eure Nachricht ist vorbereitet. Sie wurde noch nicht versendet.';
    });
    nachricht.addEventListener('input', verlinke);
    // Die Bestätigung erscheint erst nach dem Klick auf „E-Mail-Programm öffnen“, nicht schon beim Vorbereiten und nicht beim Kopieren.
    mail.addEventListener('click', () => { danke.hidden = false; status.textContent = ''; });
    $('durchsicht-kopieren').addEventListener('click', async () => {
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
