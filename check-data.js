/* ═══════════════════════════════════════════════════════════
   check-data.js — 문항 데이터 무결성 검사기

   사용법
     node check-data.js                     기본: 같은 폴더 ncs-data.js 전체 검사
     node check-data.js math                특정 영역만
     node check-data.js 파일1.js 파일2.js    임의의 문항 파일들을 검사(형식 자동 인식)
     node check-data.js "전사폴더/*.js"      (셸이 넓혀 주는 경우)

   자동 인식하는 형식
     ① var AREAS = {...}                    이 저장소의 표준 구조
     ② addQ(...) / addQuestion(...) 호출 나열  전사 작업물에서 흔한 형태
     ③ 문항 객체 배열을 담은 전역변수/ module.exports
   → 전사 결과를 AREAS 형태로 손수 바꿀 필요가 없다.
   ═══════════════════════════════════════════════════════════ */
var fs = require('fs');
var path = require('path');

var args = process.argv.slice(2);

/* 인자 해석
   - 파일 / 디렉터리 / 와일드카드(*)를 받아 .js 목록으로 넓힌다.
     Windows 셸은 *를 넓혀 주지 않으므로 여기서 직접 처리한다.
   - 그 밖의 낱말은 영역 필터로 본다.
   - 경로처럼 보이는데 하나도 못 찾으면 조용히 넘어가지 않고 즉시 중단한다.
     (아무것도 검사하지 않고 "문제 없음"을 출력하는 것이 가장 위험하다) */
var SKIP_DIR = /^(node_modules|\.git|dist|build|\.next|coverage)$/i;
function listJs(dir) {
  var out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (e.isDirectory() && SKIP_DIR.test(e.name)) return;   // 라이브러리 폴더는 건너뛴다
    var p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listJs(p));
    else if (/\.js$/i.test(e.name)) out.push(p);
  });
  return out;
}
function expand(a) {
  var norm = a.replace(/\\/g, '/');
  if (/[*?]/.test(norm)) {
    var dir = path.dirname(norm), pat = path.basename(norm);
    if (!fs.existsSync(dir)) return [];
    var rx = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return fs.readdirSync(dir).filter(function (f) { return rx.test(f); })
             .map(function (f) { return path.join(dir, f); })
             .filter(function (f) { return fs.statSync(f).isFile(); });
  }
  if (fs.existsSync(norm)) return fs.statSync(norm).isDirectory() ? listJs(norm) : [norm];
  return [];
}
function looksLikePath(a) { return /[\\/]|[*?]|\.js$/i.test(a); }

var files = [], only = null, badArgs = [];
args.forEach(function (a) {
  if (looksLikePath(a)) {
    var got = expand(a);
    if (!got.length) badArgs.push(a);
    else files = files.concat(got);
  } else if (!only) only = a;
});
if (badArgs.length) {
  console.error('★ 다음 인자에서 .js 파일을 찾지 못했습니다:');
  badArgs.forEach(function (a) { console.error('   ' + a); });
  console.error('\n  · 경로에 공백이 있으면 따옴표로 감싸세요.');
  console.error('  · 폴더 경로를 그대로 넘겨도 됩니다(하위 폴더까지 훑습니다).');
  console.error('  · Windows 경로의 역슬래시(\\)는 그대로 두어도 됩니다.');
  process.exit(2);
}
files = files.filter(function (f, i) { return files.indexOf(f) === i; });

global.window = {};

/* ── 임의 파일에서 문항을 끌어내는 로더 ────────────────────── */
function looksLikeQ(o) {
  return o && typeof o === 'object' && !Array.isArray(o) &&
    typeof (o.q !== undefined ? o.q : o.question) === 'string' &&
    Array.isArray(o.opts || o.options || o.choices);
}
function normalizeQ(o) {
  // 필드명이 다른 전사물도 받아들인다
  var n = {};
  n.q = o.q !== undefined ? o.q : o.question;
  n.opts = o.opts || o.options || o.choices;
  n.answer = o.answer !== undefined ? o.answer : o.ans;
  n.why = o.why !== undefined ? o.why : (o.explain !== undefined ? o.explain : o.해설);
  if (o.cond !== undefined) n.cond = o.cond;
  if (o.table !== undefined) n.table = o.table;
  if (o.fix !== undefined) n.fix = o.fix;
  return n;
}

