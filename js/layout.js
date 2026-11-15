// Phone layout: the side panel's groups (Load, Adjust, Plot) become tabs with a bar at the bottom.
// On a laptop every group shows at once and the bar is hidden (css/app.css). The open tab is the
// panel's data-tab; a tool (Text, Calibrate…) covers the panel and closing it comes back to it.

export function initLayout() {
  const panel = document.querySelector('.panel');
  const bar = document.getElementById('tabbar');
  if (!panel || !bar) return;
  const plotTab = bar.querySelector('[data-tab=plot]');
  // the Plot tab only where there is a plotter panel (Chrome/Edge with USB, ?demo, the simulator)
  if (plotTab) plotTab.hidden = !!document.getElementById('machine')?.hidden;
  const show = tab => {
    panel.dataset.tab = tab;
    for (const b of bar.querySelectorAll('[data-tab]')) {
      b.classList.toggle('on', b.dataset.tab === tab);
      b.setAttribute('aria-selected', b.dataset.tab === tab);
    }
  };
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (b) show(b.dataset.tab);
  });
  show('load');
}
