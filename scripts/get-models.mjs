import fs from 'node:fs/promises';
import path from 'node:path';
const folder='public/models/comer';
await fs.mkdir(folder,{recursive:true});
const files=['encoder_int8.onnx','decoder_int8.onnx','vocab.json'];
const base='https://github.com/kimseungdae/ink-on/releases/download/v0.1.0/';
for(const name of files){
  const p=path.join(folder,name);
  const s=await fs.stat(p).catch(()=>null);
  if(s && s.size>1000) {console.log('Existing model:',name);continue;}
  console.log('Downloading open-source model:',name);
  let data; let error;
  for(let t=0;t<3;t++){
    try { const r=await fetch(base+name,{redirect:'follow'}); if(!r.ok)throw Error('HTTP '+r.status);data=Buffer.from(await r.arrayBuffer());if(data.length<1000)throw Error('Unexpectedly small '+name);break; }
    catch(e){error=e;await new Promise(res=>setTimeout(res,1200));}
  }
  if(!data)throw new Error(`Failed downloading ${name}. Download from ${base+name} and place in ${folder}. ${error}`);
  await fs.writeFile(p,data);
}
