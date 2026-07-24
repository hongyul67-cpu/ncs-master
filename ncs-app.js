/* ═══════════════════════════════════════════════════════════
   ncs-app.js — 공유 엔진 (모든 영역이 이 하나를 재사용)
   ═══════════════════════════════════════════════════════════ */
var STATE = { area:null, level:'basic' };
function A(){ return AREAS[STATE.area]; }
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function lvTxt(){ return STATE.level==='basic'?'기초':'심화'; }
function buildTable(t){
  if(!t) return '';
  var h='<table class="dtable"><tr>'+t.head.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr>';
  h+=t.rows.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+esc(c)+'</td>';}).join('')+'</tr>';}).join('');
  return h+'</table>';
}

/* ── 랜덤 셔플 (풀 때마다 문제·보기 순서가 달라짐) ── */
function shuffle(arr){
  var a=arr.slice();
  for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function shuffleQ(q){
  // 보기 순서를 섞고 정답 인덱스를 다시 매핑. "위 모두 옳다"류 집계형 보기만 고정.
  var lock = q.opts.some(function(o){ return /모두 (옳|맞|정답|해당)|위 모두|위의? 모두/.test(o); });
  if(lock) return Object.assign({}, q);
  var idx = q.opts.map(function(_,i){return i;});
  idx = shuffle(idx);
  var newOpts = idx.map(function(i){return q.opts[i];});
  var newAns = idx.indexOf(q.answer);
  return Object.assign({}, q, {opts:newOpts, answer:newAns});
}
function makeSet(list){ return shuffle(list).map(shuffleQ); }

/* ── 라이브 타이머 (속도 시험 대비) ── */
function fmtTime(sec){ var m=Math.floor(sec/60), s=sec%60; return m+':'+(s<10?'0':'')+s; }
var _clockId=null;
function startClock(elId){
  stopClock();
  var t0=Date.now();
  function tick(){
    var el=document.getElementById(elId); if(!el) return;
    var sec=Math.floor((Date.now()-t0)/1000);
    el.textContent='⏱ '+fmtTime(sec);
    el.classList.toggle('warn', sec>=60);   // 1분 넘으면 붉게(속도 경고)
  }
  tick(); _clockId=setInterval(tick,1000);
  return t0;
}
function stopClock(){ if(_clockId){ clearInterval(_clockId); _clockId=null; } }

/* ── 진행 상황 저장 (같은 기기에서 이어서 / 초기화) ── */
var PROG_KEY='ncs_progress_v1';
var PROG={level:'basic', lastArea:null, areas:{}, mockBest:0};
function loadProg(){
  try{ var p=JSON.parse(localStorage.getItem(PROG_KEY)); if(p&&typeof p==='object'){ PROG=Object.assign(PROG,p); if(!PROG.areas)PROG.areas={}; } }catch(e){}
}
function saveProg(){ try{ localStorage.setItem(PROG_KEY, JSON.stringify(PROG)); }catch(e){} }
function areaProg(k){ if(!PROG.areas[k]) PROG.areas[k]={games:{},cbt:{}}; return PROG.areas[k]; }
function recordGame(area,gameKey,score){ var a=areaProg(area); a.games[gameKey]=Math.max(a.games[gameKey]||0,score); saveProg(); }
function recordCbt(area,level,score){ var a=areaProg(area); a.cbt[level]=Math.max(a.cbt[level]||0,score); saveProg(); }
function recordMock(score){ PROG.mockBest=Math.max(PROG.mockBest||0,score); saveProg(); }
function resetProgress(){
  if(!confirm('학습 기록(최고 점수·이어서 정보)을 모두 지울까요? 되돌릴 수 없습니다.')) return;
  PROG={level:'basic', lastArea:null, areas:{}, mockBest:0};
  try{ localStorage.removeItem(PROG_KEY); }catch(e){}
  setLevel('basic');
  if(STATE.area){ renderGameTiles(); }
  renderAreaCards(); renderHubExtras();
  alert('학습 기록을 초기화했습니다.');
}

/* ── 화면 전환 ── */
function setLevel(lv){
  STATE.level=lv;
  document.getElementById('lvBasic').classList.toggle('on',lv==='basic');
  var h=document.getElementById('lvHard');
  h.classList.toggle('on',lv==='hard'); h.classList.toggle('hard',lv==='hard');
  document.querySelectorAll('.lvtxt').forEach(function(e){e.textContent=lvTxt();});
  PROG.level=lv; saveProg();
  if(STATE.area){ renderLearn(); renderGameTiles(); renderSolve(); }
  // 진행 중 화면은 리셋해 혼선 방지
  if(document.getElementById('play').classList.contains('on')) quitGame();
  if(document.getElementById('cbt').classList.contains('on')) resetCbt();
}
function goHub(){
  STATE.area=null;
  document.getElementById('abar').classList.remove('on');
  document.getElementById('nav').classList.remove('on');
  showView('hub');
}
function selectArea(key){
  if(!AREAS[key] || !AREAS[key].ready) return;
  STATE.area=key;
  var a=A();
  var chip=document.getElementById('achip');
  chip.innerHTML='<span style="font-size:16px">'+a.ic+'</span> '+esc(a.name);
  chip.style.borderColor=a.color;
  document.getElementById('abar').classList.add('on');
  document.getElementById('nav').classList.add('on');
  document.getElementById('cbtTip').innerHTML=a.tip||'';
  PROG.lastArea=key; saveProg();
  renderLearn(); renderGameTiles(); renderSolve();
  go('learn');
}
function showView(v){
  document.querySelectorAll('.view').forEach(function(s){s.classList.remove('on')});
  document.getElementById(v).classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'});
}
function go(v){
  showView(v);
  document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('on',b.dataset.v===v)});
}

