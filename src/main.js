import {InferenceEngine,preprocessStrokes,isStrokeMeaningful,loadVocab} from 'ink-on/core';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {questions,shuffled} from './questions.js';
import './style.css';
import './leave-warning.js';
import {REPORT_URL, submitTeacherReport} from './reporting.js';

const app=document.querySelector('#app');
const base=import.meta.env.BASE_URL;
const DRAFT_KEY='math_quiz_v8_draft';
function saveDraft(){try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify({student:st.student,examCode:st.examCode,sessionId:st.sessionId,startedAt:st.startedAt,leaves:st.leaves,qs:st.qs.map(q=>q.id),index:st.index,answers:st.answers,finished:st.finished}));}catch(e){console.warn('임시 저장 공간 부족',e);}}
function restoreDraft(){try{const d=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'null');if(!d||!d.student||!d.examCode||!Array.isArray(d.qs)||d.qs.length!==12)return false;if(!confirm('이 브라우저 탭에 저장된 이전 시험을 이어서 진행하시겠습니까?'))return false;Object.assign(st,{student:d.student,examCode:d.examCode,sessionId:d.sessionId,startedAt:d.startedAt,leaves:d.leaves||[],qs:d.qs.map(id=>questions.find(q=>q.id===id)),index:d.index||0,answers:d.answers||{},finished:!!d.finished});if(st.finished)finish();else{showQuestion();initModel();}return true;}catch(e){return false;}}
const st={student:null,examCode:"",sessionId:"",leaves:[],lastLeave:0,startedAt:"",studentConfirmed:false,qs:[],index:0,answers:{},strokes:[],draft:[],engine:null,vocab:null,loading:false,recognized:null,ready:false,finished:false};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const renderMath=(latex,el)=>{try{katex.render(latex,el,{throwOnError:false,displayMode:true,strict:'ignore'});}catch(e){el.textContent=latex;}};
const button=(id)=>document.getElementById(id);
const setInfo=(message,err=false)=>{const el=button('info');if(el){el.textContent=message;el.className='info '+(err?'error':'');}};
function startScreen(){
 app.innerHTML=`<main class="shell"><header><div class="eyebrow">MATH · HANDWRITING QUIZ</div><h1>수학 공식 암기시험</h1><p>공식 전체를 한 칸에 마우스로 쓰는 12문항 쪽지시험입니다.</p></header>
 <section class="panel"><h2>시험 시작</h2><p class="muted">학생별 문항 순서가 자동으로 섞입니다. 로그인 없이 응시할 수 있습니다.</p>
 <div class="fields"><label>학급 <input id="classroom" placeholder="예: 1-3" maxlength="15" autocomplete="off"></label><label>번호 <input id="number" placeholder="예: 12" maxlength="10" autocomplete="off"></label><label>이름 <input id="name" placeholder="이름" maxlength="30" autocomplete="off"></label></div>
 <label>시험 참여 코드 (교사가 안내) <input id="examCode" type="password" placeholder="시험 참여 코드" autocomplete="off" maxlength="50"></label><div class="actions"><button class="primary" id="start">시험 시작</button></div><p class="tiny">한 문제씩 출제되며, AI가 읽은 답안만 확인할 수 있습니다. 실제 채점은 교사용 서버에서 처리합니다.</p>
 <p class="warning">시범 운영: 수식 인식 오류 가능성이 있습니다. 학생은 AI가 읽은 수식을 확인할 수 있고, 불확실한 답안은 교사가 다시 확인해야 합니다.</p></section>
 <footer>수학 공식 12문항 · 마우스/터치 필기 · 서버/API 이용료 없음</footer></main>`;
 button('start').onclick=()=>{
  const classroom=button('classroom').value.trim(),number=button('number').value.trim(),name=button('name').value.trim();
  const examCode=button('examCode').value.trim();
  if(!classroom||!number||!name||!examCode){alert('학급, 번호, 이름, 시험 참여 코드를 입력하세요.');return;}
  st.student={classroom,number,name};st.examCode=examCode.toUpperCase();st.sessionId=crypto.randomUUID?.()||String(Date.now())+String(Math.random());st.startedAt=new Date().toISOString();st.leaves=[];st.lastLeave=0;st.qs=shuffled(questions);st.index=0;st.answers={};st.finished=false;saveDraft();
  showQuestion();initModel();
 };
}
async function initModel(){
 if(st.ready||st.loading)return;
 st.loading=true;setInfo('무료 수식 AI 모델을 불러오는 중입니다. 첫 접속에는 시간이 걸릴 수 있습니다.');
 try{
  const root=`${base}models/comer/`;
  st.vocab=await loadVocab(root+'vocab.json');
  st.engine=new InferenceEngine({encoderUrl:root+'encoder_int8.onnx',decoderUrl:root+'decoder_int8.onnx',beamWidth:3,executionProvider:'wasm'});
  await st.engine.init();st.ready=true;setInfo('수식 AI 준비 완료 · 공식을 한 칸에 직접 쓰세요.');
 }catch(e){console.error(e);setInfo('AI 모델 로딩 실패: '+e.message+' · 배포 설명서를 확인하세요.',true);}
 finally{st.loading=false;}
}
function showQuestion(){
 st.recognized=null;st.strokes=[];st.draft=[];
 const q=st.qs[st.index];
 app.innerHTML=`<main class="shell"><header class="top"><div><div class="eyebrow">수학 공식 암기시험</div><h1>문제 ${st.index+1} <span class="muted">/ ${st.qs.length}</span></h1></div><div class="who">${esc(st.student.classroom)} · ${esc(st.student.number)}번 · ${esc(st.student.name)}</div></header>
 <div class="progress"><div style="width:${100*st.index/st.qs.length}%"></div></div>
 <section class="panel"><div class="qmeta">무작위 출제 · 원본 ${q.id}번 · 1점</div><h2>${esc(q.prompt)}</h2>
 ${q.image?`<img class="diagram" alt="삼각형 외각 그림" src="${base}triangle_original.png">`:''}
 <p class="muted">답안 작성칸에 공식을 자유롭게 쓰세요.</p>
 <div class="canvas-wrap"><canvas id="board" aria-label="마우스 필기 답안 작성칸"></canvas></div>
 <div class="actions"><button id="undo">마지막 획 지우기</button><button id="erase">전체 지우기</button><button id="recognize" class="primary">필기 인식하기</button></div>
 <p id="info" class="info">수식 AI 모델을 준비하는 중입니다.</p>
 <div id="recognized" class="recognition" hidden><div class="rec-title">AI가 읽은 수식</div><div id="preview" class="math-preview"></div>
 <p class="muted">내가 쓴 공식과 다르게 읽었다면 아래 인식 오류 수정 버튼을 사용하거나 다시 쓰세요. 정답은 아직 표시되지 않습니다.</p>
 <div id="quickfixes" class="actions" hidden></div>
 <details><summary>계속 잘못 인식되나요? (선택: 인식 결과 직접 수정)</summary><p class="tiny">이 기능은 AI 오류를 고치는 용도입니다. 사용한 경우 결과 파일에 '수정함'으로 기록됩니다.</p><input id="correction" placeholder="예: n(n-3)/2 또는 \\frac{n(n-3)}{2}"><button id="useCorrection">수정한 수식 적용</button></details>
 <div class="actions"><button id="retry">다시 쓰기</button><button id="confirm" class="primary">이 수식으로 답안 확정</button></div></div>
 </section><footer><button id="skip">인식이 안 되어 확인 보류하고 다음 문제</button> · 최종 채점은 교사용 서버에서 진행합니다.</footer></main>`;
 const board=button('board'),ctx=board.getContext('2d');
 let drawing=false,cur=null;
 function offerQuickFixes(){
  const holder=button('quickfixes');if(!holder)return;holder.replaceChildren();
  if(!st.recognized){holder.hidden=true;return;}
  const raw=st.recognized.latex;const options=[];
  // These options are corrections requested by the student, not automatic guesses.
  if(/\\?\^\s*(?:\\?\{\s*0\s*\}|0)(?![0-9])/.test(raw)){
    options.push(['위첨자 0을 °로 수정',()=>raw.replace(/\^\s*(?:\{\s*0\s*\}|0)(?![0-9])/g,'^{\\circ}')]);
  }
  if(q.id!==3 && /b/.test(raw)){
    options.push(['잘못 인식된 b를 6으로 수정',()=>raw.replace(/b/g,'6')]);
  }
  if([8,9,10,11,12].includes(q.id) && /(^|[^A-Za-z\\])v(?=$|[^A-Za-z])/.test(raw)){
    options.push(['잘못 인식된 v를 r로 수정',()=>raw.replace(/(^|[^A-Za-z\\])v(?=$|[^A-Za-z])/g,'$1r')]);
  }
  for(const [label,change] of options){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{
    const corrected=change();st.recognized={latex:corrected,edited:true};renderMath(corrected,button('preview'));
    setInfo('수정한 인식 결과를 확인한 뒤 답안을 확정하세요.');offerQuickFixes();
  };holder.append(b);}
  holder.hidden=options.length===0;
 }
 function resized(){const width=board.clientWidth,height=board.clientHeight;board.width=Math.round(width*devicePixelRatio);board.height=Math.round(height*devicePixelRatio);ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);redraw();}
 function redraw(){ctx.clearRect(0,0,board.clientWidth,board.clientHeight);ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#14283f';ctx.lineWidth=3.4;
  for(const stroke of [...st.strokes,...(cur?[cur]:[])]){if(!stroke.points.length)continue;ctx.beginPath();stroke.points.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();}}
 function pos(e){const r=board.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 board.addEventListener('pointerdown',e=>{board.setPointerCapture(e.pointerId);drawing=true;cur={points:[pos(e)],lineWidth:3.4};redraw();});
 board.addEventListener('pointermove',e=>{if(!drawing)return;cur.points.push(pos(e));redraw();});
 function end(){if(drawing&&cur){st.strokes.push(cur);cur=null;drawing=false;st.recognized=null;button('recognized').hidden=true;button('quickfixes').hidden=true;redraw();}}
 board.addEventListener('pointerup',end);board.addEventListener('pointercancel',end);
 button('undo').onclick=()=>{st.strokes.pop();st.recognized=null;button('recognized').hidden=true;button('quickfixes').hidden=true;redraw();};
 button('erase').onclick=()=>{st.strokes=[];st.recognized=null;button('recognized').hidden=true;button('quickfixes').hidden=true;redraw();};
 button('recognize').onclick=async()=>{
  if(!st.ready){await initModel();if(!st.ready)return;}
  if(!isStrokeMeaningful(st.strokes)){setInfo('필기한 수식이 없습니다.',true);return;}
  setInfo('수식 AI 인식 중…');button('recognize').disabled=true;
  try{const input=preprocessStrokes(st.strokes);const result=await st.engine.recognize(input,st.vocab,'expression');
   if(!result.latex)throw Error('수식을 읽지 못했습니다.');
   st.recognized={latex:result.latex,edited:false};button('recognized').hidden=false;renderMath(result.latex,button('preview'));offerQuickFixes();setInfo('인식 결과를 확인한 후 답안을 확정하세요.');
  }catch(e){console.error(e);setInfo('이번 필기를 인식하지 못했습니다: '+e.message+' · 다시 쓰거나 확인 보류하세요.',true);}
  finally{button('recognize').disabled=false;}
 };
 button('retry').onclick=()=>{button('erase').click();setInfo('다시 작성해 주세요.');};
 button('useCorrection').onclick=()=>{const t=button('correction').value.trim();if(!t)return;st.recognized={latex:t,edited:true};renderMath(t,button('preview'));offerQuickFixes();setInfo('수정 내용을 적용했습니다.');};
 button('confirm').onclick=()=>{
  if(!st.recognized)return;
  st.answers[q.id]={latex:st.recognized.latex,edited:st.recognized.edited,reason:'',image:smallImage(board,st.strokes)};next();
 };
 button('skip').onclick=()=>{st.answers[q.id]={latex:'',edited:false,reason:'학생이 인식 보류함',image:smallImage(board,st.strokes)};next();};
 function next(){if(st.index<st.qs.length-1){st.index++;saveDraft();showQuestion();}else{saveDraft();finish();}}
 // Watch for CSS layout before canvas dimensioning
 requestAnimationFrame(resized);
 if(st.ready)setInfo('수식 AI 준비 완료 · 자유롭게 필기하세요.');
}
function smallImage(board,strokes){
 if(!strokes.length)return '';
 const c=document.createElement('canvas');c.width=560;c.height=210;
 const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);
 ctx.drawImage(board,0,0,c.width,c.height);
 return c.toDataURL('image/jpeg',0.65);
}
function finish(){
 st.finished=true;saveDraft();
 // Do not show answers, computed scores, or grading decisions in the student browser.
 app.innerHTML=`<main class="shell"><header><div class="eyebrow">수학 공식 암기시험 · 최종 제출</div><h1>12문항 작성 완료</h1><p>${esc(st.student.classroom)} · ${esc(st.student.number)}번 · ${esc(st.student.name)}</p></header>
 <section class="panel"><h2>교사에게 답안을 제출하세요</h2>
 <p class="muted">정답 및 채점 결과는 학생 화면에 공개되지 않습니다. 교사용 서버가 채점하며 오답·인식 불확실 답안의 원본 필기를 보관합니다.</p>
 <p class="info">시험 중 화면 전환 감지: ${st.leaves.length}회 (부정행위 확정이 아닌 참고 기록)</p>
 <div class="actions"><button id="sendTeacher" class="primary">교사에게 시험 결과 제출</button><button id="export">내 답안 CSV 백업</button></div>
 <p id="sendInfo" class="info">${REPORT_URL?'제출 버튼을 누르고 새 탭의 접수 완료 메시지를 확인하세요.':'제출 주소가 설정되지 않았습니다. 교사에게 알려주세요.'}</p>
 <p class="tiny">새 탭의 접수 결과를 확인하고, 표시된 개인 결과 조회 링크를 안전하게 보관하세요. 공개 전에는 정답이 보이지 않습니다. 접수 실패 시 이 페이지에서 다시 제출할 수 있습니다.</p></section></main>`;
 button('sendTeacher').disabled=!REPORT_URL;
 button('sendTeacher').onclick=()=>{try{submitTeacherReport(st,questions);button('sendInfo').textContent='새 탭에서 접수 완료 메시지를 확인하세요. 화면이 열렸다는 사실만으로 접수가 보장되지는 않습니다.';}catch(e){button('sendInfo').textContent='제출 준비 실패: '+e.message;}};
 button('export').onclick=exportCSV;
}
function exportCSV(){
 const cells=[['학급','번호','이름','원문항','인식수식','수정여부'],...questions.map(q=>{const a=st.answers[q.id]||{};return [st.student.classroom,st.student.number,st.student.name,q.id,a.latex||'',a.edited?'예':'아니오']})];
 const csv='\ufeff'+cells.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');
 link.href=url;link.download='my_math_answers.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function recordLeave(reason){
 if(!st.student||st.finished||!st.startedAt)return;
 const now=Date.now();if(now-st.lastLeave<1600)return;st.lastLeave=now;
 st.leaves.push({time:new Date(now).toISOString(),questionId:st.qs[st.index]?.id||0,reason});saveDraft();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)recordLeave('hidden_tab_or_app');});
window.addEventListener('blur',()=>{if(!document.hidden)recordLeave('window_unfocused');});
if(!restoreDraft())startScreen();
