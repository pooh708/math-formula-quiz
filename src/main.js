import {InferenceEngine,preprocessStrokes,isStrokeMeaningful,loadVocab} from 'ink-on/core';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {gradeLatex} from './grading.js';
import {questions,shuffled} from './questions.js';
import './style.css';
import {REPORT_URL, submitTeacherReport} from './reporting.js';

const app=document.querySelector('#app');
const base=import.meta.env.BASE_URL;
const st={student:null,qs:[],index:0,answers:{},strokes:[],draft:[],engine:null,vocab:null,loading:false,recognized:null,ready:false,finished:false};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const renderMath=(latex,el)=>{try{katex.render(latex,el,{throwOnError:false,displayMode:true,strict:'ignore'});}catch(e){el.textContent=latex;}};
const button=(id)=>document.getElementById(id);
const setInfo=(message,err=false)=>{const el=button('info');if(el){el.textContent=message;el.className='info '+(err?'error':'');}};
function startScreen(){
 app.innerHTML=`<main class="shell"><header><div class="eyebrow">MATH · HANDWRITING QUIZ</div><h1>수학 공식 암기시험</h1><p>공식 전체를 한 칸에 마우스로 쓰는 12문항 쪽지시험입니다.</p></header>
 <section class="panel"><h2>시험 시작</h2><p class="muted">학생별 문항 순서가 자동으로 섞입니다. 로그인 없이 응시할 수 있습니다.</p>
 <div class="fields"><label>학급 <input id="classroom" placeholder="예: 1-3" maxlength="15" autocomplete="off"></label><label>번호 <input id="number" placeholder="예: 12" maxlength="10" autocomplete="off"></label><label>이름 <input id="name" placeholder="이름" maxlength="30" autocomplete="off"></label></div>
 <button class="primary" id="start">시험 시작</button><p class="tiny">이 파일은 무료 인식 모델을 학생 기기에서 실행합니다. 인터넷 접속과 모델 다운로드가 필요하며, 이름과 점수는 서버에 자동 수집되지 않습니다.</p>
 <p class="warning">시범 운영: 수식 인식 오류 가능성이 있습니다. 학생은 AI가 읽은 수식을 확인할 수 있고, 불확실한 답안은 교사가 다시 확인해야 합니다.</p></section>
 <footer>수학 공식 12문항 · 마우스/터치 필기 · 서버/API 이용료 없음</footer></main>`;
 button('start').onclick=()=>{
  const classroom=button('classroom').value.trim(),number=button('number').value.trim(),name=button('name').value.trim();
  if(!classroom||!number||!name){alert('학급, 번호, 이름을 입력하세요.');return;}
  st.student={classroom,number,name};st.qs=shuffled(questions);st.index=0;st.answers={};st.finished=false;
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
 </section><footer><button id="skip">인식이 안 되어 확인 보류하고 다음 문제</button> · 자동 채점 후 최종 확인 결과를 다운로드할 수 있습니다.</footer></main>`;
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
  const judgement=gradeLatex(st.recognized.latex,q.answer);
  st.answers[q.id]={latex:st.recognized.latex,edited:st.recognized.edited,status:judgement.status,reason:judgement.reason??'',image:board.toDataURL('image/png')};next();
 };
 button('skip').onclick=()=>{st.answers[q.id]={latex:'',edited:false,status:'review',reason:'학생이 인식 보류함',image:board.toDataURL('image/png')};next();};
 function next(){if(st.index<st.qs.length-1){st.index++;showQuestion();}else finish();}
 // Watch for CSS layout before canvas dimensioning
 requestAnimationFrame(resized);
 if(st.ready)setInfo('수식 AI 준비 완료 · 자유롭게 필기하세요.');
}
function finish(){
 st.finished=true;
 const done=Object.values(st.answers),correct=done.filter(x=>x.status==='correct').length,review=done.filter(x=>x.status==='review').length;
 app.innerHTML=`<main class="shell"><header><div class="eyebrow">수학 공식 암기시험 · 결과</div><h1>시험 제출 완료</h1><p>${esc(st.student.classroom)} · ${esc(st.student.number)}번 · ${esc(st.student.name)}</p></header>
 <section class="panel"><div class="result"><div><span>자동 판정 정답</span><strong>${correct} / 12</strong></div><div><span>확인 필요</span><strong>${review}문항</strong></div></div>
 <p class="warning">AI가 잘못 읽은 필기는 점수에 영향을 줄 수 있습니다. 아래 점수는 교사 확인 전 자동 판정이며, 공식 성적으로 확정하지 마세요.</p>
 <div class="tablewrap"><table><thead><tr><th>원래 문항</th><th>인식한 식</th><th>판정</th><th>원래 정답</th></tr></thead><tbody>${questions.map(q=>{let a=st.answers[q.id]||{};return `<tr><td>${q.id}</td><td class="formula">${esc(a.latex||'(없음)')}${a.edited?' (수정함)':''}</td><td>${a.status==='correct'?'정답':a.status==='incorrect'?'오답':'확인 필요'}</td><td>${esc(q.display)}</td></tr>`}).join('')}</tbody></table></div>
 <div class="actions"><button class="primary" id="sendTeacher">교사에게 시험 결과 제출</button><button id="export">성적표 CSV 다운로드</button><button id="print">결과 인쇄</button><button id="new">다시 시작</button></div>
 <p id="sendInfo" class="info">${REPORT_URL?'교사에게 제출을 누르면 새 탭에서 전송 결과를 확인할 수 있습니다.':'교사용 수집 주소가 아직 연결되지 않았습니다. 설명서를 참고하세요.'}</p>
 <p class="tiny">교사에게 제출 시 학급·번호·이름, 12문항의 인식 수식·채점 결과, 오답/확인필요 문항의 실제 필기 이미지를 전송합니다. 교사의 Google Drive와 스프레드시트에 보관되며 교사만 열람할 수 있도록 설정해야 합니다. 교사에게 제출 전까지 브라우저에만 저장됩니다.</p>
 </section></main>`;
 button('sendTeacher').disabled=!REPORT_URL;
 button('sendTeacher').onclick=()=>{try{submitTeacherReport(st,questions);button('sendInfo').textContent='제출 창에서 접수 완료 메시지가 표시되는지 확인하세요. 창을 닫기 전에 확인해야 합니다.';}catch(e){button('sendInfo').textContent='제출 준비 실패: '+e.message;}};
 button('export').onclick=exportCSV;
 button('print').onclick=()=>window.print();
 button('new').onclick=startScreen;
}
function exportCSV(){
 const cells=[['학급','번호','이름','원문항','인식수식','결과','OCR수정여부','확인사항'],...questions.map(q=>{const a=st.answers[q.id];return [st.student.classroom,st.student.number,st.student.name,q.id,a.latex,a.status,a.edited?'예':'아니오',a.reason]})];
 const csv='\ufeff'+cells.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');
 link.href=url;link.download=`수학공식시험_${st.student.classroom}_${st.student.number}_${st.student.name}.csv`.replaceAll(/[\\/:*?"<>|]/g,'_');
 link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
startScreen();
