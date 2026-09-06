// Fills a `[data-line-gutter]` rail with real, evenly spaced line numbers sized
// to the sibling content column's rendered height — the editor's persistent
// gutter, not a decorative stripe. Re-measures on resize (debounced) since the
// content reflows at every breakpoint.
const LINE_HEIGHT_PX = 24;

function fillGutter(gutter: HTMLElement): void {
  const column = gutter.nextElementSibling as HTMLElement | null;
  if (!column) return;
  const total = Math.ceil(column.getBoundingClientRect().height / LINE_HEIGHT_PX);
  const fragment = document.createDocumentFragment();
  for (let n = 1; n <= total; n++) {
    const span = document.createElement('span');
    span.className = 'gutter-ln';
    span.textContent = String(n);
    fragment.appendChild(span);
  }
  gutter.replaceChildren(fragment);
}

export function mountLineGutter(): void {
  const gutter = document.querySelector<HTMLElement>('[data-line-gutter]');
  if (!gutter) return;

  fillGutter(gutter);

  let raf = 0;
  const onResize = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => fillGutter(gutter));
  };
  window.addEventListener('resize', onResize);

  // Content can grow after images/fonts settle; one late re-measure covers it.
  window.addEventListener('load', () => fillGutter(gutter), { once: true });
}