/* ── 허브: 영역 카드 ── */
function renderAreaCards(){
  var box=document.getElementById('areaCards');
  box.innerHTML=Object.keys(AREAS).map(function(key){
    var a=AREAS[key];
    var cls='acard'+(a.ready?'':' soon');
    var ap=PROG.areas[key];
    var played=ap?(Object.keys(ap.games||{}).length + Object.keys(ap.cbt||{}).length):0;
    var st;
    if(!a.ready) st='<div class="st soon">🔒 준비 중</div>';
    else if(played>0) st='<div class="st ready">✓ 학습 중 · 이어서 ▶</div>';
    else st='<div class="st ready">▶ 시작하기</div>';
    var bar=a.ready?'<div class="bar" style="background:'+a.color+'"></div>':'';
    return '<button class="'+cls+'" '+(a.ready?'onclick="selectArea(\''+key+'\')"':'disabled')+'>'+
      bar+'<div class="ico">'+a.ic+'</div><div class="t">'+esc(a.name)+'</div>'+
      '<div class="d">'+esc(a.desc)+'</div>'+st+'</button>';
  }).join('');
}
function renderHubExtras(){
  var rb=document.getElementById('resumeBar'); if(!rb) return;
  var la=PROG.lastArea;
  var html='';
  if(la && AREAS[la] && AREAS[la].ready){
    html+='<button class="btn primary" style="margin-top:8px" onclick="selectArea(\''+la+'\')">↩️ 이어서 하기 · '+esc(AREAS[la].name)+'</button>';
  }
  rb.innerHTML=html;
}

/* ── 배우기 ── */
function renderLearn(){
  var box=document.getElementById('learnList');
  box.innerHTML=A().learn.map(function(t,i){
    var tag=STATE.level==='basic'?'<span class="tag b">기초</span>':'<span class="tag h">심화</span>';
    return '<div class="lk" id="lk'+i+'"><button onclick="toggleLk('+i+')">'+
      '<span class="ci">'+t.ic+'</span>'+esc(t.title)+tag+'<span class="ar">▶</span></button>'+
      '<div class="body">'+(STATE.level==='basic'?t.basic:t.hard)+'</div></div>';
  }).join('');
}
function toggleLk(i){ document.getElementById('lk'+i).classList.toggle('open'); }

