import {mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inside,json} from './library.mjs';

const args=process.argv.slice(2);
const option=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
try{
  const root=path.resolve(option('--library-root')||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
  const id=option('--id'),title=option('--title'),relative=option('--file');
  if(!/^seq-\d{4}$/.test(id||'')||!title||!relative)throw Error('需要 --id seq-NNNN --title 名称 --file 项目内相对路径');
  const file=await inside(root,relative);
  if(!file||!/^library[/\\]/.test(relative)||!/\.(mp4|webm|mov)$/i.test(file)||!(await stat(file)).isFile())throw Error('文件必须位于 library/ 内，且为本地视频');
  const target=path.join(root,'catalog','viewer-index.json');
  const index=await json(target,{schemaVersion:1,entries:[]});
  if(index.entries.some(e=>e.sequenceId===id))throw Error('编号已登记；不会覆盖现有版本');
  index.entries.push({sequenceId:id,title,sceneType:option('--scene')||'B-roll',tags:[],versions:[{label:'本地预览',relativePath:path.relative(root,file).replaceAll('\\','/')}]});
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,`${JSON.stringify(index,null,2)}\n`);
  console.log(`已登记 ${id}：${title}（本地预览，未授予视觉批准）`);
}catch(error){console.error(error.message);process.exitCode=1;}
