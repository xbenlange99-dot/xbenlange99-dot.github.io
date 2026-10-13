// A small displacement of the daylight follows native scrolling; nothing runs at idle.
const light = document.querySelector('.study-light');
const quiet = matchMedia('(prefers-reduced-motion: reduce)');
let lightFrame = 0;
function updateLight() {
  lightFrame = 0;
  if (!light || quiet.matches || window.innerWidth <= 820) return;
  light.style.setProperty('--light-shift', String(Math.min(80, window.scrollY * .035)));
}
window.addEventListener('scroll', () => {
  if (!lightFrame && !quiet.matches) lightFrame = requestAnimationFrame(updateLight);
}, {passive:true});
quiet.addEventListener('change', () => { if (quiet.matches) light?.style.removeProperty('--light-shift'); else updateLight(); });
const picker = document.querySelector('.design-picker');
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && picker?.open) { picker.open = false; picker.querySelector('summary').focus(); }
});
document.addEventListener('click', event => { if (picker?.open && !picker.contains(event.target)) picker.open = false; });
// Preserve the visible section when comparing the same page in another direction.
picker?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  if (link.getAttribute('href').includes('atmosphaere.html')) return;
  const sections = [...document.querySelectorAll('main section[id],main article[id]')];
  const current = sections.filter(el => el.getBoundingClientRect().top <= innerHeight * .45 && el.getBoundingClientRect().bottom > 100).at(-1);
  const story = document.querySelector('.scroll-story');
  const chapter = story?.getBoundingClientRect().bottom > innerHeight ? story.dataset.chapter : null;
  const anchor = current?.id || chapter;
  if (anchor && !(link.getAttribute('href').includes('version-gesichert') && ['haltung','fragen','gespraech'].includes(anchor))) link.hash = anchor;
}));