/* ── 게임 ── */
function renderGameTiles(){
  var g=A().games, box=document.getElementById('gameTiles');
  var ap=PROG.areas[STATE.area]||{games:{}};
  box.innerHTML=g.order.map(function(k){
    var gm=g[k], n=gm[STATE.level].length;
    var best=(ap.games||{})[k];
    var badge=(best!=null)?'<span style="color:var(--green);font-weight:800"> · ✓ 최고 '+best+'점</span>':'';
    return '<button class="tile" onclick="startGame(\''+k+'\')">'+
      '<div class="ico">'+gm.ic+'</div><div class="t">'+esc(gm.name)+'</div>'+
      '<div class="d">'+esc(gm.desc)+'</div>'+
      '<div class="go">'+n+'문항 · '+lvTxt()+badge+' →</div></button>';
  }).join('');
}
var gState=null;
function startGame(key){
  var gm=A().games[key];
  gState={key:key, list:makeSet(gm[STATE.level]), i:0, correct:0, name:gm.name};
  FX.reset();
  document.getElementById('playHome').classList.add('hidden');
  document.getElementById('playRun').classList.remove('hidden');
  FX.hud(document.getElementById('hud'));
  gState.t0=startClock('gTimer');
  renderGQ();
}
function renderGQ(){
  var s=gState, q=s.list[s.i];
  document.getElementById('gProg').style.width=(s.i/s.list.length*100)+'%';
  var cond=q.cond?'<div class="qcond">'+esc(q.cond)+'</div>':'';
  var table=buildTable(q.table);
  var opts=q.opts.map(function(o,idx){
    return '<button class="opt" onclick="answerG('+idx+')"><span class="k">'+
      String.fromCharCode(9312+idx)+'</span><span>'+esc(o)+'</span></button>';
  }).join('');
  document.getElementById('gCard').innerHTML=
    '<div class="qmeta">'+esc(s.name)+' · '+(s.i+1)+' / '+s.list.length+'</div>'+
    '<div class="qtext">'+esc(q.q)+'</div>'+cond+table+
    '<div class="opts">'+opts+'</div><div class="fb" id="gFb"></div>';
}
function answerG(idx){
  var s=gState, q=s.list[s.i];
  var btns=document.querySelectorAll('#gCard .opt');
  btns.forEach(function(b){b.disabled=true;});
  var fb=document.getElementById('gFb');
  if(idx===q.answer){
    btns[idx].classList.add('ok'); s.correct++; FX.ok(btns[idx]);
    fb.className='fb good show'; fb.innerHTML='<b>정답!</b> '+esc(q.why);
  }else{
    btns[idx].classList.add('no'); btns[q.answer].classList.add('ok'); FX.no(btns[idx]);
    fb.className='fb bad show';
    fb.innerHTML='<b>아쉬워요.</b> 정답은 '+String.fromCharCode(9312+q.answer)+'. '+esc(q.why);
  }
  var next=document.createElement('button');
  next.className='btn primary';
  next.textContent=(s.i+1<s.list.length)?'다음 문제 →':'결과 보기';
  next.onclick=nextG;
  document.getElementById('gCard').appendChild(next);
}
function nextG(){
  var s=gState; s.i++;
  if(s.i<s.list.length){ renderGQ(); return; }
  document.getElementById('gProg').style.width='100%';
  stopClock();
  var dur=Math.round((Date.now()-s.t0)/1000);
  var perQ=(dur/s.list.length).toFixed(1);
  var miss=s.list.length-s.correct, stars=FX.starsFor(miss);
  if(STATE.area) recordGame(STATE.area, s.key, Math.round(s.correct/s.list.length*100));
  FX.banner({
    icon: stars===3?'🏆':(stars===2?'🎉':(stars>=1?'👍':'💪')),
    title: s.name+' 완료!',
    sub: s.list.length+'문제 중 <b>'+s.correct+'개</b> 정답 · ⏱ <b>'+fmtTime(dur)+'</b> (문항당 '+perQ+'초)<br>점수 <b>'+FX.score()+'</b> · 최고 콤보 <b>'+FX.best()+'</b>',
    stars: stars, btn:'게임 목록으로',
    onClose:function(){
      quitGame();
      if(window.ResultCollector && ResultCollector.config.endpoint){
        setTimeout(function(){
          ResultCollector.open({correct:s.correct,total:s.list.length,score:FX.score(),durationSec:dur,labels:{correct:'정답'}});
        },300);
      }
    }
  });
}
function quitGame(){
  stopClock();
  gState=null;
  document.getElementById('playRun').classList.add('hidden');
  document.getElementById('playHome').classList.remove('hidden');
}

