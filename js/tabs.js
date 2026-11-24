export function initTabs(list, activate, selected) {
  list.setAttribute('aria-orientation', 'horizontal');
  const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
  const panelFor = tab => document.getElementById(tab.dataset.panel || tab.dataset.pane);
  const select = (tab, notify = true) => {
    for (const other of tabs) {
      const active = tab === other;
      other.setAttribute('aria-selected', String(active));
      other.tabIndex = active ? 0 : -1;
      const panel = panelFor(other);
      panel.hidden = !active;
      panel.classList.toggle('on', active);
    }
    if (notify) {
      tab.scrollIntoView({block:'nearest', inline:'nearest'});
      activate?.(tab.dataset.pane);
    }
  };
  for (const tab of tabs) {
    const panel = panelFor(tab);
    tab.id ||= 'tab-' + panel.id;
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      const available=tabs.filter(candidate=>!candidate.hidden && !candidate.disabled);
      const index=available.indexOf(tab);
      const destinations = {
        ArrowLeft: (index + available.length - 1) % available.length,
        ArrowRight: (index + 1) % available.length,
        Home: 0, End: available.length - 1
      };
      if (!Object.hasOwn(destinations, event.key)) return;
      event.preventDefault();
      const next = available[destinations[event.key]];
      next.focus({preventScroll:true});
      select(next);
    });
  }
  select(tabs.find(tab => tab.dataset.pane === selected) ?? tabs[0], false);
  return id => {
    const tab = tabs.find(item => item.dataset.pane === id);
    if (tab) select(tab, false);
  };
}
