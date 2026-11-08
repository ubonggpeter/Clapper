/* Chat looks safety net: if anything inside a chat bubble ever ends up wider than the bubble (a big photo, an embed, a wide table...),
   that bubble is clipped to its own edges instead of letting content spill out. Runs after images and videos load, and on resize. */
(function () {
  'use strict';
  function fit() {
    var bubbles = document.querySelectorAll('body[data-chat-look] .bm-post-bubble');
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i], br = b.getBoundingClientRect(), over = false, kids = b.querySelectorAll('img, video, iframe, figure, .bm-album, table, pre');
      b.classList.remove('bmc-clip'); br = b.getBoundingClientRect();
      for (var k = 0; k < kids.length && !over; k++) { var r = kids[k].getBoundingClientRect(); if (r.width && (r.left < br.left - 1 || r.right > br.right + 1)) over = true; }
      if (over) b.classList.add('bmc-clip');
    }
  }
  var t = 0; function soon() { clearTimeout(t); t = setTimeout(fit, 60); }
  document.addEventListener('loadedmetadata', soon, true); document.addEventListener('load', soon, true); window.addEventListener('resize', soon); window.addEventListener('load', soon);
  setTimeout(fit, 700); setTimeout(fit, 2500);
})();