/* ── 실전 점검 / 모의고사 공용 시험 엔진 ── */
var cbtState=null;
var CBT_DOM={run:'cbtRun',result:'cbtResult',home:'cbtHome',list:'cbtList',bar:'cbtBar',timer:'cbtTimer',score:'cbtScore',correct:'cbtCorrect',total:'cbtTotal',time:'cbtTime',wrong:'cbtWrong'};
var MOCK_DOM={run:'mockRun',result:'mockResult',home:'mockHome',list:'mockList',bar:'mockBar',timer:'mockTimer',score:'mockScore',correct:'mockCorrect',total:'mockTotal',time:'mockTime',wrong:'mockWrong'};

function starsByScore(score){ return score>=90?3:(score>=75?2:(score>=60?1:0)); }

function startExam(list, dom, qp, label){
  cbtState={list:list, picks:new Array(list.length).fill(-1), t0:0, dom:dom, qp:qp, label:label};
  document.getElementById(dom.home).classList.add('hidden');
  document.getElementById(dom.result).classList.add('hidden');
  document.getElementById(dom.run).classList.remove('hidden');
  renderExam();
  updateExamBar();
  cbtState.t0=startClock(dom.timer);
  window.scrollTo({top:0,behavior:'smooth'});
}
function startCbt(){ startExam(makeSet(A().cbt[STATE.level]), CBT_DOM, 'cq', A().name+' 점검'); cbtState.rec={kind:'cbt', area:STATE.area, level:STATE.level}; }
function renderExam(){
  var s=cbtState, qp=s.qp;
  document.getElementById(s.dom.list).innerHTML=s.list.map(function(q,qi){
    var cond=q.cond?'<div class="cnd">'+esc(q.cond)+'</div>':'';
    var table=buildTable(q.table);
    var src=q._src?' <span style="color:var(--dim);font-weight:600">· '+esc(q._src)+'</span>':'';
    var opts=q.opts.map(function(o,oi){
      return '<label data-o="'+oi+'"><input type="radio" name="'+qp+qi+'" onchange="pickExam('+qi+','+oi+')">'+
        '<span><b style="color:var(--cyan)">'+String.fromCharCode(9312+oi)+'</b> '+esc(o)+'</span></label>';
    }).join('');
    return '<div class="cbtq" id="'+qp+qi+'"><div class="num">Q'+(qi+1)+src+'</div>'+
      '<div class="qt">'+esc(q.q)+'</div>'+cond+table+
      '<div class="cbto">'+opts+'</div><div class="sol" id="sol_'+qp+qi+'"></div></div>';
  }).join('');
}
function pickExam(qi,oi){
  var s=cbtState; s.picks[qi]=oi;
  document.querySelectorAll('#'+s.qp+qi+' .cbto label').forEach(function(l){ l.classList.toggle('pick',+l.dataset.o===oi); });
  updateExamBar();
}
function updateExamBar(){
  if(!cbtState) return;
  var done=cbtState.picks.filter(function(p){return p>=0;}).length;
  var bar=document.getElementById(cbtState.dom.bar);
  if(bar) bar.innerHTML='진행 <b>'+done+' / '+cbtState.list.length+'</b> 문항'+
    (done<cbtState.list.length?' · 끝까지 풀고 채점하세요':' · 채점 준비 완료!');
}
function gradeCbt(){
  var s=cbtState, un=s.picks.indexOf(-1);
  if(un>-1){
    var el=document.getElementById(s.qp+un);
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.animate([{boxShadow:'0 0 0 2px var(--red)'},{boxShadow:'0 0 0 0 transparent'}],{duration:900});
    return;
  }
  stopClock();
  var correct=0, wrong=[];
  s.list.forEach(function(q,qi){
    var pick=s.picks[qi];
    document.querySelectorAll('#'+s.qp+qi+' .cbto label').forEach(function(l){
      l.querySelector('input').disabled=true;
      var oi=+l.dataset.o;
      if(oi===q.answer) l.classList.add('correct');
      if(oi===pick && pick!==q.answer) l.classList.add('wrong');
    });
    var sol=document.getElementById('sol_'+s.qp+qi); sol.className='sol show';
    if(pick===q.answer){ correct++; sol.innerHTML='<b>정답 ✔</b> '+esc(q.why); }
    else{ wrong.push(qi+1); sol.innerHTML='<b>정답: '+String.fromCharCode(9312+q.answer)+'</b> '+esc(q.why); }
  });
  var dur=Math.round((Date.now()-s.t0)/1000), score=Math.round(correct/s.list.length*100);
  s.result={correct:correct,total:s.list.length,score:score,wrong:wrong,durationSec:dur};
  if(s.rec){
    if(s.rec.kind==='cbt') recordCbt(s.rec.area,s.rec.level,score);
    else if(s.rec.kind==='mock') recordMock(score);
    else if(s.rec.kind==='mockRound'){ if(!PROG.mockRounds)PROG.mockRounds={}; PROG.mockRounds[s.rec.idx]=Math.max(PROG.mockRounds[s.rec.idx]||0,score); saveProg(); }
  }
  document.getElementById(s.dom.run).classList.add('hidden');
  document.getElementById(s.dom.result).classList.remove('hidden');
  document.getElementById(s.dom.score).textContent=score;
  document.getElementById(s.dom.correct).textContent=correct;
  document.getElementById(s.dom.total).textContent=s.list.length;
  document.getElementById(s.dom.time).textContent=dur;
  document.getElementById(s.dom.wrong).innerHTML=wrong.length
    ? '틀린 문제: '+wrong.map(function(n){return 'Q'+n;}).join(', ') : '🎉 전부 맞혔어요!';
  FX.banner({
    icon: score>=90?'🏆':(score>=70?'🎉':'💪'),
    title:(s.label||'점검')+' · '+score+'점',
    sub:s.list.length+'문제 중 <b>'+correct+'개</b> 정답 · ⏱ '+fmtTime(dur),
    stars:starsByScore(score), btn:'결과 확인'
  });
  window.scrollTo({top:0,behavior:'smooth'});
}
function submitExam(){
  if(!cbtState||!cbtState.result) return;
  var r=cbtState.result;
  if(window.ResultCollector){ ResultCollector.open({correct:r.correct,total:r.total,score:r.score,wrong:r.wrong,durationSec:r.durationSec}); }
  else{ alert('결과 제출 기능은 선생님이 배포한 링크에서 활성화됩니다.'); }
}
function reviewCbt(){
  document.getElementById(cbtState.dom.result).classList.add('hidden');
  document.getElementById(cbtState.dom.run).classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}
