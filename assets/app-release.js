document.documentElement.classList.add('js');
const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('#main-nav');
const header = document.querySelector('.site-header');
function closeMenu(returnFocus = false) {
  if (!menuButton || !nav) return;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.querySelector('.menu-label').textContent = 'Menü';
  nav.classList.remove('open');
  document.body.classList.remove('menu-open');
  document.querySelector('main')?.removeAttribute('inert');
  document.querySelector('footer')?.removeAttribute('inert');
  if (returnFocus) menuButton.focus();
}
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.querySelector('.menu-label').textContent = open ? 'Schließen' : 'Menü';
  nav.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
  document.querySelector('main')?.toggleAttribute('inert', open);
  document.querySelector('footer')?.toggleAttribute('inert', open);
});
nav?.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', e => {
  if (menuButton?.getAttribute('aria-expanded') !== 'true') return;
  if (e.key === 'Escape') closeMenu(true);
  if (e.key === 'Tab') {
    const items = [menuButton, ...nav.querySelectorAll('a')];
    const first = items[0], last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
window.addEventListener('resize', () => { if (window.innerWidth > 820) closeMenu(); }, { passive: true });
function updateHeader() { header?.classList.toggle('scrolled', window.scrollY > 10); }
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

const tabList = document.querySelector('.architecture-tabs');
if (tabList) {
  const tabs = [...tabList.querySelectorAll('button')];
  // Progressive enhancement: without JavaScript all three explanations remain visible.
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-orientation', 'vertical');
  function activateTab(tab, focus = false) {
    tabs.forEach(t => {
      const active = t === tab;
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      panel.setAttribute('role', 'tabpanel');
      panel.hidden = !active;
    });
    if (focus) tab.focus();
  }
  activateTab(tabs[0]);
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', e => {
      let next;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { e.preventDefault(); activateTab(tabs[next], true); }
    });
  });
}

const form = document.querySelector('#contact-form');
if (form) {
  form.hidden = false;
  form.noValidate = true;
  const preview = document.querySelector('#message-preview');
  const message = document.querySelector('#prepared-message');
  const openMail = document.querySelector('#open-mail');
  const status = document.querySelector('#form-status');
  const name = form.elements.namedItem('name');
  const topic = form.elements.namedItem('topic');
  const selectedTopic = new URLSearchParams(window.location.search).get('thema');
  if ([...topic.options].some(o => o.value === selectedTopic)) topic.value = selectedTopic;
  const required = [name, form.elements.namedItem('message')];
  const errors = { name: 'Bitte gebt euren Namen an.', message: 'Bitte beschreibt kurz, was ihr verändern möchtet.' };
  required.forEach(field => field.addEventListener('input', () => {
    field.removeAttribute('aria-invalid');
    document.querySelector(`#${field.id}-error`).textContent = '';
  }));
  form.addEventListener('input', () => { preview.hidden = true; status.textContent = ''; });
  function mailHref() {
    const subject = 'Gesprächsanfrage: ' + topic.value;
    openMail.href = `mailto:info@lcainfo.de?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message.value)}`;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    let firstError;
    required.forEach(field => {
      const invalid = !field.value.trim();
      field.setAttribute('aria-invalid', String(invalid));
      document.querySelector(`#${field.id}-error`).textContent = invalid ? errors[field.name] : '';
      if (invalid && !firstError) firstError = field;
    });
    if (firstError) { firstError.focus(); return; }
    const company = form.elements.namedItem('company').value.trim();
    const topicInSentence = topic.value.charAt(0).toLowerCase() + topic.value.slice(1);
    message.value = `Hallo Benjamin,\n\nich möchte mit euch sprechen. Thema: ${topic.value}.\n\n${form.elements.namedItem('message').value.trim()}\n\n${company ? 'Unternehmen: ' + company + '\n\n' : ''}Viele Grüße\n${name.value.trim()}`;
    mailHref();
    preview.hidden = false;
    document.querySelector('#preview-title').focus();
    preview.scrollIntoView({ block: 'start' });
    status.textContent = 'Eure Nachricht ist vorbereitet. Sie wurde noch nicht versendet.';
  });
  message.addEventListener('input', mailHref);
  document.querySelector('#copy-message').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(message.value);
      status.textContent = 'Nachricht kopiert. Ihr könnt sie in eine E-Mail an info@lcainfo.de einfügen.';
    } catch {
      message.focus(); message.select();
      status.textContent = 'Automatisches Kopieren ist hier nicht möglich. Der Text ist markiert; kopiert ihn mit Strg+C oder ⌘C.';
    }
  });
}

// Marketing motion: reveal each content group once; keep all reading and controls usable.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const revealElements = [...document.querySelectorAll('.section-heading, .section-intro, .situation, .work-item, .founder-text, .portrait, .faq-intro, .longform-row, .closing .wrap')];
if (!motionPreference.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: .08, rootMargin: '0px 0px -30px 0px' });
  revealElements.forEach((el, i) => {
    // Content already in view must never flash out after the script loads.
    if (el.getBoundingClientRect().top >= innerHeight - 10) {
      el.classList.add('reveal-ready');
      if (el.matches('.work-item, .situation')) el.style.transitionDelay = `${(i % 3) * 70}ms`;
      observer.observe(el);
    }
  });
  motionPreference.addEventListener('change', e => {
    if (e.matches) { observer.disconnect(); revealElements.forEach(el => el.classList.add('is-visible')); }
  });
  document.addEventListener('focusin', e => e.target.closest('.reveal-ready')?.classList.add('is-visible'));
}
document.querySelectorAll('.architecture-tab').forEach(tab => tab.addEventListener('click', () => {
  if (motionPreference.matches) return;
  const panel = document.getElementById(tab.getAttribute('aria-controls'));
  panel?.animate([{ opacity: .25, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 340, easing: 'cubic-bezier(.23,1,.32,1)' });
}));
document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', () => {
  if (detail.open && !motionPreference.matches) detail.querySelector('p')?.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'cubic-bezier(.23,1,.32,1)' });
}));
const story = document.querySelector('.scroll-story');
if (story) {
  import('./cinematic-story.js').then(module => module.mountArchitecture(story)).catch(error => {
    story.classList.remove('story-enhanced'); story.dataset.scene = 'fallback';
    story.querySelector('.story-ui').hidden = true;
    story.querySelector('.story-mode').hidden = true;
    console.warn('Die Architecture wird als lesbare Seite dargestellt.', error);
  });
}
