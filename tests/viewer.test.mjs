import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createViewer,parseRange} from '../viewer/server.mjs';
import {loadLibrary,inside} from '../viewer/library.mjs';

async function fixture(t){
  const root=await mkdtemp(path.join(tmpdir(),'wangchuan-viewer-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'catalog'));await mkdir(path.join(root,'library'));
  return root;
}
test('video ranges support seeking, suffixes and reject invalid input',()=>{
  assert.deepEqual(parseRange('bytes=2-5',10),{start:2,end:5});
  assert.deepEqual(parseRange('bytes=-3',10),{start:7,end:9});
  assert.deepEqual(parseRange('bytes=5-',10),{start:5,end:9});
  for(const value of ['bytes=10-','bytes=3-1','bytes=-0','bytes=0-1,3-4','bytes=-'])assert.throws(()=>parseRange(value,10));
});
test('empty public checkout starts without personal library',async t=>{
  const root=await fixture(t);const data=await loadLibrary(root);assert.deepEqual(data.entries,[]);
});
test('approval only applies to exact media hash, changed files are not approved',async t=>{
  const root=await fixture(t);const bytes=Buffer.from('local-video-fixture');
  await writeFile(path.join(root,'library','clip.mp4'),bytes);
  const entry={sequenceId:'seq-0001',title:'My shot',versions:[{relativePath:'library/clip.mp4',approvalStatus:'approved',approvedSha256:createHash('sha256').update(bytes).digest('hex')}]};
  await writeFile(path.join(root,'catalog','viewer-index.json'),JSON.stringify({entries:[entry]}));
  assert.equal((await loadLibrary(root)).entries[0].versions[0].status,'gate1');
  await writeFile(path.join(root,'library','clip.mp4'),'changed-video-file');
  assert.equal((await loadLibrary(root)).entries[0].versions[0].status,'changed');
});
test('media paths cannot leave the chosen library root, including directory links',async t=>{
  const root=await fixture(t);const outside=await mkdtemp(path.join(tmpdir(),'wangchuan-outside-'));
  t.after(()=>rm(outside,{recursive:true,force:true}));
  await writeFile(path.join(outside,'private.mp4'),'secret');
  await symlink(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');
  assert.equal(await inside(root,'linked/private.mp4'),null);
  assert.equal(await inside(root,path.join(outside,'private.mp4')),null);
  assert.equal(await inside(root,'../private.mp4'),null);
});
test('HTTP exposes only registered media and UI; rejects cross-origin and writes',async t=>{
  const root=await fixture(t);await writeFile(path.join(root,'library','clip.mp4'),'abcdefghij');
  await writeFile(path.join(root,'secret.txt'),'secret');
  await writeFile(path.join(root,'catalog','viewer-index.json'),JSON.stringify({entries:[{sequenceId:'seq-0001',title:'Local',versions:[{relativePath:'library/clip.mp4'}]}]}));
  const server=await createViewer({root,port:0});t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const data=await(await fetch(`${base}/api/library`)).json();
  assert.equal(JSON.stringify(data).includes(root),false);
  const url=base+data.entries[0].versions[0].url;
  const range=await fetch(url,{headers:{Range:'bytes=2-5'}});assert.equal(range.status,206);assert.equal(await range.text(),'cdef');
  assert.equal((await fetch(url,{method:'HEAD'})).headers.get('content-length'),'10');
  assert.equal((await fetch(`${base}/secret.txt`)).status,404);
  assert.equal((await fetch(`${base}/api/library`,{headers:{Origin:'https://evil.example'}})).status,403);
  const hostileHost=await new Promise((resolve,reject)=>{const req=http.get(`${base}/api/library`,{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);});req.on('error',reject);});
  assert.equal(hostileHost,403);
  assert.equal((await fetch(`${base}/api/library`,{method:'POST'})).status,405);
});