function loadFile(file) {
  var collected = [];   // {group, q}
  var src = fs.readFileSync(file, 'utf8');

  // addQ 계열 호출을 가로채는 shim. 인자 어디에 문항 객체가 있어도 잡아낸다.
  function shim(name) {
    return function () {
      var ctx = [], objs = [];
      for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        if (typeof a === 'string') ctx.push(a);
        else if (Array.isArray(a)) a.forEach(function (x) { if (looksLikeQ(x)) objs.push(x); });
        else if (looksLikeQ(a)) objs.push(a);
      }
      var group = ctx.length ? ctx.join('.') : name;
      objs.forEach(function (o) { collected.push({ group: group, q: normalizeQ(o) }); });
    };
  }
  ['addQ', 'addQuestion', 'addItem', 'add'].forEach(function (n) { global[n] = shim(n); });

  var scope = {};
  delete global.AREAS;             // 이전 파일의 잔재가 섞이지 않도록
  var before = Object.keys(global);

  // ① 먼저 전역 스코프에서 실행한다.
  //    간접 eval이라 `var AREAS = {...}` 같은 선언이 globalThis에 붙어 밖에서도 보인다.
  var ranGlobal = false;
  try { (0, eval)(src); ranGlobal = true; }
  catch (e) {
    // module.exports / require 를 쓰는 파일은 CommonJS 래퍼로 재시도
    try {
      var m = { exports: {} };
      (new Function('module', 'exports', 'require', 'window', 'addQ', 'addQuestion', 'addItem', 'add', src))
        (m, m.exports, require, global.window, global.addQ, global.addQuestion, global.addItem, global.add);
      scope.exported = m.exports;
    } catch (e2) {
      console.error('★ ' + file + ' 을(를) 읽지 못했습니다: ' + e2.message);
      return { areas: null, flat: [] };
    }
  }

  // ② AREAS 구조가 잡혔으면 그대로 사용
  var areasObj = global.AREAS || (scope.exported && scope.exported.AREAS) || null;
  if (areasObj && !collected.length) return { areas: areasObj, flat: [] };

  // 전역에 새로 생긴 값들도 탐색 대상에 넣는다
  if (ranGlobal) {
    scope.globals = {};
    Object.keys(global).forEach(function (k) {
      if (before.indexOf(k) < 0) scope.globals[k] = global[k];
    });
  }

  // ② addQ로 모인 것이 있으면 그것을 사용
  if (collected.length) return { areas: null, flat: collected };

  // ③ 전역/exports에 남은 문항 배열을 찾는다
  var pools = [];
  function scan(obj, prefix, depth) {
    if (!obj || depth > 3) return;
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (Array.isArray(v) && v.length && v.every(looksLikeQ)) pools.push({ group: prefix + k, list: v });
      else if (v && typeof v === 'object' && !Array.isArray(v)) scan(v, prefix + k + '.', depth + 1);
    });
  }
  if (scope.exported && typeof scope.exported === 'object') scan(scope.exported, '', 0);
  if (Array.isArray(scope.exported) && scope.exported.every(looksLikeQ))
    pools.push({ group: 'exports', list: scope.exported });
  if (scope.globals) scan(scope.globals, '', 0);
  pools.forEach(function (p) {
    p.list.forEach(function (o) { collected.push({ group: p.group, q: normalizeQ(o) }); });
  });
  return { areas: null, flat: collected };
}

/* ── 입력 결정 ─────────────────────────────────────────────── */
var FLAT = [];              // 파일 기반 검사용
var SRCLABEL = {};          // 그룹 → 출처 파일
if (files.length) {
  files.forEach(function (f) {
    var r = loadFile(f);
    var base = path.basename(f);
    if (r.areas) {
      // AREAS 파일이면 표준 경로로 검사하도록 전역에 실어 준다
      global.AREAS = r.areas;
      FLAT.push({ __areas: r.areas, __file: base });
    } else {
      r.flat.forEach(function (item) {
        FLAT.push({ group: base + ' :: ' + item.group, q: item.q });
        SRCLABEL[base] = (SRCLABEL[base] || 0) + 1;
      });
    }
  });
} else {
  eval(fs.readFileSync(__dirname + '/ncs-data.js', 'utf8'));
  if (only && !AREAS[only]) {
    console.error('★ "' + only + '" 은(는) 영역 키가 아닙니다.');
    console.error('  사용 가능한 영역: ' + Object.keys(AREAS).join(', '));
    console.error('  파일을 검사하려면 파일이나 폴더 경로를 넘기세요.');
    process.exit(2);
  }
}

var issues = [];   // {sev, area, loc, msg}
var seenQ = {};    // 중복 문두 탐지
var stat = { total: 0, opt4: 0, opt5: 0, other: 0, withCond: 0, withTable: 0, fixed: 0, whyLen: [] };

function bad(sev, area, loc, msg) { issues.push({ sev: sev, area: area, loc: loc, msg: msg }); }

