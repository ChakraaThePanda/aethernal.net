// Browser behaviour for the character cards (ModernCharacter.astro, and the Aethernal cards built
// the same way on /wow): name fitting, faces kept clear of the text, and the section drawers.
// Importing this from a page's script sets it all up once; call fitNames() / holdButtons() again
// after adding cards to the page.

// Character names stay on one line. They share one size, the one that fits the longest name
// (from 1.35rem), but that shared size doesn't go below 1.2rem; a name too long even for that
// shrinks on its own, down to 13px. Re-run whenever a name's box changes size: first layout,
// window resizes, cards shown or hidden by the filters.
const SHARED_MIN = 1.2 * parseFloat(getComputedStyle(document.documentElement).fontSize);
// scrollWidth/clientWidth are rounded to whole pixels, which misses text that's a fraction of a
// pixel too wide (it still gets an ellipsis), so compare the text's exact width to the box's.
const range = document.createRange();
const overflows = (el: HTMLElement) => {
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width > el.getBoundingClientRect().width;
};
const fitsAt = (el: HTMLElement, floor: number) => {
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (overflows(el) && size - 0.5 >= floor) {
    size -= 0.5;
    el.style.fontSize = `${size}px`;
  }
  return size;
};
const fitAll = () => {
  const names = [...document.querySelectorAll<HTMLElement>('.char .cname')];
  names.forEach((el) => { el.style.fontSize = ''; });
  // Hidden names (filtered out) have no width to measure; they're fitted when they show again.
  const visible = names.filter((el) => el.clientWidth);
  if (!visible.length) return;
  const shared = `${Math.min(...visible.map((el) => fitsAt(el, SHARED_MIN)))}px`;
  names.forEach((el) => { el.style.fontSize = shared; });
  visible.forEach((el) => fitsAt(el, 13));
  clearFaces();
  holdButtons();
};

// Section buttons sit at the bottom of each card so they line up across a row. Opening a drawer makes its
// row taller, which would slide the other cards' buttons down with it. So while a drawer is open in a
// grid, every card's buttons are pinned where they sit with all drawers closed. Re-run after a drawer
// opens or closes and whenever the cards change size (via fitAll).
export function holdButtons() {
  document.querySelectorAll('.chars').forEach((grid) => {
    const cards = [...grid.children].filter((el) => el.matches('.char'));
    const sections = cards.map((card) => card.querySelector<HTMLElement>('.sections')).filter((s): s is HTMLElement => !!s);
    sections.forEach((s) => { s.style.marginTop = ''; });
    const open = cards.flatMap((card) => [...card.querySelectorAll<HTMLElement>('[data-drawer]:not([hidden])')]);
    if (!open.length) return;
    open.forEach((d) => { d.hidden = true; });
    const closedTops = sections.map((s) => s.getBoundingClientRect().top);
    sections.forEach((s) => { s.style.marginTop = '0px'; });
    const zeroTops = sections.map((s) => s.getBoundingClientRect().top);
    sections.forEach((s, i) => { s.style.marginTop = `${closedTops[i] - zeroTops[i]}px`; });
    open.forEach((d) => { d.hidden = false; });
  });
}

// Keep faces clear of the text: if any line of a card's name block sits at the height of the
// character's head and reaches it, slide the render right until there's a small gap. The head may
// go a little past the card's edge (up to 30% of its width, mostly hair, horns or ears), never more.
// The head's position in the render comes from the deploy.
const FACE_GAP = 10;
function clearFaces() {
  document.querySelectorAll<HTMLElement>('.banner .art').forEach((art) => {
    art.style.setProperty('--shift', '0px');
    const card = art.closest('.char')!;
    const cr = card.getBoundingClientRect();
    if (!cr.width) return;
    const ar = art.getBoundingClientRect();
    const headL = ar.left + ar.width * Number(art.dataset.headL) - cr.left;
    const headR = ar.left + ar.width * Number(art.dataset.headR) - cr.left;
    const headTop = ar.top + ar.height * Number(art.style.getPropertyValue('--ft')) - cr.top;
    const headBottom = ar.top + ar.height * Number(art.dataset.headB) - cr.top;
    let textRight = 0;
    card.querySelectorAll('.ident > *').forEach((line) => {
      range.selectNodeContents(line);
      const t = range.getBoundingClientRect();
      if (t.bottom - cr.top > headTop && t.top - cr.top < headBottom) textRight = Math.max(textRight, t.right - cr.left);
    });
    const want = Math.max(0, textRight + FACE_GAP - headL);
    const room = Math.max(0, cr.width - headR + 0.3 * (headR - headL));
    art.style.setProperty('--shift', `${Math.round(Math.min(want, room))}px`);
  });
}

// Section buttons (Gear, Professions, Mythic+, Raids) open their drawer under the buttons, one at a time.
document.addEventListener('click', (e) => {
  const button = (e.target as Element).closest?.<HTMLElement>('.banner [data-open]');
  if (!button) return;
  const card = button.closest('.char')!;
  const opening = button.getAttribute('aria-expanded') !== 'true';
  card.querySelectorAll('[data-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  card.querySelectorAll<HTMLElement>('[data-drawer]').forEach((d) => { d.hidden = true; });
  if (opening) {
    button.setAttribute('aria-expanded', 'true');
    card.querySelector<HTMLElement>(`[data-drawer="${button.dataset.open}"]`)!.hidden = false;
  }
  holdButtons();
});

let fitQueued = false;
const nameObserver = new ResizeObserver(() => {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => { fitQueued = false; fitAll(); });
});
export function fitNames() {
  nameObserver.disconnect();
  document.querySelectorAll('.char .cname').forEach((el) => nameObserver.observe(el));
}
fitNames();
// Cinzel can arrive after the first fit (common on phones), and swapping it in widens the names
// without resizing their boxes, so refit whenever a font finishes loading.
document.fonts?.ready.then(fitAll);
document.fonts?.addEventListener?.('loadingdone', fitAll);
