(() => {
  'use strict';

  const mobile = matchMedia('(max-width: 760px) and (pointer: coarse)');
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;
  const defaultContent = viewport.content;

  function syncViewport() {
    viewport.content = mobile.matches
      ? defaultContent + ', maximum-scale=1, user-scalable=no'
      : defaultContent;
  }

  // O Safari pode ignorar as restrições declaradas na meta viewport.
  function preventPinch(event) {
    if (mobile.matches) event.preventDefault();
  }

  document.addEventListener('gesturestart', preventPinch, { passive: false });
  document.addEventListener('gesturechange', preventPinch, { passive: false });
  mobile.addEventListener('change', syncViewport);
  syncViewport();
})();