function checkQ(area, loc, q) {
  stat.total++;

  // ── 스키마 ──
  if (typeof q.q !== 'string' || !q.q.trim()) return bad('치명', area, loc, '문두(q)가 비어 있음');
  if (!Array.isArray(q.opts)) return bad('치명', area, loc, 'opts가 배열이 아님');

  var n = q.opts.length;
  if (n === 4) stat.opt4++; else if (n === 5) stat.opt5++; else {
    stat.other++;
    bad('치명', area, loc, '보기 개수가 ' + n + '개 (4 또는 5여야 함)');
  }

  // ── 정답 인덱스 ──
  if (typeof q.answer !== 'number' || !Number.isInteger(q.answer)) {
    bad('치명', area, loc, 'answer가 정수가 아님: ' + JSON.stringify(q.answer));
  } else if (q.answer < 0 || q.answer >= n) {
    bad('치명', area, loc, 'answer 범위 초과: ' + q.answer + ' (보기 ' + n + '개)');
  }

  // ── 보기 내용 ──
  q.opts.forEach(function (o, i) {
    if (typeof o !== 'string' || !o.trim()) bad('치명', area, loc, '보기 ' + (i + 1) + '이 비어 있음');
  });
  var dup = q.opts.filter(function (o, i) { return q.opts.indexOf(o) !== i; });
  if (dup.length) bad('치명', area, loc, '보기 중복: ' + JSON.stringify(dup[0]));

  // ── 해설 ──
  if (typeof q.why !== 'string' || !q.why.trim()) {
    bad('중간', area, loc, '해설(why)이 없음');
  } else {
    stat.whyLen.push(q.why.length);
    if (q.why.length < 10) bad('중간', area, loc, '해설이 너무 짧음(' + q.why.length + '자): ' + q.why);
  }

  // ── 표 정합성 ──
  if (q.table) {
    stat.withTable++;
    if (!q.table.head || !Array.isArray(q.table.head)) bad('치명', area, loc, 'table.head가 배열이 아님');
    else if (!Array.isArray(q.table.rows)) bad('치명', area, loc, 'table.rows가 배열이 아님');
    else q.table.rows.forEach(function (r, ri) {
      if (!Array.isArray(r)) bad('치명', area, loc, 'table.rows[' + ri + ']가 배열이 아님');
      else if (r.length !== q.table.head.length)
        bad('치명', area, loc, 'table 열 수 불일치: head ' + q.table.head.length + '개 vs row' + ri + ' ' + r.length + '개');
    });
  }
  if (q.cond) stat.withCond++;
  if (q.fix) stat.fixed++;

  // ── 해설이 보기 번호를 가리키는데 보기가 셔플되면 번호가 어긋난다 ──
  // shuffleQ는 fix가 없는 문항의 보기 순서를 섞으므로, 해설의 "①번" 같은 참조가 무효가 된다.
  if (q.why && /[①②③④⑤]번/.test(q.why) && !q.fix)
    bad('치명', area, loc, '해설이 보기 번호(' + q.why.match(/[①②③④⑤]번/)[0] + ')를 참조하는데 fix:true가 없음 — 셔플 시 해설이 어긋남');

  // ── 깨진 문자 ──
  if (/[�□]/.test(q.q + (q.cond || '') + q.opts.join('') + (q.why || '')))
    bad('중간', area, loc, '깨진 문자(￿ 또는 □) 포함');

  // ── 문항 중복(다른 영역 간 포함) — 지문·표까지 같아야 중복으로 본다 ──
  var key = (q.q + '|' + (q.cond || '') + '|' + JSON.stringify(q.table || null) + '|' + q.opts.join('|')).replace(/\s/g, '');
  if (seenQ[key]) bad('중간', area, loc, '문항 중복 — ' + seenQ[key] + ' 와 동일');
  else seenQ[key] = area + ' ' + loc;
}

// ── 순회 ──
// 정답 편향은 보기 순서가 고정된(fix) 문항에서만 의미가 있다.
// fix가 없는 문항은 출제 시 shuffleQ가 보기를 섞으므로 원본 인덱스 분포는 무의미하다.
var answerHist = {};
function tally(ak, q) {
  if (!q.fix || typeof q.answer !== 'number') return;
  answerHist[ak] = answerHist[ak] || {};
  answerHist[ak][q.answer] = (answerHist[ak][q.answer] || 0) + 1;
}
function walkAreas(A) {
  Object.keys(A).forEach(function (ak) {
    if (only && ak !== only) return;
    var a = A[ak];
    if (!a.games || !a.games.order) return bad('치명', ak, '-', 'games.order 없음');

    a.games.order.forEach(function (gk) {
      var gm = a.games[gk];
      if (!gm) return bad('치명', ak, 'games.' + gk, 'order에 있으나 정의되지 않음');
      ['basic', 'hard'].forEach(function (lv) {
        (gm[lv] || []).forEach(function (q, i) {
          checkQ(ak, 'games.' + gk + '.' + lv + '[' + i + ']', q);
          tally(ak, q);
        });
      });
    });
    ['basic', 'hard'].forEach(function (lv) {
      ((a.cbt || {})[lv] || []).forEach(function (q, i) {
        checkQ(ak, 'cbt.' + lv + '[' + i + ']', q);
        tally(ak, q);
      });
    });
  });
}

