(function(){
  // Local loader for jsQR. This file acts as a vendored entrypoint.
  // If you want a true offline copy, replace the contents of this file
  // with the minified jsQR source (https://github.com/cozmo/jsQR) or
  // add the minified file at this path.

  if (typeof jsQR !== 'undefined') return;

  // Try to load an embedded vendor copy (developers can replace this block)
  // For now, fall back to loading from CDN if not present.
  try {
    // If someone replaced this file with the real jsQR source, it will
    // define `jsQR` and this will return earlier.
    // Fallback: dynamically load CDN script to satisfy runtime when offline
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.async = false;
    s.onload = function(){ console.info('jsQR loaded from CDN via local loader'); };
    s.onerror = function(){ console.warn('jsQR failed to load from CDN via local loader'); };
    document.head.appendChild(s);
  } catch (e) {
    console.warn('jsQR loader error', e);
  }
})();
