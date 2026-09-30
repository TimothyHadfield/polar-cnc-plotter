// Tool panels: a tool (text, patterns, calibration…) takes over the side panel while it is open,
// so the preview stays in view. Markup: <section class="tool" id="…Tool" hidden> inside .panel,
// with a <button data-close-tool> in its header.

const panel = () => document.querySelector('.panel');
let current = null;
const onClose = new Map();

export function openTool(id, whenClosed) {
  if (current) closeTool();
  current = document.getElementById(id);
  current.hidden = false;
  panel().classList.add('tooling');
  if (whenClosed) onClose.set(id, whenClosed);
}

export function closeTool() {
  if (!current) return;
  const id = current.id;
  current.hidden = true;
  current = null;
  panel().classList.remove('tooling');
  onClose.get(id)?.();
  onClose.delete(id);
}

document.addEventListener('click', e => { if (e.target.closest('[data-close-tool]')) closeTool(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && current && document.getElementById('settings').hidden) closeTool(); });
