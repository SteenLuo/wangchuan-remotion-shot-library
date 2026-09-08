import {readFile, readdir, stat, realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

export const json = async (file, fallback = null) => {
  try { return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};
export const children = async (dir) => {
  try { return (await readdir(dir, {withFileTypes:true})).filter(e => e.isDirectory() && !e.isSymbolicLink()).map(e => e.name); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
};
export async function inside(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /^[a-z]:/i.test(relative) || relative.includes(':')) return null;
  const absolute = path.resolve(root, relative);
  const base = await realpath(root);
  let resolved;
  try { resolved = await realpath(absolute); } catch { return null; }
  const remainder = path.relative(base, resolved);
  if (!remainder || remainder.startsWith('..') || path.isAbsolute(remainder)) return null;
  return resolved;
}
export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
const hashCache = new Map();
async function verified(file, expected) {
  if (!/^[a-f\d]{64}$/i.test(expected || '')) return false;
  const info = await stat(file);
  const key = `${file}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
  if (!hashCache.has(key)) { if (hashCache.size > 500) hashCache.clear(); hashCache.set(key, await sha256(file)); }
  return hashCache.get(key).toLowerCase() === expected.toLowerCase();
}
const approved = status => ['approved', 'approved-by-user'].includes(status);
const labelOf = value => value?.primary?.name || '';

// This adapter reads existing records; it never rebuilds cards or changes approval state.
export async function loadLibrary(root) {
  const warnings = [];
  const safeJson = async file => {
    const target = await inside(root, file);
    if (!target) return null;
    try { return await json(target); } catch { warnings.push(`无法读取记录：${file}`); return null; }
  };
  const batches = new Map();
  for (const folder of await children(path.join(root, 'out'))) {
    const batch = await safeJson(`out/${folder}/batch-state.json`);
    if (batch?.mode !== 'replication' || !Array.isArray(batch.shots)) continue;
    for (const item of batch.shots) {
      const previous = batches.get(item.sequenceId);
      if (!previous || String(batch.updatedAt || '') > previous.updatedAt) batches.set(item.sequenceId, {...item, updatedAt: String(batch.updatedAt || '')});
    }
  }
  const manual = await safeJson('catalog/viewer-index.json');
  const custom = new Map((Array.isArray(manual?.entries) ? manual.entries : []).map(e => [e.sequenceId, e]));
  const shots = new Map();
  for (const scene of ['a-roll', 'b-roll', 'pip']) {
    for (const id of await children(path.join(root, 'library', scene))) {
      if (!/^seq-\d{4}$/.test(id)) continue;
      const base = `library/${scene}/${id}`;
      const manifest = await safeJson(`${base}/shot-manifest.json`);
      const card = await safeJson(`${base}/metadata/shot-card.json`);
      const eagle = await safeJson(`${base}/publish/eagle/eagle-item.json`);
      const state = await safeJson(`${base}/experiments/upgraded-mvp-v1/control/execution-state.json`);
      const batch = batches.get(id);
      const tags = [labelOf(card?.classification?.visualForm), labelOf(card?.classification?.contentRelation), labelOf(card?.classification?.narrativeFunction), ...(manifest?.contentRole || [])].filter(x => typeof x === 'string' && x);
      const versions = [];
      if (batch?.candidate?.relativePath) versions.push({label:'保真复刻', relativePath:batch.candidate.relativePath, approvedSha256:batch.gate1?.approvedSha256, approvalStatus:batch.gate1?.status, gate:'gate1'});
      for (const gate of ['gate2', 'gate1']) {
        const approval = state?.approvals?.[gate];
        if (approval?.relativePath) versions.push({label:gate === 'gate2' ? '彩色替换' : '保真复刻', relativePath:approval.relativePath, approvedSha256:approval.artifactSha256, approvalStatus:approval.status, gate});
      }
      if (!versions.length) versions.push({label:'本地预览', relativePath:`${base}/preview/${id}-preview.mp4`});
      const frames=batch?.technicalQa?.frames || batch?.frameCount || manifest?.timing?.referenceDurationInFrames;
      const fps=batch?.technicalQa?.fps || batch?.sourceProbe?.fps || manifest?.canvas?.fps;
      const durationSeconds=frames && fps ? frames/fps : manifest?.timing?.referenceDurationSeconds;
      shots.set(id, {sequenceId:id, title:String(eagle?.title || eagle?.name || manifest?.title || tags[0] || '未命名镜头').replace(/^序号\d+[_\s]*/, ''), sceneType:manifest?.sceneType || (scene === 'pip' ? 'PIP' : scene === 'a-roll' ? 'A-roll' : 'B-roll'), tags, versions, description:card?.usage?.conditions?.join('；') || '', width:manifest?.canvas?.width, height:manifest?.canvas?.height, durationSeconds});
    }
  }
  for (const [id, entry] of custom) {
    if (!/^seq-\d{4}$/.test(id)) { warnings.push('跳过无效镜头编号'); continue; }
    const previous = shots.get(id);
    shots.set(id, {...previous, ...entry, versions:[...(entry.versions || []), ...(previous?.versions || [])]});
  }
  const media = new Map();
  const entries = [];
  for (const shot of shots.values()) {
    const versions = [];
    const seen = new Set();
    for (const version of shot.versions || []) {
      const file = await inside(root, version.relativePath);
      if (!file || !/\.(mp4|webm|mov)$/i.test(file) || seen.has(file)) continue;
      const info = await stat(file);
      if (!info.isFile() || !info.size) continue;
      seen.add(file);
      const id = createHash('sha256').update(file).digest('hex').slice(0,24);
      const hasApproval = approved(version.approvalStatus);
      const hashMatches = hasApproval ? await verified(file, version.approvedSha256) : false;
      const status = hashMatches ? (version.gate === 'gate2' ? 'gate2' : 'gate1') : hasApproval ? 'changed' : 'preview';
      media.set(id, {file, size:info.size, mtimeMs:info.mtimeMs});
      versions.push({id, label:version.label || '本地预览', status, url:`/media/${id}`, poster:`/poster/${id}`, fileName:path.basename(file), modifiedAt:info.mtime.toISOString()});
    }
    // Current explicit versions take precedence; never pick an arbitrary newest MP4.
    if (!versions.length) continue;
    const tags = Array.isArray(shot.tags) ? shot.tags.filter(x => typeof x === 'string') : [];
    entries.push({sequenceId:shot.sequenceId, title:String(shot.title || '未命名镜头'), sceneType:String(shot.sceneType || 'B-roll'), tags, description:String(shot.description || ''), width:shot.width, height:shot.height, durationSeconds:shot.durationSeconds, versions});
  }
  return {entries:entries.sort((a,b) => a.sequenceId.localeCompare(b.sequenceId)), media, warnings};
}
