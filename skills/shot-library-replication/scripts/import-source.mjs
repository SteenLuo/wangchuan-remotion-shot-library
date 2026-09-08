import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access, copyFile, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const fail = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
};

export const normalizeSequence = (value) => {
  const match = String(value ?? '').match(/^(?:seq-?)?(\d{1,4})$/i);
  if (!match) fail('SOURCE_ID_INVALID', 'Sequence must look like seq-0071 or 71.');
  return `seq-${match[1].padStart(4, '0')}`;
};

export const safeFileName = (value) => {
  const parsed = path.parse(path.basename(value));
  const base = parsed.name.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/[. ]+$/g, '').slice(0, 120) || 'reference';
  const extension = parsed.ext.toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12) || '.mp4';
  return `${base}${extension}`;
};

const parseArgs = (argv) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (!token.startsWith('--')) fail('SOURCE_INPUT_INVALID', `Unexpected argument: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail('SOURCE_INPUT_INVALID', `Missing value for ${token}`);
    result[token.slice(2)] = value;
    index += 1;
  }
  return result;
};

const exists = async (target) => {
  try { await access(target); return true; } catch { return false; }
};

const walk = async (directory, output = []) => {
  if (!await exists(directory)) return output;
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target, output);
    else output.push(target);
  }
  return output;
};

const hashFile = async (target) => createHash('sha256').update(await readFile(target)).digest('hex').toUpperCase();
const toPosix = (value) => value.replaceAll('\\', '/');

const sourceRecords = async (projectRoot) => {
  const files = (await walk(path.join(projectRoot, 'sources'))).filter((file) => path.basename(file) === 'source-record.json');
  const records = [];
  for (const file of files) {
    try {
      const record = JSON.parse(await readFile(file, 'utf8'));
      const hashes = [record.sourceSha256, ...(record.attachments ?? []).map((item) => item.sha256)].filter(Boolean).map((item) => String(item).toUpperCase());
      records.push({file, sequenceId: record.sequenceId, hashes});
    } catch {
      // A malformed historical record is not silently repaired by source import.
    }
  }
  return records;
};

const usedSequenceIds = async (projectRoot) => {
  const ids = new Set();
  const visitDirectories = async (directory) => {
    if (!await exists(directory)) return;
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      if (/^seq-\d{4}$/.test(entry.name)) ids.add(entry.name);
      await visitDirectories(path.join(directory, entry.name));
    }
  };
  for (const directory of [path.join(projectRoot, 'library'), path.join(projectRoot, 'sources')]) {
    await visitDirectories(directory);
  }
  return ids;
};

export const allocateSequenceId = (usedIds) => {
  const numbers = [...usedIds].map((id) => Number(id.slice(4))).filter(Number.isFinite);
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  if (next > 9999) fail('SOURCE_ID_EXHAUSTED', 'No four-digit sequence ID remains.');
  return `seq-${String(next).padStart(4, '0')}`;
};

const probeVideo = (target) => {
  let parsed;
  try {
    parsed = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,duration:format=duration', '-of', 'json', target], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
  } catch (error) {
    fail('SOURCE_DECODE_FAILED', 'ffprobe could not read the supplied video.', {message: error.message});
  }
  const video = parsed.streams?.find((stream) => stream.codec_type === 'video');
  if (!video) fail('SOURCE_DECODE_FAILED', 'No video stream was found.');
  const [numerator, denominator = '1'] = String(video.r_frame_rate).split('/').map(Number);
  return {
    width: Number(video.width),
    height: Number(video.height),
    fps: numerator / denominator,
    durationSeconds: Number(video.duration ?? parsed.format?.duration),
    frameCount: Number(video.nb_read_frames),
    videoCodec: video.codec_name,
    audioStreams: parsed.streams.filter((stream) => stream.codec_type === 'audio').map((stream) => ({index: stream.index, codec: stream.codec_name})),
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) fail('SOURCE_INPUT_INVALID', '--file is required.');
  const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const projectRoot = path.resolve(args['project-root'] ?? defaultRoot);
  const inputPath = path.resolve(args.file);
  if (!await exists(inputPath)) fail('SOURCE_INPUT_INVALID', 'The supplied video file does not exist.');
  const inputHash = await hashFile(inputPath);
  const records = await sourceRecords(projectRoot);
  const duplicate = records.find((record) => record.hashes.includes(inputHash));
  const used = await usedSequenceIds(projectRoot);
  const requestedId = args.sequence ? normalizeSequence(args.sequence) : null;
  if (duplicate) {
    if (requestedId && requestedId !== duplicate.sequenceId) {
      fail('SOURCE_DUPLICATE', 'The same source hash already belongs to another sequence.', {existingSequenceId: duplicate.sequenceId, requestedId});
    }
    process.stdout.write(`${JSON.stringify({ok: true, status: 'duplicate-existing-source', sequenceId: duplicate.sequenceId, sourceSha256: inputHash, sourceRecord: toPosix(path.relative(projectRoot, duplicate.file))}, null, 2)}\n`);
    return;
  }
  const sequenceId = requestedId ?? allocateSequenceId(used);
  if (used.has(sequenceId)) fail('SOURCE_ID_CONFLICT', `${sequenceId} already exists with a different source.`);
  const media = probeVideo(inputPath);
  const fileName = safeFileName(inputPath);
  const destinationRoot = path.join(projectRoot, 'sources', 'direct', sequenceId);
  const destination = path.join(destinationRoot, fileName);
  const recordPath = path.join(destinationRoot, 'source-record.json');
  const record = {
    schemaVersion: 2,
    sequenceId,
    sourceOrigin: 'direct_file',
    sourceOriginalName: path.basename(inputPath),
    sourceRelativePath: toPosix(path.relative(projectRoot, destination)),
    sourceSha256: inputHash,
    importedAt: new Date().toISOString(),
    media,
    externalRefs: {feishu: null},
  };
  const result = {ok: true, status: args.dryRun ? 'dry-run' : 'imported', sequenceId, proposedLocalPath: record.sourceRelativePath, sourceSha256: inputHash, media};
  if (!args.dryRun) {
    await mkdir(destinationRoot, {recursive: true});
    await copyFile(inputPath, destination);
    if (await hashFile(destination) !== inputHash) fail('SOURCE_COPY_MISMATCH', 'Copied source hash does not match the supplied file.');
    await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    result.sourceRecord = toPosix(path.relative(projectRoot, recordPath));
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ok: false, failureCode: error.code ?? 'SOURCE_IMPORT_FAILED', message: error.message, details: error.details ?? null}, null, 2)}\n`);
  process.exitCode = 1;
});
