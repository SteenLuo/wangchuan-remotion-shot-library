import http from 'node:http';
import {readFile, mkdir, stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {loadLibrary} from './library.mjs';

const uiRoot = path.dirname(fileURLToPath(import.meta.url));
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw Error('range');
  const start = match[1] ? Number(match[1]) : Math.max(0,size-Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]),size-1) : size-1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) throw Error('range');
  return {start,end};
}
const mime = file => ({'.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.jpg':'image/jpeg','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}[path.extname(file)] || 'application/octet-stream');
const jobs = new Map();
let active = 0;
const waiting = [];
async function poster(root, media) {
  const key = createHash('sha256').update(`${media.file}:${media.size}:${media.mtimeMs}`).digest('hex');
  const dir = path.join(root,'.cache','shot-viewer');
  const file = path.join(dir,`${key}.jpg`);
  try { if ((await stat(file)).size) return file; } catch {}
  if (!jobs.has(key)) jobs.set(key, (async () => {
    if (active >= 2) await new Promise(resolve => waiting.push(resolve));
    active++;
    try {
      await mkdir(dir,{recursive:true});
      await new Promise((resolve,reject) => {
        const child = spawn('ffmpeg',['-v','error','-threads','1','-i',media.file,'-ss','0.5','-frames:v','1','-vf','scale=640:-2','-threads','1','-q:v','4','-y',file],{windowsHide:true,stdio:'ignore'});
        const timer = setTimeout(() => { child.kill(); reject(Error('poster timeout')); },20000);
        child.on('error',e => { clearTimeout(timer); reject(e); });
        child.on('exit',code => { clearTimeout(timer); code === 0 ? resolve() : reject(Error('poster failed')); });
      });
      if (!(await stat(file)).size) throw Error('empty poster');
      return file;
    } finally { active--; waiting.shift()?.(); }
  })().finally(() => jobs.delete(key)));
  return jobs.get(key);
}

export async function createViewer({root,port=8848}) {
  let snapshot;
  let lastRead = 0;
  let loading;
  async function refresh() {
    if (snapshot && Date.now()-lastRead < 15000) return snapshot;
    if (!loading) loading = loadLibrary(root).then(value => { snapshot=value; lastRead=Date.now(); return value; }).finally(() => {loading=null;});
    return loading;
  }
  const server = http.createServer(async(req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const finish = (code,text) => {res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?'':text);};
    const address = server.address();
    const host = req.headers.host;
    const allowed = [`127.0.0.1:${address.port}`,`localhost:${address.port}`];
    if (!allowed.includes(host) || (req.headers.origin && !allowed.map(h=>`http://${h}`).includes(req.headers.origin)) || req.headers['sec-fetch-site']==='cross-site') return finish(403,'仅允许本机同源访问');
    if (!['GET','HEAD'].includes(req.method)) return finish(405,'只读页面');
    try {
      const pathname = new URL(req.url,`http://${host}`).pathname;
      if (pathname === '/health') {res.writeHead(200,{'Content-Type':'application/json'});return res.end(req.method==='HEAD'?'':JSON.stringify({ok:true,service:'wangchuan-shot-viewer'}));}
      if (pathname === '/api/library') {
        const data = await refresh();
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
        return res.end(req.method==='HEAD'?'':JSON.stringify({entries:data.entries,warnings:data.warnings}));
      }
      let file;
      const assets = {'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
      if (assets[pathname]) file=path.join(uiRoot,assets[pathname]);
      else {
        const match = /^\/(media|poster)\/([a-f\d]{24})$/.exec(pathname);
        if (!match) return finish(404,'未找到');
        const data=await refresh();
        const media=data.media.get(match[2]);
        if (!media) return finish(404,'未找到媒体');
        if (match[1] === 'poster') {
          try {file=await poster(root,media);} catch {return finish(503,'预览图暂不可用；仍可打开视频');}
        } else {
          // Re-resolve each request so replacement with a junction cannot expose outside files.
          const {inside} = await import('./library.mjs');
          file=await inside(root,path.relative(root,media.file));
          if (!file) return finish(404,'文件不可用');
        }
      }
      const info=await stat(file);
      let range;
      try {range=parseRange(req.headers.range,info.size);} catch {res.setHeader('Content-Range',`bytes */${info.size}`);return finish(416,'无效播放范围');}
      const start=range?.start ?? 0,end=range?.end ?? info.size-1;
      const headers={'Content-Type':mime(file),'Content-Length':end-start+1,'Accept-Ranges':'bytes'};
      if (range) headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
      res.writeHead(range?206:200,headers);
      if (req.method==='HEAD') return res.end();
      const stream=createReadStream(file,{start,end});
      stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
    } catch {if (!res.headersSent) finish(500,'读取失败，请检查本地镜头记录');else res.destroy();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
  const root=path.resolve(option('--library-root',path.join(uiRoot,'..')));
  createViewer({root,port:Number(option('--port',8848))}).then(server=>console.log(`WangChuan 镜头库：http://127.0.0.1:${server.address().port}`)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