// 그룹별 문항 수(파일 기반 검사에서 보고용)
var groupCount = {};

if (files.length) {          // 파일을 넘겼으면 문항이 0건이더라도 파일 모드로 처리한다
  var idxOf = {};
  FLAT.forEach(function (item) {
    if (item.__areas) { walkAreas(item.__areas); return; }
    var g = item.group;
    idxOf[g] = (idxOf[g] || 0);
    groupCount[g] = (groupCount[g] || 0) + 1;
    checkQ(g, '[' + idxOf[g] + ']', item.q);
    tally(g, item.q);
    idxOf[g]++;
  });
} else {
  walkAreas(AREAS);
}

// ── 정답 편향 ──
Object.keys(answerHist).forEach(function (ak) {
  var h = answerHist[ak], sum = 0, max = 0, maxi = 0;
  Object.keys(h).forEach(function (k) { sum += h[k]; if (h[k] > max) { max = h[k]; maxi = k; } });
  var pct = Math.round(max / sum * 100);
  // 금액·일수처럼 오름차순 보기는 정답이 가운데 몰리는 것이 정상이므로 임계를 넉넉히 둔다.
  // 이 검사의 목적은 0-based/1-based 혼동 같은 극단적 쏠림 탐지다.
  if (sum >= 8 && pct > 55)
    bad('경미', ak, '-', '보기고정 문항의 정답 편향: ' + (+maxi + 1) + '번이 ' + pct + '% (' + max + '/' + sum + ')');
});

// ── 출력 ──
var order = { '치명': 0, '중간': 1, '경미': 2 };
issues.sort(function (x, y) { return order[x.sev] - order[y.sev]; });

console.log('══════ 문항 통계 ══════');
if (files.length) {
  var names = files.map(function (f) { return path.basename(f); });
  console.log('검사 파일      ' + files.length + '개' +
    (names.length <= 12 ? ': ' + names.join(', ') : ': ' + names.slice(0, 12).join(', ') + ' … 외 ' + (names.length - 12) + '개'));
}
console.log('총 문항        ' + stat.total);
console.log('보기 4지 / 5지 ' + stat.opt4 + ' / ' + stat.opt5 + (stat.other ? ' / 기타 ' + stat.other : ''));
console.log('지문(cond) 있음 ' + stat.withCond + '   표(table) 있음 ' + stat.withTable + '   보기고정(fix) ' + stat.fixed);
var wl = stat.whyLen;
if (wl.length) {
  wl.sort(function (a, b) { return a - b; });
  var avg = Math.round(wl.reduce(function (a, b) { return a + b; }, 0) / wl.length);
  console.log('해설 길이       평균 ' + avg + '자 / 최단 ' + wl[0] + '자 / 중앙 ' + wl[Math.floor(wl.length / 2)] + '자');
}

var gk = Object.keys(groupCount);
if (gk.length) {
  console.log('\n══════ 그룹별 문항 수 ══════');
  gk.sort().forEach(function (g) { console.log('  ' + g + '  —  ' + groupCount[g] + '문항'); });
}

console.log('\n══════ 검사 결과 ══════');
if (stat.total === 0) {
  // 검사 대상이 0건인데 "문제 없음"을 내보내면 통과한 것으로 오해하게 된다.
  console.error('★ 검사한 문항이 0건입니다. 아무것도 확인되지 않았습니다.');
  console.error('  파일은 읽혔지만 문항을 찾지 못했을 수 있습니다. 다음을 확인하세요:');
  console.error('   · 문항 객체에 q(또는 question)와 opts(또는 options/choices)가 있는지');
  console.error('   · addQ 계열 함수 이름이 addQ/addQuestion/addItem/add 중 하나인지');
  console.error('   · 파일이 문항 데이터가 맞는지(엔진·설정 파일을 넘기지 않았는지)');
  process.exit(2);
}
if (!issues.length) {
  console.log('문제 없음 ✓');
} else {
  var cnt = { '치명': 0, '중간': 0, '경미': 0 };
  issues.forEach(function (b) { cnt[b.sev]++; });
  console.log('치명 ' + cnt['치명'] + ' · 중간 ' + cnt['중간'] + ' · 경미 ' + cnt['경미'] + '\n');
  issues.forEach(function (b) {
    console.log('[' + b.sev + '] ' + b.area + ' ' + b.loc + ' — ' + b.msg);
  });
}
process.exit(issues.filter(function (b) { return b.sev === '치명'; }).length ? 1 : 0);
