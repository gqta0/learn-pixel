const panel = new URLSearchParams(location.search).get('panel');

if (panel === 'atlas' || panel === 'map') {
  const styles = document.querySelector('#tileStyles');
  styles.href = 'css/app.css';
  const {mountEditor, showEditorError} = await import('./editor-entry.js');
  document.title = panel === 'atlas' ? 'Lò Pixel — Atlas' : 'Lò Pixel — Soi map nâng cao';
  await mountEditor('atlas').catch(showEditorError);
} else {
  await import('./tilepage.js');
}
