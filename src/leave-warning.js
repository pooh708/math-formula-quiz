/**
 * 수학 공식 암기시험: 화면 이탈 복귀 경고 모듈.
 * 기존 main.js의 이탈 기록(window_unfocused / hidden_tab_or_app) 기능은 변경하지 않습니다.
 * 시험 문제 화면(#board)이 표시된 상태에서만 작동합니다.
 */
const NOTICE_ID = 'quiz-leave-warning-overlay';
let leftAt = 0;
let lastNotifiedAt = 0;
let isAway = false;
let recoveryTimer;

function inExam() {
  return Boolean(document.getElementById('board'));
}
function rememberLeave() {
  if (!inExam() || document.getElementById(NOTICE_ID)) return;
  if (!isAway) leftAt = Date.now();
  isAway = true;
}
function showNotice() {
  if (!inExam() || document.getElementById(NOTICE_ID)) return;
  const overlay = document.createElement('div');
  overlay.id = NOTICE_ID;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'quiz-leave-warning-title');
  overlay.setAttribute('aria-describedby', 'quiz-leave-warning-description');
  overlay.innerHTML = `
    <section class="quiz-leave-warning-card">
      <div class="quiz-leave-warning-icon" aria-hidden="true">!</div>
      <h2 id="quiz-leave-warning-title">시험 이탈 화면 감지!</h2>
      <p id="quiz-leave-warning-description">시험 도중 다른 탭이나 앱으로 이동하거나 시험 창의 활성 상태가 해제되었습니다.</p>
      <p class="quiz-leave-warning-hint">화면 이탈 기록은 교사에게 전달됩니다. 이탈 기록만으로 부정행위가 확정되는 것은 아닙니다.</p>
      <button type="button" id="quiz-leave-warning-confirm">확인하고 시험 계속하기</button>
    </section>`;
  document.body.append(overlay);
  const confirm = overlay.querySelector('button');
  const blockEscape = event => { if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); confirm.focus(); } };
  overlay.addEventListener('keydown', blockEscape);
  confirm.addEventListener('click', () => { overlay.remove(); });
  confirm.focus();
}
function onReturn() {
  clearTimeout(recoveryTimer);
  if (!isAway || document.hidden || !document.hasFocus()) return;
  recoveryTimer = setTimeout(() => {
    if (document.hidden || !document.hasFocus()) return;
    isAway = false;
    if (!inExam()) return;
    // Single transition can fire both visibility and focus. Show once.
    if (leftAt <= lastNotifiedAt) return;
    lastNotifiedAt = leftAt;
    showNotice();
  }, 150);
}
const css = `
#${NOTICE_ID} {position:fixed;inset:0;z-index:2147483647;background:rgba(12,24,39,.77);display:flex;align-items:center;justify-content:center;padding:20px;}
#${NOTICE_ID} .quiz-leave-warning-card {width:min(100%,460px);border-radius:20px;padding:28px 24px;text-align:center;background:white;color:#253341;box-shadow:0 20px 70px rgba(0,0,0,.24);}
#${NOTICE_ID} .quiz-leave-warning-icon {display:grid;place-items:center;margin:0 auto 12px;width:48px;height:48px;border-radius:50%;background:#fff0e9;color:#b64022;font-weight:900;font-size:26px;}
#${NOTICE_ID} h2 {font-size:25px;margin:0 0 12px;color:#ac3327;}
#${NOTICE_ID} p {font-size:15px;line-height:1.6;margin:10px 0;}
#${NOTICE_ID} .quiz-leave-warning-hint {font-size:13px;color:#667487;}
#${NOTICE_ID} button {margin-top:16px;border:0;background:#196da9;color:white;padding:14px 18px;border-radius:12px;font-weight:750;cursor:pointer;width:100%;}
`;
const sheet = document.createElement('style');
sheet.textContent = css;
document.head.append(sheet);
window.addEventListener('blur', rememberLeave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) rememberLeave();
  else onReturn();
});
window.addEventListener('focus', onReturn);
