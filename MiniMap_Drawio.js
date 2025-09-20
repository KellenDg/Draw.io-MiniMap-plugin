/* global Draw, mxOutline, mxEvent */

Draw.loadPlugin(function (ui) {
  var graph = ui && ui.editor && ui.editor.graph;
  if (!graph || typeof mxOutline === 'undefined') {
    console.warn('[minimap-plugin] No graph or mxOutline not available');
    return;
  }

  // --- Styles ---------------------------------------------------------------
  var css = [
    '.miniwrap{position:absolute;right:16px;bottom:16px;width:240px;height:170px;',
    'background:rgba(30,30,30,0.04);backdrop-filter:saturate(180%) blur(2px);',
    'border:1px solid rgba(0,0,0,0.15);border-radius:10px;',
    'box-shadow:0 8px 20px rgba(0,0,0,0.18);overflow:hidden;z-index:9999;',
    'display:flex;flex-direction:column;user-select:none}',

    '.miniheader{height:28px;display:flex;align-items:center;justify-content:space-between;',
    'padding:0 8px;background:linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.6));',
    'border-bottom:1px solid rgba(0,0,0,0.08);font:12px/1 sans-serif;color:#444}',

    '.minibody{flex:1;position:relative;background:#fff}',

    '.minibtn{cursor:pointer;border:none;background:transparent;padding:4px 6px;',
    'font:12px/1 sans-serif;color:#444;opacity:0.8}',
    '.minibtn:hover{opacity:1}',

    '.miniresize{position:absolute;right:6px;bottom:6px;width:12px;height:12px;cursor:nwse-resize;',
    'border-right:2px solid rgba(0,0,0,0.25);border-bottom:2px solid rgba(0,0,0,0.25);',
    'transform:rotate(0.0001deg)}'
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.setAttribute('data-minimap-plugin', '');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // --- DOM ------------------------------------------------------------------
  var wrap = document.createElement('div');
  wrap.className = 'miniwrap';

  var header = document.createElement('div');
  header.className = 'miniheader';

  var title = document.createElement('div');
  title.textContent = 'Minimap';

  var btns = document.createElement('div');

  var hideBtn = document.createElement('button');
  hideBtn.className = 'minibtn';
  hideBtn.title = 'Hide (Alt+M)';
  hideBtn.textContent = '–';

  var fitBtn = document.createElement('button');
  fitBtn.className = 'minibtn';
  fitBtn.title = 'Fit page';
  fitBtn.textContent = 'Fit';

  btns.appendChild(fitBtn);
  btns.appendChild(hideBtn);

  header.appendChild(title);
  header.appendChild(btns);

  var body = document.createElement('div');
  body.className = 'minibody';

  var resize = document.createElement('div');
  resize.className = 'miniresize';
  body.appendChild(resize);

  wrap.appendChild(header);
  wrap.appendChild(body);

  // Attach to the main UI container so it floats above the canvas
  (ui.container || document.body).appendChild(wrap);

  // --- mxOutline ------------------------------------------------------------
  var outline = new mxOutline(graph, body);
  outline.updateOnPan = true; // update while panning the main graph

  // Ensure initial update after current render tick
  setTimeout(function () {
    try { outline.update(true); } catch (e) {}
  }, 0);

  // --- Buttons --------------------------------------------------------------
  hideBtn.addEventListener('click', function () {
    var hidden = wrap.getAttribute('data-hidden') === '1';
    if (hidden) {
      wrap.style.height = wrap.getAttribute('data-h') || '170px';
      wrap.style.width = wrap.getAttribute('data-w') || '240px';
      wrap.removeAttribute('data-hidden');
      hideBtn.textContent = '–';
      setTimeout(function(){ outline.update(true); }, 0);
    } else {
      wrap.setAttribute('data-w', wrap.style.width);
      wrap.setAttribute('data-h', wrap.style.height);
      wrap.style.height = '28px';
      wrap.style.width = '120px';
      wrap.setAttribute('data-hidden', '1');
      hideBtn.textContent = '+';
    }
  });

  fitBtn.addEventListener('click', function () {
    try {
      // Fit the current page bounds in the main view
      var bounds = graph.getGraphBounds();
      var s = graph.view.scale;
      graph.view.setTranslate(-bounds.x / s, -bounds.y / s);
      graph.fit();
      outline.update(true);
    } catch (e) {}
  });

  // --- Resize handle --------------------------------------------------------
  (function enableResize() {
    var startX, startY, startW, startH, resizing = false;
    function onMove(ev){
      if (!resizing) return;
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      var nw = Math.max(160, startW + dx);
      var nh = Math.max(120, startH + dy);
      wrap.style.width = nw + 'px';
      wrap.style.height = nh + 'px';
      outline.update();
      ev.preventDefault();
    }
    function onUp(){
      if (!resizing) return;
      resizing = false;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      setTimeout(function(){ outline.update(true); }, 0);
    }
    resize.addEventListener('mousedown', function(ev){
      ev.preventDefault();
      resizing = true;
      startX = ev.clientX; startY = ev.clientY;
      startW = wrap.getBoundingClientRect().width;
      startH = wrap.getBoundingClientRect().height;
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
    });
  })();

  // --- Keyboard toggle (Alt+M) ---------------------------------------------
  try {
    var kh = ui.keyHandler; // draw.io key handler
    if (kh && kh.bindKey) {
      // Alt+M toggles
      kh.bindKey(77, function (evt) { // 77 = 'M'
        if (!evt || !evt.altKey) return false;
        hideBtn.click();
        return false;
      });
    } else {
      window.addEventListener('keydown', function (e) {
        if (e.altKey && (e.key === 'm' || e.key === 'M')) {
          hideBtn.click();
          e.preventDefault();
        }
      });
    }
  } catch (e) {}

  // --- Keep it alive on file/page changes ----------------------------------
  // Update outline explicitly on common UI events
  var view = graph.view;
  var updater = function(){ try { outline.update(); } catch (e) {} };
  view.addListener && view.addListener(mxEvent.SCALE, updater);
  view.addListener && view.addListener(mxEvent.TRANSLATE, updater);
  view.addListener && view.addListener(mxEvent.SCALE_AND_TRANSLATE, updater);
  graph.getModel().addListener && graph.getModel().addListener(mxEvent.CHANGE, function(){
    setTimeout(updater, 0);
  });

  console.log('[minimap-plugin] minimap ready');
});
