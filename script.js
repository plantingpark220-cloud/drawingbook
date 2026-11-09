(function () {
  'use strict';

  var TOTAL = 20;                 // 含封面
  var MUSIC_VOL = 0.5;            // 平常的背景音樂音量
  var DUCK_VOL = 0.12;            // 朗讀時的背景音樂音量

  var $ = function (id) { return document.getElementById(id); };
  var book = $('book'), wrap = $('bookwrap');
  var prevBtn = $('prev'), nextBtn = $('next'), ppBtn = $('playpause');
  var readBtn = $('read'), muteBtn = $('mute'), retryBtn = $('retry');
  var counter = $('counter'), notice = $('notice'), fill = $('progressFill');
  var loadingEl = $('loading'), errorEl = $('error'), errorMsg = $('errorMsg');
  var speech = $('speech'), music = $('music');
  var debugEl = $('debug'), debugText = $('debugText');

  var current = 0;
  var muted = false;
  var interacted = false;
  var userPaused = false;
  var musicIndex = -1;
  var musicTimer = null;
  var errorKind = null;           // 'image' | 'speech' | 'music'
  var leaves = [], imgs = [];
  var logs = [];

  function log(msg) {
    logs.push(new Date().toTimeString().slice(0, 8) + ' ' + msg);
    if (logs.length > 12) logs.shift();
    updateDebug();
  }
  function say(msg) { notice.textContent = msg; }

  // ---------- 建立頁面（圖片先不載入，靠近目前頁才載入） ----------
  for (var i = 0; i < TOTAL; i++) {
    var leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.style.zIndex = String(TOTAL - i);
    leaf.innerHTML =
      '<div class="face front"><img alt="繪本第 ' + (i + 1) + ' 頁插圖" draggable="false" ' +
      'data-src="assets/graphics/' + i + '.jpg"><div class="shade"></div></div>' +
      '<div class="face back"></div>';
    book.insertBefore(leaf, loadingEl);
    leaves.push(leaf);
    var img = leaf.querySelector('img');
    imgs.push(img);
    (function (idx, im) {
      im.addEventListener('load', function () { im.removeAttribute('data-failed'); if (idx === current) refreshOverlay(); log('圖片載入 ' + idx); });
      im.addEventListener('error', function () { im.setAttribute('data-failed', '1'); if (idx === current) refreshOverlay(); log('圖片失敗 ' + idx); });
    })(i, img);
  }

  function loadImg(idx, bust) {
    var im = imgs[idx];
    if (!im) return;
    var base = im.getAttribute('data-src');
    if (bust) { im.removeAttribute('data-failed'); im.src = base + '?retry=' + Date.now(); }
    else if (!im.getAttribute('src')) im.src = base;
  }

  // ---------- 載入中／失敗 畫面 ----------
  function showError(kind, msg) { errorKind = kind; errorMsg.textContent = msg; errorEl.hidden = false; loadingEl.hidden = true; }
  function clearError(kind) { if (errorKind === kind) { errorKind = null; errorEl.hidden = true; } }

  function refreshOverlay() {
    var im = imgs[current];
    if (im.getAttribute('data-failed')) { showError('image', '第 ' + (current + 1) + ' 頁圖片載入失敗'); return; }
    clearError('image');
    var ready = im.complete && im.naturalWidth > 0;
    if (!errorKind) { loadingEl.hidden = ready; if (!ready) $('loadingText').textContent = '載入中…'; }
  }

  // ---------- 聲音 ----------
  function speechPlaying() { return !speech.paused && !speech.ended; }
  function syncVolume() { music.volume = speechPlaying() ? DUCK_VOL : MUSIC_VOL; updateDebug(); }
  ['play', 'playing', 'pause', 'ended', 'emptied', 'abort'].forEach(function (ev) {
    speech.addEventListener(ev, function () {
      syncVolume();
      if (ev === 'ended') say('朗讀結束');
      if (ev === 'playing') { clearError('speech'); say('朗讀中…'); }
      log('speech ' + ev);
    });
  });
  speech.addEventListener('waiting', function () { if (!errorKind) { loadingEl.hidden = false; $('loadingText').textContent = '旁白載入中…'; } });
  speech.addEventListener('canplay', function () { if (!errorKind) refreshOverlay(); });
  speech.addEventListener('error', function () { syncVolume(); showError('speech', '旁白載入失敗'); log('speech error'); });
  music.addEventListener('error', function () { showError('music', '背景音樂載入失敗'); log('music error'); });
  music.addEventListener('playing', function () { clearError('music'); updateDebug(); });
  music.addEventListener('pause', updateDebug);

  function speechPath() { return 'assets/speech/speech' + current + '.mp3'; }
  function musicPath(n) { return 'assets/music/music' + n + '.mp3'; }

  function startMusic() {
    if (musicIndex !== current) { musicIndex = current; music.src = musicPath(current); }
    syncVolume();
    var p = music.play(); if (p && p.catch) p.catch(function () {});
  }

  function readAloud(bust) {
    interacted = true; userPaused = false;
    speech.pause();
    clearError('speech');
    var path = speechPath();
    if (bust || speech.getAttribute('data-page') !== String(current)) {
      speech.src = bust ? path + '?retry=' + Date.now() : path;
      speech.setAttribute('data-page', String(current));
    }
    try { speech.currentTime = 0; } catch (e) {}
    var p = speech.play(); if (p && p.catch) p.catch(function () {});
    startMusic();
    syncVolume();
    updatePP();
  }

  function stopSpeech() {
    speech.pause();
    try { speech.currentTime = 0; } catch (e) {}
    syncVolume();
  }

  function isPlaying() { return !music.paused || !speech.paused; }
  function updatePP() { ppBtn.setAttribute('aria-pressed', isPlaying() ? 'true' : 'false'); }
  ['play', 'pause', 'ended'].forEach(function (ev) { speech.addEventListener(ev, updatePP); music.addEventListener(ev, updatePP); });

  function playAll() {
    interacted = true; userPaused = false;
    startMusic();
    var hasSrc = speech.getAttribute('data-page') === String(current);
    if (hasSrc && !speech.ended && speech.currentTime > 0) { var p = speech.play(); if (p && p.catch) p.catch(function () {}); }
    else readAloud(false);
    say('播放中');
  }
  function pauseAll() { userPaused = true; speech.pause(); music.pause(); syncVolume(); updatePP(); say('已暫停'); }
  function togglePlay() { if (isPlaying()) pauseAll(); else playAll(); }

  function setMuted(m) {
    muted = m;
    speech.muted = m; music.muted = m;
    muteBtn.textContent = m ? '解除靜音' : '靜音';
    muteBtn.setAttribute('aria-label', m ? '解除靜音' : '靜音');
    muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
    say(m ? '已靜音' : '已解除靜音');
    updateDebug();
  }

  // ---------- 翻頁 ----------
  function render(animate) {
    for (var i = 0; i < TOTAL; i++) {
      var flipped = i < current;
      var leaf = leaves[i];
      var near = i >= current - 1 && i <= current + 2;
      if (near) loadImg(i, false);
      leaf.style.display = near ? '' : 'none';
      if (flipped !== leaf.classList.contains('flipped')) {
        leaf.classList.toggle('flipped', flipped);
        if (animate) {
          leaf.classList.add('turning');
          (function (l) { setTimeout(function () { l.classList.remove('turning'); }, 1000); })(leaf);
        }
      }
    }
    counter.textContent = '第 ' + (current + 1) + ' 頁／共 ' + TOTAL + ' 頁';
    fill.style.width = ((current + 1) / TOTAL * 100) + '%';
    prevBtn.setAttribute('data-edge', current === 0 ? 'true' : 'false');
    nextBtn.setAttribute('data-edge', current === TOTAL - 1 ? 'true' : 'false');
    refreshOverlay();
    updateDebug();
  }

  function go(n) {
    if (n < 0) { say('已經是第一頁'); log('邊界：首頁'); return; }
    if (n > TOTAL - 1) { say('已經是最後一頁'); log('邊界：末頁'); return; }
    if (n === current) return;
    current = n;
    stopSpeech();                                   // 翻頁立刻停止舊頁旁白
    clearError('speech');
    render(true);
    say('第 ' + (current + 1) + ' 頁');
    // 背景音樂：快速連按時只等最後一頁
    clearTimeout(musicTimer);
    if (interacted) {
      musicTimer = setTimeout(function () {
        if (musicIndex !== current) { musicIndex = current; music.src = musicPath(current); }
        if (!userPaused) { var p = music.play(); if (p && p.catch) p.catch(function () {}); }
        syncVolume();
      }, 250);
    }
    preloadNext();
  }
  function next() { interacted = true; go(current + 1); }
  function prev() { interacted = true; go(current - 1); }

  // 預載下一頁（圖片 + 旁白）
  var preAudio = new Audio();
  preAudio.preload = 'auto';
  function preloadNext() {
    if (current + 1 < TOTAL) {
      loadImg(current + 1, false);
      preAudio.src = 'assets/speech/speech' + (current + 1) + '.mp3';
    }
  }

  // ---------- 按鈕 ----------
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  ppBtn.addEventListener('click', togglePlay);
  readBtn.addEventListener('click', function () { readAloud(false); });
  muteBtn.addEventListener('click', function () { setMuted(!muted); });
  retryBtn.addEventListener('click', function () {
    var kind = errorKind;
    errorKind = null; errorEl.hidden = true;
    log('重試 ' + kind);
    if (kind === 'image') { loadImg(current, true); refreshOverlay(); }
    else if (kind === 'speech') { readAloud(true); }
    else if (kind === 'music') { musicIndex = current; music.src = musicPath(current) + '?retry=' + Date.now(); var p = music.play(); if (p && p.catch) p.catch(function () {}); }
  });

  // ---------- 鍵盤 ----------
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) togglePlay(); return; }
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); next(); break;
      case 'ArrowLeft': e.preventDefault(); prev(); break;
      case 'PageDown': e.preventDefault(); next(); break;
      case 'PageUp': e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); go(0); break;
      case 'End': e.preventDefault(); go(TOTAL - 1); break;
      case 'm': case 'M': setMuted(!muted); break;
      case 'F2': e.preventDefault(); toggleDebug(); break;
      case 'D': case 'd': if (e.ctrlKey && e.shiftKey) { e.preventDefault(); toggleDebug(); } break;
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === ' ' || e.code === 'Space') e.preventDefault();   // 避免按鈕被空白鍵「點擊」
  });

  // ---------- 滑鼠／觸控：點頁面左右側，或滑動 ----------
  var sx = null, sy = null;
  book.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; sx = e.clientX; sy = e.clientY; });
  book.addEventListener('pointerup', function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      var r = book.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      if (x < 0.4) prev(); else if (x > 0.6) next();
    }
  });
  book.addEventListener('pointercancel', function () { sx = null; });

  // ---------- 依畫面大小調整書本（4:3） ----------
  function fit() {
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    book.style.width = Math.floor(Math.min(w, h * 4 / 3)) + 'px';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap);

  // ---------- 除錯面板（F2 或 Ctrl+Shift+D） ----------
  function toggleDebug() { debugEl.hidden = !debugEl.hidden; updateDebug(); }
  function updateDebug() {
    if (debugEl.hidden) return;
    debugText.textContent =
      '頁面：' + (current + 1) + '/' + TOTAL + '\n' +
      '旁白：' + (speech.getAttribute('data-page') === null ? '-' : '第' + (+speech.getAttribute('data-page') + 1) + '頁') +
      ' 播放中=' + speechPlaying() + ' 時間=' + (speech.currentTime || 0).toFixed(1) + ' 音量=' + speech.volume + '\n' +
      '音樂：' + (music.paused ? '暫停' : '播放') + ' 音量=' + music.volume.toFixed(2) + '\n' +
      '靜音：' + muted + '　使用者暫停：' + userPaused + '\n' +
      '已載入圖片：' + imgs.filter(function (m) { return m.complete && m.naturalWidth > 0; }).length + '\n' +
      '錯誤：' + (errorKind || '無') + '\n' + logs.join('\n');
  }
  setInterval(updateDebug, 500);

  // 離開分頁時暫停，回來時若沒有手動暫停就繼續背景音樂
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { speech.pause(); music.pause(); }
    else if (interacted && !userPaused) { var p = music.play(); if (p && p.catch) p.catch(function () {}); }
  });

  // 初始化
  music.volume = MUSIC_VOL;
  setMuted(false);
  say('點選頁面左右兩側、拖曳滑動，或按鍵盤 ← → 翻頁；空白鍵播放／暫停');
  render(false);
  fit();
  preloadNext();
  updatePP();
})();
