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

/* ── 화면 전환 ── */
function setLevel(lv){
  STATE.level=lv;
  document.getElementById('lvBasic').classList.toggle('on',lv==='basic');
  var h=document.getElementById('lvHard');
  h.classList.toggle('on',lv==='hard'); h.classList.toggle('hard',lv==='hard');
  document.querySelectorAll('.lvtxt').forEach(function(e){e.textContent=lvTxt();});
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
    var st=a.ready?'<div class="st ready">▶ 시작하기</div>':'<div class="st soon">🔒 준비 중</div>';
    var bar=a.ready?'<div class="bar" style="background:'+a.color+'"></div>':'';
    return '<button class="'+cls+'" '+(a.ready?'onclick="selectArea(\''+key+'\')"':'disabled')+'>'+
      bar+'<div class="ico">'+a.ic+'</div><div class="t">'+esc(a.name)+'</div>'+
      '<div class="d">'+esc(a.desc)+'</div>'+st+'</button>';
  }).join('');
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
  box.innerHTML=g.order.map(function(k){
    var gm=g[k], n=gm[STATE.level].length;
    return '<button class="tile" onclick="startGame(\''+k+'\')">'+
      '<div class="ico">'+gm.ic+'</div><div class="t">'+esc(gm.name)+'</div>'+
      '<div class="d">'+esc(gm.desc)+'</div>'+
      '<div class="go">'+n+'문항 · '+lvTxt()+' →</div></button>';
  }).join('');
}
var gState=null;
function startGame(key){
  var gm=A().games[key];
  gState={key:key, list:gm[STATE.level].slice(), i:0, correct:0, name:gm.name};
  FX.reset();
  document.getElementById('playHome').classList.add('hidden');
  document.getElementById('playRun').classList.remove('hidden');
  FX.hud(document.getElementById('hud'));
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
  var miss=s.list.length-s.correct, stars=FX.starsFor(miss);
  FX.banner({
    icon: stars===3?'🏆':(stars===2?'🎉':(stars>=1?'👍':'💪')),
    title: s.name+' 완료!',
    sub: s.list.length+'문제 중 <b>'+s.correct+'개</b> 정답<br>점수 <b>'+FX.score()+'</b> · 최고 콤보 <b>'+FX.best()+'</b>',
    stars: stars, btn:'게임 목록으로',
    onClose:function(){
      quitGame();
      if(window.ResultCollector && ResultCollector.config.endpoint){
        setTimeout(function(){
          ResultCollector.open({correct:s.correct,total:s.list.length,score:FX.score(),labels:{correct:'정답'}});
        },300);
      }
    }
  });
}
function quitGame(){
  gState=null;
  document.getElementById('playRun').classList.add('hidden');
  document.getElementById('playHome').classList.remove('hidden');
}

/* ── 실전 점검 CBT ── */
var cbtState=null;
function startCbt(){
  cbtState={list:A().cbt[STATE.level].slice(), picks:[], t0:Date.now()};
  cbtState.picks=new Array(cbtState.list.length).fill(-1);
  document.getElementById('cbtHome').classList.add('hidden');
  document.getElementById('cbtResult').classList.add('hidden');
  document.getElementById('cbtRun').classList.remove('hidden');
  renderCbt();
}
function renderCbt(){
  document.getElementById('cbtList').innerHTML=cbtState.list.map(function(q,qi){
    var cond=q.cond?'<div class="cnd">'+esc(q.cond)+'</div>':'';
    var table=buildTable(q.table);
    var opts=q.opts.map(function(o,oi){
      return '<label data-q="'+qi+'" data-o="'+oi+'"><input type="radio" name="cq'+qi+'" onchange="pickCbt('+qi+','+oi+')">'+
        '<span><b style="color:var(--cyan)">'+String.fromCharCode(9312+oi)+'</b> '+esc(o)+'</span></label>';
    }).join('');
    return '<div class="cbtq" id="cq'+qi+'"><div class="num">Q'+(qi+1)+'</div>'+
      '<div class="qt">'+esc(q.q)+'</div>'+cond+table+
      '<div class="cbto">'+opts+'</div><div class="sol" id="sol'+qi+'"></div></div>';
  }).join('');
}
function pickCbt(qi,oi){
  cbtState.picks[qi]=oi;
  document.querySelectorAll('#cq'+qi+' .cbto label').forEach(function(l){
    l.classList.toggle('pick',+l.dataset.o===oi);
  });
}
function gradeCbt(){
  var s=cbtState, un=s.picks.indexOf(-1);
  if(un>-1){
    var el=document.getElementById('cq'+un);
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.animate([{boxShadow:'0 0 0 2px var(--red)'},{boxShadow:'0 0 0 0 transparent'}],{duration:900});
    return;
  }
  var correct=0, wrong=[];
  s.list.forEach(function(q,qi){
    var pick=s.picks[qi];
    document.querySelectorAll('#cq'+qi+' .cbto label').forEach(function(l){
      l.querySelector('input').disabled=true;
      var oi=+l.dataset.o;
      if(oi===q.answer) l.classList.add('correct');
      if(oi===pick && pick!==q.answer) l.classList.add('wrong');
    });
    var sol=document.getElementById('sol'+qi); sol.className='sol show';
    if(pick===q.answer){ correct++; sol.innerHTML='<b>정답 ✔</b> '+esc(q.why); }
    else{ wrong.push(qi+1); sol.innerHTML='<b>정답: '+String.fromCharCode(9312+q.answer)+'</b> '+esc(q.why); }
  });
  var dur=Math.round((Date.now()-s.t0)/1000), score=Math.round(correct/s.list.length*100);
  s.result={correct:correct,total:s.list.length,score:score,wrong:wrong,durationSec:dur};
  document.getElementById('cbtRun').classList.add('hidden');
  document.getElementById('cbtResult').classList.remove('hidden');
  document.getElementById('cbtScore').textContent=score;
  document.getElementById('cbtCorrect').textContent=correct;
  document.getElementById('cbtTotal').textContent=s.list.length;
  document.getElementById('cbtTime').textContent=dur;
  document.getElementById('cbtWrong').innerHTML=wrong.length
    ? '틀린 문제: '+wrong.map(function(n){return 'Q'+n;}).join(', ') : '🎉 전부 맞혔어요!';
  FX.banner({
    icon: score>=90?'🏆':(score>=70?'🎉':'💪'),
    title:'점검 완료 · '+score+'점',
    sub:s.list.length+'문제 중 <b>'+correct+'개</b> 정답',
    stars:FX.starsFor(wrong.length), btn:'결과 확인'
  });
  window.scrollTo({top:0,behavior:'smooth'});
}
function reviewCbt(){
  document.getElementById('cbtResult').classList.add('hidden');
  document.getElementById('cbtRun').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}
function resetCbt(){
  cbtState=null;
  document.getElementById('cbtRun').classList.add('hidden');
  document.getElementById('cbtResult').classList.add('hidden');
  document.getElementById('cbtHome').classList.remove('hidden');
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

/* ── 결과 제출 버튼 ── */
document.getElementById('cbtSubmit').addEventListener('click',function(){
  if(!cbtState||!cbtState.result) return;
  if(window.ResultCollector){
    var r=cbtState.result;
    ResultCollector.open({correct:r.correct,total:r.total,score:r.score,wrong:r.wrong,durationSec:r.durationSec});
  }else{ alert('결과 제출 기능은 선생님이 배포한 링크에서 활성화됩니다.'); }
});

/* ── 초기화 ── */
renderAreaCards();
