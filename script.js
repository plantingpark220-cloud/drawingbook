(function () {
  'use strict';
  var TOTAL = 20;                       // 含封面
  var book = document.getElementById('book');
  var prevBtn = document.getElementById('prev');
  var nextBtn = document.getElementById('next');
  var muteBtn = document.getElementById('mute');
  var replayBtn = document.getElementById('replay');
  var counter = document.getElementById('counter');
  var hint = document.getElementById('hint');

  var current = 0;
  var muted = false;
  var interacted = false;
  var leaves = [];

  // 建立所有頁面：第 i 頁是一張「可翻動的紙」，正面是插圖，背面是紙張
  for (var i = 0; i < TOTAL; i++) {
    var leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.style.zIndex = String(TOTAL - i);
    leaf.innerHTML =
      '<div class="face front"><img alt="繪本第 ' + (i + 1) + ' 頁插圖" draggable="false" ' +
      (i < 2 ? '' : 'loading="lazy" ') + 'src="assets/graphics/' + i + '.jpg"><div class="shade"></div></div>' +
      '<div class="face back"></div>';
    book.appendChild(leaf);
    leaves.push(leaf);
  }

  // ---------- 聲音：旁白 + 背景音樂 ----------
  var speech = new Audio();
  var music = new Audio();
  music.loop = true;
  music.volume = 0.22;                  // 音樂放小聲，不蓋過旁白
  speech.volume = 1;
  var musicIndex = -1;

  function playSound() {
    if (!interacted) return;            // 瀏覽器規定：需要使用者操作後才能播放
    speech.pause();
    speech.src = 'assets/speech/speech' + current + '.mp3';
    speech.currentTime = 0;
    speech.play().catch(function () {});
    if (musicIndex !== current) {
      musicIndex = current;
      music.src = 'assets/music/music' + current + '.mp3';
    }
    if (music.paused) music.play().catch(function () {});
  }

  function setMuted(m) {
    muted = m;
    speech.muted = m;
    music.muted = m;
    muteBtn.textContent = m ? '取消靜音' : '靜音';
    muteBtn.setAttribute('aria-label', m ? '取消靜音' : '靜音');
    muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
  }

  // ---------- 翻頁 ----------
  function render(animate) {
    for (var i = 0; i < TOTAL; i++) {
      var flipped = i < current;
      var leaf = leaves[i];
      if (flipped !== leaf.classList.contains('flipped')) {
        leaf.classList.toggle('flipped', flipped);
        if (animate) {
          leaf.classList.add('turning');
          (function (l) { setTimeout(function () { l.classList.remove('turning'); }, 1000); })(leaf);
        }
      }
    }
    counter.textContent = (current + 1) + ' / ' + TOTAL;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === TOTAL - 1;
    // 預先載入下一張
    if (current + 1 < TOTAL) { new Image().src = 'assets/graphics/' + (current + 1) + '.jpg'; }
  }

  function go(n) {
    n = Math.max(0, Math.min(TOTAL - 1, n));
    if (n === current) return;
    current = n;
    render(true);
    playSound();
    hint.classList.add('gone');
  }
  function next() { go(current + 1); }
  function prev() { go(current - 1); }

  function firstInteraction() {
    if (interacted) return;
    interacted = true;
    playSound();
  }

  // ---------- 按鈕 ----------
  prevBtn.addEventListener('click', function () { firstInteraction(); prev(); });
  nextBtn.addEventListener('click', function () { firstInteraction(); next(); });
  muteBtn.addEventListener('click', function () { firstInteraction(); setMuted(!muted); });
  replayBtn.addEventListener('click', function () { interacted = true; playSound(); });

  // ---------- 鍵盤 ----------
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ':
        e.preventDefault(); firstInteraction(); next(); break;
      case 'ArrowLeft': case 'PageUp':
        e.preventDefault(); firstInteraction(); prev(); break;
      case 'Home': e.preventDefault(); firstInteraction(); go(0); break;
      case 'End': e.preventDefault(); firstInteraction(); go(TOTAL - 1); break;
      case 'm': case 'M': setMuted(!muted); break;
    }
  });

  // ---------- 滑鼠 / 觸控：點擊左右側、或拖曳 ----------
  var startX = null, startY = null;
  book.addEventListener('pointerdown', function (e) { startX = e.clientX; startY = e.clientY; });
  book.addEventListener('pointerup', function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    startX = null;
    firstInteraction();
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {   // 滑動
      if (dx < 0) next(); else prev();
      return;
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {              // 點擊
      var r = book.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      if (x < 0.4) prev(); else if (x > 0.6) next();
    }
  });
  book.addEventListener('pointercancel', function () { startX = null; });

  // 初始化
  setMuted(false);
  render(false);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { speech.pause(); music.pause(); }
    else if (interacted) { music.play().catch(function () {}); }
  });
})();
