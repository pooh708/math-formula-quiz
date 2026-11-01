// Google Apps Script 웹앱 /exec 주소를 큰따옴표 안에 붙여넣으세요.
// 예: export const REPORT_URL = 'https://script.google.com/macros/s/.../exec';
export const REPORT_URL = '';

function validUrl(url){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);}
export function submitTeacherReport(state,questions){
 if(!validUrl(REPORT_URL))throw Error('src/reporting.js에 올바른 Google Apps Script /exec 주소를 등록해 주세요.');
 if(!state.finished)throw Error('시험 완료 후 제출할 수 있습니다.');
 const report={
  version:5,
  submissionId:(globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random()),
  student:{classroom:state.student.classroom,number:state.student.number,name:state.student.name},
  answers:questions.map(q=>{
   const a=state.answers[q.id]||{status:'review',latex:'',reason:'미응답'};
   // 개인정보를 최소화하기 위해 정답 필기 이미지까지 업로드하지 않습니다.
   return {questionId:q.id,status:a.status,latex:a.latex||'',edited:!!a.edited,reason:a.reason||'',
    image:(a.status==='incorrect'||a.status==='review')?(a.image||''):''};
  })
 };
 const payload=JSON.stringify(report);
 if(payload.length>1400000)throw Error('원본 이미지 용량이 너무 큽니다. 결과를 CSV로 저장하고 교사에게 문의하세요.');
 const form=document.createElement('form');form.method='POST';form.action=REPORT_URL;form.target='_blank';form.style.display='none';
 const field=document.createElement('input');field.type='hidden';field.name='payload';field.value=payload;form.appendChild(field);
 document.body.appendChild(form);form.submit();form.remove();
}