function resetCbt(){
  stopClock();
  var dom=cbtState?cbtState.dom:CBT_DOM;
  cbtState=null;
  document.getElementById(dom.run).classList.add('hidden');
  document.getElementById(dom.result).classList.add('hidden');
  document.getElementById(dom.home).classList.remove('hidden');
}

/* ── 모의고사 (분야 선택 · 추천 세트) ── */
var RECO_SETS=[
  {name:'필수과목 4종 (최우선)', areas:['comm','math','problem','resource'], desc:'대부분의 기업이 출제 — 의사소통·수리·문제해결·자원관리'},
  {name:'전략과목 6종', areas:['self','relation','info','tech','org','ethic'], desc:'기업에 따라 출제 — 자기개발·대인관계·정보·기술·조직이해·직업윤리'},
  {name:'사무직 종합', areas:['comm','math','problem','resource','org','info'], desc:'사무 직군 대비'},
  {name:'기술직 종합', areas:['comm','math','problem','resource','tech','info'], desc:'기술 직군 대비'},
  {name:'전 영역 모의고사', areas:['comm','math','problem','self','resource','relation','info','tech','org','ethic'], desc:'NCS 10개 영역 전체'}
];
var mockSel={};
function goMock(){
  STATE.area=null;
  document.getElementById('abar').classList.remove('on');
  document.getElementById('nav').classList.remove('on');
  showView('mock');
  resetMockConfig();
}
function resetMockConfig(){
  document.getElementById('mockRun').classList.add('hidden');
  document.getElementById('mockResult').classList.add('hidden');
  document.getElementById('mockHome').classList.remove('hidden');
  renderMockConfig();
}
function renderMockConfig(){
  // 추천 세트
  document.getElementById('mockReco').innerHTML=RECO_SETS.map(function(r,i){
    return '<button class="recobtn" onclick="applyReco('+i+')"><b>⭐ '+esc(r.name)+'</b><span>'+esc(r.desc)+'</span></button>';
  }).join('');
  renderMockRounds();
  // 분야 체크박스
  document.getElementById('mockAreas').innerHTML=Object.keys(AREAS).filter(function(k){return AREAS[k].ready;}).map(function(k){
    var a=AREAS[k], on=mockSel[k]?' on':'';
    return '<label class="chk'+on+'" id="chk-'+k+'"><input type="checkbox" '+(mockSel[k]?'checked':'')+' onchange="toggleMock(\''+k+'\',this.checked)"> '+a.ic+' '+esc(a.name)+'</label>';
  }).join('');
  updateMockInfo();
}
function toggleMock(k,on){ if(on) mockSel[k]=true; else delete mockSel[k];
  var el=document.getElementById('chk-'+k); if(el) el.classList.toggle('on',!!on); updateMockInfo(); }
