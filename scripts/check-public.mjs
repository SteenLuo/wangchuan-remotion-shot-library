import {readFile,lstat,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allow=JSON.parse(await readFile(path.join(root,'public-files.json'),'utf8')).files;
const errors=[];
const privatePath=/(^|\/)(library|catalog|sources|out|public|remotion|migration-runtime|experiments|deliverables|build|node_modules|\.cache|\.env|\.tmp)(\/|$)|project\.local\.json$|\.(mp4|mov|webm|png|jpg|jpeg|webp|zip|woff2?|ttf|otf)$/i;
const secretPatterns=[/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/[A-Z]:[\\/](?:AI|Users)[\\/]/i,/rec[a-zA-Z0-9]{12,}/,/https?:\/\/[^\s/]+\.(?:feishu|larksuite)\.cn\/[^\s)]+/];
if(new Set(allow).size!==allow.length)errors.push('Duplicate allowlist entry');
for(const relative of allow){
  if(privatePath.test(relative)||relative.startsWith('/')||relative.includes('..')){errors.push(`Private or invalid path: ${relative}`);continue;}
  let info;try{info=await lstat(path.join(root,relative));}catch{errors.push(`Missing public file: ${relative}`);continue;}
  if(!info.isFile()||info.isSymbolicLink()){errors.push(`Not a regular file: ${relative}`);continue;}
  const text=await readFile(path.join(root,relative),'utf8');
  // Scanner patterns themselves are definitions, not secrets.
  if(relative!=='scripts/check-public.mjs'&&secretPatterns.some(pattern=>pattern.test(text)))errors.push(`Potential private content in ${relative}`);
  if(relative.endsWith('.md'))for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
    const link=match[1].split('#')[0];if(!link||/^(https?:|mailto:)/.test(link))continue;
    const target=path.relative(root,path.resolve(root,path.dirname(relative),link)).replaceAll('\\','/');
    if(!allow.includes(target))errors.push(`Unshipped document link: ${relative} -> ${link}`);
  }
}
try{
  const top=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  if(path.resolve(top).toLowerCase()!==root.toLowerCase())throw Error('Export has no own Git repository');
  const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean);
  for(const file of tracked)if(!allow.includes(file))errors.push(`Unapproved tracked file: ${file}`);
  const staged=execFileSync('git',['diff','--cached','--name-only','--diff-filter=ACMR','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean);
  for(const file of staged){
    if(!allow.includes(file))continue;
    const stagedText=execFileSync('git',['show',`:${file}`],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).replaceAll('\r\n','\n');
    const diskText=(await readFile(path.join(root,file),'utf8')).replaceAll('\r\n','\n');
    if(stagedText!==diskText)errors.push(`Staged content differs from reviewed file: ${file}`);
    if(file!=='scripts/check-public.mjs'&&secretPatterns.some(pattern=>pattern.test(stagedText)))errors.push(`Potential private staged content: ${file}`);
  }
}catch{ /* Clean export can be checked before git init. */ }
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Public boundary passed: ${allow.length} explicit text/code files; document links resolved.`);
