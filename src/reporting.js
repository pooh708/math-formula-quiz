// Replace with the deployed Apps Script /exec URL. Never add a teacher password here.
export const REPORT_URL = 'https://script.google.com/macros/s/AKfycbwsxr8DaonGA7ey1Itf3BJKvp-rwdmCls3PLj7O-J9UkZawbLBYT-5IBoP7pkcEZmSi4g/exec
';
function validUrl(url){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);}
export function submitTeacherReport(state,questions){
 if(!validUrl(REPORT_URL))throw Error('src/reporting.js에 웹 앱 /exec 주소를 설정하세요.');
 if(!state.finished)throw Error('시험이 끝나지 않았습니다.');
 const report={version:8,
   submissionId:state.sessionId,
   examCode:state.examCode,
   startedAt:state.startedAt,
   leaves:state.leaves.slice(0,100),
   student:state.student,
   answers:questions.map(q=>{const a=state.answers[q.id]||{};return {questionId:q.id,latex:a.latex||'',edited:!!a.edited,reason:a.reason||'',image:a.image||''};})
 };
 const payload=JSON.stringify(report);
 if(payload.length>1500000)throw Error('필기 이미지 용량이 너무 큽니다. CSV로 답안을 백업하고 교사에게 문의하세요.');
 const form=document.createElement('form');form.method='POST';form.action=REPORT_URL;form.target='_blank';form.style.display='none';
 const field=document.createElement('input');field.type='hidden';field.name='payload';field.value=payload;form.append(field);
 document.body.append(form);form.submit();form.remove();
}
