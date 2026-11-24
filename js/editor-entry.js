export async function mountEditor(mode) {
  if (mode !== 'draw') {
    const response = await fetch(new URL('../index.html', import.meta.url));
    if (!response.ok) throw new Error('Không tải được trình sửa pixel (HTTP ' + response.status + ')');
    const template = new DOMParser().parseFromString(await response.text(), 'text/html');
    template.querySelectorAll('script').forEach(script => script.remove());
    document.body.replaceChildren(...template.body.childNodes);
  }
  document.body.dataset.workspace = mode;
  for (const link of document.querySelectorAll('.workspace-nav a')) {
    const current = link.getAttribute('href') === {draw:'index.html', puppet:'puppet.html', atlas:'tile.html'}[mode];
    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  await import('./editor-layout.js').then(({layoutEditor}) => layoutEditor(mode));
  await import('./main.js');
}

export function showEditorError(error) {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = error.message;
  document.body.replaceChildren(message);
}

if (document.body.dataset.workspace !== 'tile')
  mountEditor(document.body.dataset.workspace).catch(showEditorError);
