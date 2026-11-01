// The app NEVER guesses the correct formula from the question. It compares only the recognized expression.
function group(s,i){
  if(s[i]!=='{') return [s[i]||'',i+1];
  let depth=1,j=i+1;
  for(;j<s.length;j++){if(s[j]==='{')depth++;else if(s[j]==='}'&&!--depth) return [s.slice(i+1,j),j+1];}
  throw Error('Unclosed LaTeX brace');
}
export function latexToMath(raw){
  if(!raw || typeof raw!=='string')throw Error('Blank');
  let s=raw.replace(/\s/g,'').replace(/\^\{(?:\\circ|°)\}/g,'').replace(/\^(?:\\circ|°)/g,'').replace(/\\left|\\right/g,'').replace(/\\displaystyle|\\textstyle/g,'')
    .replace(/\\,/g,'').replace(/\\!/g,'').replace(/\\pi/g,'pi').replace(/π/g,'pi')
    .replace(/\\times|\\cdot/g,'*').replace(/[×·]/g,'*').replace(/[−–]/g,'-')
    .replace(/\\div/g,'/').replace(/÷/g,'/').replace(/\\circ|°/g,'').replace(/\\mathrm\{([^{}]+)\}/g,'$1');
  // Recognize length/area notation on the left; never strip equality with expressions on both sides.
  if(s.includes('=')){
    let parts=s.split('=');
    if(parts.length!==2||!/^([lS]|\\ell)$/.test(parts[0]))throw Error('Unsupported equality');
    s=parts[1];
  }
  s=s.replace(/\\ell/g,'l');
  // Convert LaTeX fractional groups recursively, retaining structure.
  function convert(t){
    let out='';
    for(let i=0;i<t.length;){
      if(t.startsWith('\\frac',i)||t.startsWith('\\dfrac',i)||t.startsWith('\\tfrac',i)){
        i+=t.startsWith('\\dfrac',i)||t.startsWith('\\tfrac',i)?6:5;
        const [a,j]=group(t,i);const[b,k]=group(t,j);i=k;out+=`((${convert(a)})/(${convert(b)}))`;
      } else if(t[i]==='{'){const[a,j]=group(t,i);i=j;out+='('+convert(a)+')';}
      else if(t[i]==='}')throw Error('Unexpected brace');
      else {out+=t[i++];}
    }
    return out;
  }
  s=convert(s).replace(/\^/g,'^');
  if(/\\|[^0-9a-zA-Z()+\-*/^.]/.test(s))throw Error('Unrecognized symbol');
  if(!s || s.length>180)throw Error('Invalid formula');
  // Tokenize permitted variables individually instead of allowing ambiguous merged OCR symbols.
  const tokens=[];
  for(let i=0;i<s.length;){
    const rest=s.slice(i);
    if(rest.startsWith('pi')){tokens.push('pi');i+=2;continue;}
    const num=rest.match(/^\d+(?:\.\d+)?/);
    if(num){tokens.push(num[0]);i+=num[0].length;continue;}
    if('nrlxabS'.includes(s[i])){tokens.push(s[i]);i++;continue;}
    if('()+-*/^'.includes(s[i])){tokens.push(s[i]);i++;continue;}
    throw Error('Unknown variable');
  }
  const out=[];
  const ends=x=>x===')'||x==='pi'||/^[0-9]/.test(x)||'nrlxabS'.includes(x);
  const starts=x=>x==='('||x==='pi'||/^[0-9]/.test(x)||'nrlxabS'.includes(x);
  for(let i=0;i<tokens.length;i++){
    if(i && ends(tokens[i-1]) && starts(tokens[i]))out.push('*');
    out.push(tokens[i]);
  }
  return out.join('');
}
function calc(expr,vars){
  const tokens=expr.match(/pi|\d+(?:\.\d+)?|[nrlxabS]|[()+*/^\-]/g)||[];
  let i=0;
  const term=()=>{
    let v=power();
    while(tokens[i]==='*'||tokens[i]==='/'){
      const op=tokens[i++],w=power();v=op==='*'?v*w:v/w;
    }
    return v;
  };
  const exprFn=()=>{
    let v=term();while(tokens[i]==='+'||tokens[i]==='-'){
      const op=tokens[i++],w=term();v=op==='+'?v+w:v-w;
    }return v;
  };
  const power=()=>{
    let v=primary();if(tokens[i]==='^'){i++;v=Math.pow(v,power());}return v;
  };
  const primary=()=>{
    const t=tokens[i++];
    if(t==='-')return -power();
    if(t==='+')return power();
    if(t==='('){const v=exprFn();if(tokens[i++]!==')')throw Error('Unclosed parenthesis');return v;}
    if(t==='pi')return Math.PI;
    if(t && Object.hasOwn(vars,t))return vars[t];
    if(t && /^\d/.test(t))return Number(t);
    throw Error('Unrecognized expression token');
  };
  const value=exprFn();if(i!==tokens.length)throw Error('Trailing expression');return value;
}
const SAMPLES=[
{n:5,r:3,x:41,a:11,b:27,l:9,S:2},
{n:7,r:8,x:80,a:19,b:14,l:4,S:3},
{n:12,r:2,x:173,a:13,b:29,l:13,S:4},
{n:23,r:11,x:51,a:37,b:15,l:7,S:5},
];
export function gradeLatex(actual, expected){
  try{
    // A superscript zero is easily confused with a handwritten degree mark.
    // Never silently reinterpret either meaning; ask the student to confirm.
    if(/\\?\^\s*(?:\\?\{\s*0\s*\}|0)(?![0-9])/.test(actual))
      return {status:'review',reason:'위첨자 0과 도(°) 기호를 구별할 수 없습니다. 필기를 확인하세요.'};
    const a=latexToMath(actual),b=latexToMath(expected);
    let nums=[];
    for(const vars of SAMPLES){
      const av=calc(a,vars);const bv=calc(b,vars);
      if(!Number.isFinite(av)||!Number.isFinite(bv))return {status:'review',reason:'계산할 수 없는 식'};
      nums.push([av,bv]);
    }
    const eq=nums.every(([av,bv])=>Math.abs(av-bv)<1e-7*Math.max(1,Math.abs(av),Math.abs(bv)));
    return {status:eq?'correct':'incorrect',parsed:a};
  }catch(e){return {status:'review',reason:'수식을 해석할 수 없음: '+e.message};}
}