function applyReco(i){
  mockSel={}; RECO_SETS[i].areas.forEach(function(k){ if(AREAS[k]&&AREAS[k].ready) mockSel[k]=true; });
  renderMockConfig();
}
function mockPool(areaKeys, mode){
  var pool=[];
  areaKeys.forEach(function(k){
    var a=AREAS[k]; if(!a) return;
    a.cbt.hard.forEach(function(q){ pool.push(Object.assign({},q,{_src:a.name})); });
    if(mode==='real'){
      if(a.games.combo) a.games.combo.basic.concat(a.games.combo.hard).forEach(function(q){ pool.push(Object.assign({},q,{_src:a.name+' 복합'})); });
      if(a.games.real5) a.games.real5.basic.concat(a.games.real5.hard).forEach(function(q){ pool.push(Object.assign({},q,{_src:a.name+' 실전'})); });
    }
  });
  return pool;
}

/* 실전 모의고사 10회 (회차별 프리셋) */
var ALL10=['comm','math','problem','self','resource','relation','info','tech','org','ethic'];
var ESS4=['comm','math','problem','resource'];
var MOCK_ROUNDS=[
  {name:'1회 · 필수과목', areas:ESS4, count:20},
  {name:'2회 · 필수과목', areas:ESS4, count:20},
  {name:'3회 · 필수과목', areas:ESS4, count:20},
  {name:'4회 · 필수과목', areas:ESS4, count:25},
  {name:'5회 · 필수과목', areas:ESS4, count:25},
  {name:'6회 · 사무직형', areas:['comm','math','problem','resource','org','info'], count:25},
  {name:'7회 · 기술직형', areas:['comm','math','problem','resource','tech','info'], count:25},
  {name:'8회 · 전략과목', areas:['self','relation','info','tech','org','ethic'], count:20},
  {name:'9회 · 전영역 종합', areas:ALL10, count:30},
  {name:'10회 · 전영역 종합', areas:ALL10, count:30}
];
function startMockRound(i){
  var r=MOCK_ROUNDS[i]; if(!r) return;
  var pool=mockPool(r.areas, 'real');
  if(!pool.length){ alert('출제할 문항이 없습니다.'); return; }
  var list=makeSet(pool).slice(0, Math.min(r.count, pool.length));
  startExam(list, MOCK_DOM, 'mq', '실전 모의고사 '+r.name.split(' ')[0]);
  cbtState.rec={kind:'mockRound', idx:i};
}
function renderMockRounds(){
  var box=document.getElementById('mockRounds'); if(!box) return;
  box.innerHTML=MOCK_ROUNDS.map(function(r,i){
    var best=(PROG.mockRounds&&PROG.mockRounds[i]!=null)?'<span style="color:var(--green);font-weight:800"> ✓'+PROG.mockRounds[i]+'점</span>':'';
    return '<button class="roundbtn" onclick="startMockRound('+i+')"><b>'+esc(r.name)+'</b><span>'+r.count+'문항'+best+'</span></button>';
  }).join('');
}
function updateMockInfo(){
  var keys=Object.keys(mockSel);
  var mode=document.getElementById('mockMode')?document.getElementById('mockMode').value:'real';
  var pool=mockPool(keys,mode);
  var el=document.getElementById('mockPoolInfo');
  if(el) el.innerHTML= keys.length? '선택 <b>'+keys.length+'개 영역</b> · 출제 가능 문항 <b>'+pool.length+'개</b>' : '영역을 1개 이상 선택하세요.';
}
function startMock(){
  var keys=Object.keys(mockSel);
  if(!keys.length){ alert('영역을 1개 이상 선택하세요.'); return; }
  var mode=document.getElementById('mockMode').value;
  var count=parseInt(document.getElementById('mockCount').value,10);
  var pool=mockPool(keys,mode);
  if(!pool.length){ alert('선택한 영역에 출제할 문항이 없습니다.'); return; }
  var list=makeSet(pool).slice(0, Math.min(count,pool.length));
  startExam(list, MOCK_DOM, 'mq', '모의고사');
  cbtState.rec={kind:'mock'};
}

