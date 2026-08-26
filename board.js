/* ══════════════════════════════════════════════════════════════
   board.js — 공용 전자칠판 슬라이드 뷰어 (표준 v1)

   ▸ 왜 있나
     예전에는 저장소마다 board.html 이 따로 있었고, 사본 13개가 조금씩
     갈라져 있었다. 이제 슬라이드 화면은 이 파일 하나가 담당하고
     저장소는 원고(lesson.js)만 갖는다. 겉으로 보이는 입구는 index.html 하나다.

   ▸ 쓰는 법
     <script src="lesson.js"></script>   ← window.LESSON / window.UNITS 를 선언한다
     <script src="board.js"></script>
     Board.home(document.getElementById('boardHome'));

   ▸ 원고 한 장(LESSON 의 원소) 형식
     { u:'단원명', t:'제목', svg:'<svg…>', img:'그림.png', cap:'그림 설명',
       pts:['요점','요점'], ask:'발문',
       ansq:'퀴즈 질문', anso:['보기1','보기2'], ansa:정답번호(0부터), anse:'해설',
       go:['버튼 글','링크'] }
     UNITS = [{ name:'1단원 …', idx:[0,1,2] }, …]

   ▸ 요점(pts) 안의 {{답}} 은 빈칸이 된다.
     수업 중에 학생에게 먼저 맞혀 보게 하는 용도라 처음에는 글자가 가려져 있고,
     그 자리를 눌러야(또는 Tab 으로 옮겨 Enter) 답이 드러난다.
     예) '접점이 눌리면 닫히는 것이 {{a접점}} 이다'
     빈칸을 눌러도 슬라이드는 넘어가지 않는다.

   ▸ 넘기기는 [◀ 이전] [다음 ▶] 버튼과 ← → 키만 쓴다.
     화면 아무 데나 눌러서 넘어가는 동작은 넣지 않는다 — 수업 중에 잘못 눌린다.

   ▸ 버튼 겹침
     슬라이드는 화면 전체를 덮는 고정 레이어(z-index 99000)다.
     본체 페이지의 떠 있는 버튼들은 그 아래로 가려지므로 겹치지 않는다.
     레이어 안쪽 버튼은 위(막대) · 아래(막대) 두 줄에만 두고 flex 로 나눈다.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var CSS = [
    '.bd-units{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:11px}',
    '.bd-unit{background:#161c27;border:1px solid #2c3648;border-radius:14px;padding:15px 16px;',
    '  cursor:pointer;text-align:left;color:#e9eefa;font:inherit;transition:.12s}',
    '.bd-unit:hover{border-color:#5b8cff;background:#1e2634;transform:translateY(-2px)}',
    '.bd-unit b{display:block;font-size:15px;margin-bottom:4px}',
    '.bd-unit .ds{color:#98a5bd;font-size:12.5px}',
    '.bd-all{width:100%;margin-top:12px;background:linear-gradient(135deg,#3b82f6,#5b8cff);color:#fff;',
    '  border:0;border-radius:14px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit}',
    '.bd-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}',
    '.bd-tabs button{background:#1e2634;color:#e9eefa;border:1px solid #2c3648;border-radius:999px;',
    '  padding:7px 15px;font-size:13.5px;cursor:pointer;font-family:inherit}',
    '.bd-tabs button.on{background:#5b8cff;border-color:#5b8cff;color:#fff;font-weight:800}',
    '.bd-hint{color:#98a5bd;font-size:12.5px;margin:12px 0 0}',

    /* ── 슬라이드 레이어 ── */
    '.bd-layer{position:fixed;inset:0;z-index:99000;background:linear-gradient(180deg,#0d1420,#080b11);',
    '  color:#e9eefa;display:flex;flex-direction:column;',
    '  font-family:"Pretendard","Segoe UI",system-ui,-apple-system,sans-serif;line-height:1.55}',
    '.bd-layer[hidden]{display:none!important}',
    '.bd-top{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid #2c3648;',
    '  background:rgba(10,14,20,.92);flex-shrink:0}',
    '.bd-top .bd-ttl{font-weight:800;font-size:15px;flex:1;min-width:0;overflow:hidden;',
    '  text-overflow:ellipsis;white-space:nowrap}',
    '.bd-top .bd-pos{color:#98a5bd;font-size:12.5px;flex-shrink:0;font-variant-numeric:tabular-nums}',
    '.bd-top button{background:#1e2634;color:#e9eefa;border:1px solid #2c3648;border-radius:9px;',
    '  padding:7px 12px;font-size:13px;cursor:pointer;font-family:inherit;flex-shrink:0}',
    '.bd-top button:hover{border-color:#5b8cff}',
    '.bd-body{flex:1;overflow:auto;padding:16px 20px 26px;-webkit-overflow-scrolling:touch}',
    '.bd-in{max-width:1000px;margin:0 auto}',
    '.bd-h{font-size:clamp(20px,3.4vw,30px);font-weight:900;margin:0 0 12px;letter-spacing:-.02em}',
    '.bd-fig{background:#fff;border-radius:12px;padding:8px;text-align:center;margin-bottom:8px}',
    '.bd-fig img{max-width:100%;max-height:38vh;object-fit:contain;display:block;margin:0 auto}',
    '.bd-figsvg{background:#fff;border-radius:12px;padding:12px 10px;margin-bottom:8px;overflow-x:auto}',
    '.bd-cap{color:#98a5bd;font-size:12.5px;text-align:center;margin:0 0 14px}',
    '.bd-pts{list-style:none;padding:0;margin:0 0 14px}',
    '.bd-pts li{background:#161c27;border:1px solid #2c3648;border-left:3px solid #5b8cff;',
    '  border-radius:9px;padding:11px 14px;margin-bottom:8px;font-size:clamp(14px,2vw,17px)}',
    /* {{답}} 빈칸 — 누르기 전에는 글자가 안 보인다 */
    '.bd-bl{display:inline-block;min-width:3.4em;padding:0 .35em;margin:0 .12em;border-radius:5px;',
    '  background:#1d3350;border-bottom:2px solid #7fc4ff;color:transparent;cursor:pointer;',
    '  font-weight:800;user-select:none}',
    '.bd-bl:focus{outline:2px solid #7fc4ff;outline-offset:1px}',
    '.bd-bl.on{background:rgba(127,196,255,.16);color:#9fe0ff;border-bottom-color:#9fe0ff;cursor:default}',
    '.bd-ask{background:rgba(255,209,102,.12);border:1px solid #ffd166;border-radius:11px;',
    '  padding:13px 15px;margin-bottom:14px;font-size:clamp(14px,2vw,17px)}',
    '.bd-ask b{color:#ffd166}',
    '.bd-quiz{background:#161c27;border:1px solid #2c3648;border-radius:11px;padding:14px 15px;margin-bottom:12px}',
    '.bd-quiz .bd-q{font-weight:700;font-size:clamp(14px,2vw,17px);margin-bottom:10px}',
    '.bd-quiz ol{margin:0;padding-left:22px}',
    '.bd-quiz li{padding:5px 0;font-size:clamp(13.5px,1.9vw,16px)}',
    '.bd-quiz li.on{color:#3ad995;font-weight:800}',
    '.bd-exp{background:rgba(58,217,149,.1);border:1px solid #3ad995;border-radius:11px;',
    '  padding:13px 15px;font-size:clamp(13.5px,1.9vw,16px)}',
    '.bd-go{display:block;text-align:center;text-decoration:none;margin-top:16px;',
    '  background:linear-gradient(135deg,#0e9f6e,#3ad995);color:#062a1c;font-weight:800;',
    '  border-radius:12px;padding:13px;font-size:15px}',
    '.bd-nav{display:flex;gap:9px;padding:10px 14px;border-top:1px solid #2c3648;',
    '  background:rgba(10,14,20,.92);flex-shrink:0}',
    '.bd-nav button{flex:1;min-width:0;background:#1e2634;color:#e9eefa;border:1px solid #2c3648;',
    '  border-radius:10px;padding:13px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit}',
    '.bd-nav button.main{background:linear-gradient(135deg,#3b82f6,#5b8cff);border-color:transparent;color:#fff}',
    '.bd-nav button:disabled{opacity:.4;cursor:default}',
    'body.bd-open{overflow:hidden}',
    /* 슬라이드가 열려 있는 동안에는 본체의 떠 있는 위젯을 숨긴다.
       레이어가 z-index 로 덮고 있긴 하지만, 나중에 더 높은 z 를 쓰는 위젯이
       생기면 바로 겹치므로 아예 가려 둔다. 수업 화면도 깔끔해진다.

       ⚠ display:none 이 아니라 visibility:hidden 을 쓴다.
         backbar.js 는 「기록 초기화」(.tr-btn) 의 높이를 재서 그 위에 자기를 올린다.
         display:none 으로 지우면 높이가 0 이 되어 backbar 가 맨 아래(bottom:10px)로
         내려앉고, 슬라이드를 닫아도 그대로 남아 두 버튼이 82% 겹쳐 버린다.
         visibility:hidden 은 안 보이고 눌리지도 않으면서 자리는 지키므로 이 문제가 없다. */
    'body.bd-open #bb-btn,',        /* 뒤로/목록으로 (backbar.js) */
    'body.bd-open .tr-btn,',        /* 기록 초기화 (reset.js) */
    'body.bd-open #rk-badge{visibility:hidden!important;pointer-events:none!important}'   /* 계급 배지 (rank.js) */
  ].join('\n');

  var DECK = [], UNIT = [];
  var layer = null, elTtl, elPos, elIn, elBody, elPrev, elNext;
  var S = { list: [], i: 0, step: 0 };   /* step 0 요점 → 1 발문 → 2 퀴즈 → 3 정답 */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  /* 요점 한 줄의 {{답}} 을 눌러야 보이는 빈칸으로 바꾼다.
     원고에는 태그(<b> 등)가 들어 있으므로 줄 전체를 esc 하지 않는다 —
     빈칸 안의 글자만 esc 한다. */
  function blanks(p) {
    return String(p == null ? '' : p).replace(/\{\{([\s\S]+?)\}\}/g, function (_, a) {
      return '<span class="bd-bl" tabindex="0" role="button" title="눌러서 답 보기">' + esc(a) + '</span>';
    });
  }

  /* 선생님이 ?rc=… 로 열었으면 슬라이드에서 넘어가는 링크에도 그대로 붙여 준다 */
  function withRc(url) {
    var rc = new URLSearchParams(location.search).get('rc');
    if (!rc) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'rc=' + encodeURIComponent(rc);
  }

  function injectCss() {
    if (document.getElementById('bd-css')) return;
    var st = document.createElement('style');
    st.id = 'bd-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function buildLayer() {
    if (layer) return;
    layer = document.createElement('div');
    layer.className = 'bd-layer';
    layer.hidden = true;
    layer.innerHTML =
      '<div class="bd-top">' +
        '<button type="button" data-bd="close">← 나가기</button>' +
        '<span class="bd-ttl"></span>' +
        '<span class="bd-pos"></span>' +
        '<button type="button" data-bd="full" title="전체화면">⛶</button>' +
      '</div>' +
      '<div class="bd-body"><div class="bd-in"></div></div>' +
      '<div class="bd-nav">' +
        '<button type="button" data-bd="prev">◀ 이전</button>' +
        '<button type="button" class="main" data-bd="next">다음 ▶</button>' +
      '</div>';
    document.body.appendChild(layer);

    elTtl  = layer.querySelector('.bd-ttl');
    elPos  = layer.querySelector('.bd-pos');
    elBody = layer.querySelector('.bd-body');
    elIn   = layer.querySelector('.bd-in');
    elPrev = layer.querySelector('[data-bd="prev"]');
    elNext = layer.querySelector('[data-bd="next"]');

    layer.addEventListener('click', function (e) {
      /* 빈칸을 누르면 그 답만 드러난다. 슬라이드는 넘어가지 않는다. */
      var bl = e.target.closest && e.target.closest('.bd-bl');
      if (bl) { bl.classList.add('on'); return; }
      var b = e.target.closest('[data-bd]');
      if (!b) return;                       /* 빈 곳을 눌러도 넘어가지 않는다 */
      var a = b.dataset.bd;
      if (a === 'close') close();
      else if (a === 'prev') prev();
      else if (a === 'next') next();
      else if (a === 'full') toggleFull();
    });

    document.addEventListener('keydown', function (e) {
      if (layer.hidden) return;
      /* 빈칸에 초점이 있으면 Enter·스페이스는 그 빈칸을 여는 데 쓴다
         (안 그러면 스페이스가 슬라이드 넘기기로 먹혀 빈칸을 못 연다) */
      var bl = e.target && e.target.closest && e.target.closest('.bd-bl');
      if (bl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); bl.classList.add('on'); return; }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') { close(); }
    });
  }

  function toggleFull() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (layer.requestFullscreen) layer.requestFullscreen().catch(function () {});
  }

  /* ── 단원 고르는 화면 ────────────────────────────────────────
     el    : 그려 넣을 자리
     opts  : { units, hint, tabs }
       units : 쓸 단원 배열 (없으면 window.UNITS)
       hint  : 목록 아래 안내 문구(HTML 가능)
       tabs  : [{ label:'1급', units:[…], hint:'…' }] — 급수·과정이 갈리는 도구용
  ─────────────────────────────────────────────────────────── */
  function home(el, opts) {
    if (!el) return;
    opts = opts || {};
    injectCss();
    buildLayer();
    DECK = global.LESSON || [];
    UNIT = opts.units || global.UNITS || [];

    var tabs = opts.tabs || null;
    var cur = 0;

    function draw() {
      var units = tabs ? (tabs[cur].units || []) : UNIT;
      var hint = tabs ? (tabs[cur].hint || opts.hint) : opts.hint;
      var h = '';
      if (tabs) {
        h += '<div class="bd-tabs">' + tabs.map(function (t, k) {
          return '<button type="button" data-tab="' + k + '"' +
                 (k === cur ? ' class="on"' : '') + '>' + esc(t.label) + '</button>';
        }).join('') + '</div>';
      }
      h += '<div class="bd-units">' + units.map(function (u, k) {
        return '<button type="button" class="bd-unit" data-u="' + k + '">' +
               '<b>' + esc(u.name) + '</b>' +
               '<span class="ds">슬라이드 ' + u.idx.length + '장</span></button>';
      }).join('') + '</div>';
      h += '<button type="button" class="bd-all" data-all="1">▶ 처음부터 순서대로 시작</button>';
      if (hint) h += '<p class="bd-hint">' + hint + '</p>';
      el.innerHTML = h;
      el.__units = units;
    }

    el.onclick = function (e) {
      var t = e.target.closest('[data-tab]');
      if (t) { cur = +t.dataset.tab; draw(); return; }
      var u = e.target.closest('[data-u]');
      if (u) { open(el.__units[+u.dataset.u].idx); return; }
      if (e.target.closest('[data-all]')) {
        var all = [];
        el.__units.forEach(function (x) { all = all.concat(x.idx); });
        open(all.length ? all : DECK.map(function (_, i) { return i; }));
      }
    };

    draw();
  }

  function open(list) {
    injectCss();
    buildLayer();
    DECK = global.LESSON || DECK;
    S = { list: list, i: 0, step: 0 };
    layer.hidden = false;
    document.body.classList.add('bd-open');
    render();
  }

  function close() {
    if (!layer) return;
    layer.hidden = true;
    document.body.classList.remove('bd-open');
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  }

  function render() {
    var s = DECK[S.list[S.i]];
    if (!s) return;
    elTtl.textContent = s.u || '';
    elPos.textContent = (S.i + 1) + ' / ' + S.list.length;

    var h = '<h2 class="bd-h">' + esc(s.t) + '</h2>';
    if (s.svg) h += '<div class="bd-figsvg">' + s.svg + '</div>';
    if (s.img) h += '<div class="bd-fig"><img src="' + s.img + '" alt=""></div>';
    if (s.cap) h += '<p class="bd-cap">' + esc(s.cap) + '</p>';
    h += '<ul class="bd-pts">' + (s.pts || []).map(function (p) {
      return '<li>' + blanks(p) + '</li>';
    }).join('') + '</ul>';

    if (S.step >= 1 && s.ask) h += '<div class="bd-ask"><b>발문</b> — ' + esc(s.ask) + '</div>';
    if (S.step >= 2 && s.ansq) {
      h += '<div class="bd-quiz"><div class="bd-q">' + s.ansq + '</div><ol>' +
        (s.anso || []).map(function (o, i) {
          var on = (S.step >= 3 && i === s.ansa) ? ' class="on"' : '';
          return '<li' + on + '>' + esc(o) + (S.step >= 3 && i === s.ansa ? '  ✔' : '') + '</li>';
        }).join('') + '</ol></div>';
    }
    if (S.step >= 3 && s.anse) h += '<div class="bd-exp">💡 ' + s.anse + '</div>';
    /* 정답까지 열고 나면 그 주제의 문제풀이로 바로 넘어갈 수 있게 한다 */
    if (S.step >= 3 && s.go) {
      h += '<a class="bd-go" target="_blank" rel="noopener" href="' + withRc(s.go[1]) + '">' +
           esc(s.go[0]) + ' ↗</a>';
    }

    elIn.innerHTML = h;
    elBody.scrollTop = 0;
    elPrev.disabled = (S.i === 0 && S.step === 0);
    elNext.textContent = nextLabel(s);
  }

  function tailLabel() {
    return S.i === S.list.length - 1 ? '수업 마치기' : '다음 슬라이드 ▶';
  }

  /* [다음] 을 누르면 '실제로' 무엇이 열리는지 미리 따져서 그대로 적는다.
     발문·퀴즈·해설이 없는 슬라이드도 있으므로(요점과 발문만 있는 원고 등),
     없는 것을 열겠다고 써 두면 안 된다 — 아래 next() 와 같은 순서로 따진다. */
  function nextLabel(s) {
    if (S.step >= 3) return tailLabel();
    var st = S.step + 1;
    if (st === 1 && !s.ask) st++;
    if (st === 2 && !s.ansq) st = 3;
    if (st === 1) return '발문 열기 ▶';
    if (st === 2) return '퀴즈 열기 ▶';
    if (!s.anse && !s.ansq && !s.go) return tailLabel();  /* 열 것이 없어 바로 다음 장으로 간다 */
    if (s.ansq) return '정답 열기 ▶';
    if (s.anse) return '해설 열기 ▶';
    return '문제풀이 열기 ▶';
  }

  /* 다음 — 요점→발문→퀴즈→정답 순으로 열고, 다 열렸으면 다음 장으로 */
  function next() {
    var s = DECK[S.list[S.i]];
    if (S.step < 3) {
      S.step++;
      if (S.step === 1 && !s.ask) S.step++;          /* 발문 없으면 건너뛴다 */
      if (S.step === 2 && !s.ansq) S.step = 3;       /* 퀴즈 없으면 정답 단계로 */
      if (S.step === 3 && !s.anse && !s.ansq && !s.go) { nextSlide(); return; }
      render();
      return;
    }
    nextSlide();
  }

  function nextSlide() {
    if (S.i >= S.list.length - 1) { close(); return; }
    S.i++; S.step = 0; render();
  }

  function prev() {
    if (S.step > 0) { S.step = 0; render(); return; }
    if (S.i > 0) { S.i--; S.step = 0; render(); }
  }

  global.Board = { home: home, open: open, close: close };
})(window);
