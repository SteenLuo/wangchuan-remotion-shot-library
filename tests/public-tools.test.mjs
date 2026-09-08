import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {usedSequenceIds,allocateSequenceId} from '../skills/shot-library-replication/scripts/import-source.mjs';
test('new source IDs cannot collide with locally registered viewer shots',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'wangchuan-import-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'catalog'));
  await writeFile(path.join(root,'catalog','viewer-index.json'),JSON.stringify({entries:[{sequenceId:'seq-0007'}]}));
  assert.equal(allocateSequenceId(await usedSequenceIds(root)),'seq-0008');
});