/* ── 전체 풀이 모음집 ── */
var solveCat='all';
function collectSolve(){
  var a=A(), lv=STATE.level, items=[];
  a.games.order.forEach(function(k){
    var gm=a.games[k];
    gm[lv].forEach(function(q){ items.push({cat:gm.name, q:q}); });
  });
  a.cbt[lv].forEach(function(q){ items.push({cat:'실전 점검', q:q}); });
  return items;
}
function renderSolve(){
  var items=collectSolve();
  var cats=['all'].concat(items.map(function(x){return x.cat;}).filter(function(v,i,arr){return arr.indexOf(v)===i;}));
  if(cats.indexOf(solveCat)<0) solveCat='all';
  document.getElementById('solveCats').innerHTML=cats.map(function(c){
    var label=c==='all'?'전체':c;
    return '<button class="'+(c===solveCat?'on':'')+'" onclick="setSolveCat(\''+c.replace(/'/g,"\\'")+'\')">'+esc(label)+'</button>';
  }).join('');
  var list=items.filter(function(x){return solveCat==='all'||x.cat===solveCat;});
  document.getElementById('solveList').innerHTML=list.map(function(x,i){
    var q=x.q;
    var cond=q.cond?'<div class="sc">'+esc(q.cond)+'</div>':'';
    var table=buildTable(q.table);
    return '<div class="solv"><div class="sn">'+esc(x.cat)+' · '+(i+1)+'</div>'+
      '<div class="sq">'+esc(q.q)+'</div>'+cond+table+
      '<div class="sa">정답: '+String.fromCharCode(9312+q.answer)+' '+esc(q.opts[q.answer])+'</div>'+
      '<div class="se"><b>풀이</b> '+esc(q.why)+'</div></div>';
  }).join('');
}
function setSolveCat(c){ solveCat=c; renderSolve(); }

/* ── 초기화 ── */
loadProg();
setLevel(PROG.level||'basic');
renderAreaCards();
renderHubExtras();
