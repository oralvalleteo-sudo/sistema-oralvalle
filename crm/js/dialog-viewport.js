(() => {
  'use strict';

  const frame = window.frameElement;
  const host = frame ? window.parent : window;
  const viewport = host.visualViewport;
  const mobile = host.matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)');
  const dialogs = [...document.querySelectorAll('#editor, #recovery-message')];
  const root = document.documentElement;

  function syncViewport() {
    const active = mobile.matches && dialogs.some(dialog => dialog.open);
    frame?.classList.toggle('crm-visible-dialog', active);
    if (!active) {
      root.style.removeProperty('--crm-visible-height');
      return;
    }
    const height = viewport?.height ?? host.innerHeight;
    root.style.setProperty('--crm-visible-height', height + 'px');
    if (!frame) return;

    frame.style.setProperty('--crm-viewport-top', (viewport?.offsetTop ?? 0) + 'px');
    frame.style.setProperty('--crm-viewport-left', (viewport?.offsetLeft ?? 0) + 'px');
    frame.style.setProperty('--crm-viewport-width', (viewport?.width ?? host.innerWidth) + 'px');
    frame.style.setProperty('--crm-viewport-height', height + 'px');
  }

  const observer = new MutationObserver(syncViewport);
  dialogs.forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  mobile.addEventListener('change', syncViewport);
  viewport?.addEventListener('resize', syncViewport);
  viewport?.addEventListener('scroll', syncViewport);
  host.addEventListener('resize', syncViewport);

  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    frame?.classList.remove('crm-visible-dialog');
    mobile.removeEventListener('change', syncViewport);
    viewport?.removeEventListener('resize', syncViewport);
    viewport?.removeEventListener('scroll', syncViewport);
    host.removeEventListener('resize', syncViewport);
  });
  syncViewport();
})();
