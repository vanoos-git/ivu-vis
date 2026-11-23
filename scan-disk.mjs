import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'C:\\');
const output = path.resolve(process.argv[3] || 'disk-report.html');
const excludedFolder = path.resolve('C:/D/Downloads/_TS').toLowerCase();
const minSize = 100 * 1024 ** 2;
let skipped = 0;
let links = 0;
let files = 0;
const candidates = [];
const majorFiles = [];
const protectedDir = /^(windows|program files(?: \(x86\))?|programdata|recovery|system volume information|\$recycle\.bin|xboxgames)$/i;
const archive = /\.(zip|7z|rar|iso|msi|exe|cab|tar|gz)$/i;
const video = /\.(mp4|mov|mkv|avi|webm|m4v)$/i;

function keep(list, item, limit) {
  if (list.length === limit && item.size <= list.at(-1).size) return;
  list.push(item);
  list.sort((a, b) => b.size - a.size);
  if (list.length > limit) list.pop();
}

function scan(folder, level, protectedArea = false, category = '') {
  const result = { name: path.basename(folder) || folder, size: 0, children: [] };
  const normalizedFolder = folder.toLowerCase();
  if (normalizedFolder === excludedFolder || normalizedFolder.startsWith(excludedFolder + path.sep)) return result;
  let directory;
  try {
    directory = fs.opendirSync(folder);
  } catch {
    skipped++;
    return result;
  }
  try {
    for (let entry = directory.readSync(); entry; entry = directory.readSync()) {
      const full = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) {
        links++;
        continue;
      }
      if (entry.isDirectory()) {
        const system = protectedArea || (level === 0 && protectedDir.test(entry.name))
          || /^(\.git|\.codex|\$SysReset|\$WinREAgent)$/i.test(entry.name);
        const group = category || (/(^|\\)Users\\[^\\]+\\AppData\\Local\\Temp$/i.test(full)
          || (level === 0 && /^temp$/i.test(entry.name)) ? 'Временные' :
          /(^|\\)Users\\[^\\]+\\Downloads$/i.test(full) ? 'Загрузки' : '');
        const child = scan(full, level + 1, system, group);
        result.size += child.size;
        if (level < 5 && child.size > 0) keep(result.children, child, 30);
        if (!system && group && !category && child.size > 0) {
          keep(candidates, { full, size: child.size, group, directory: true }, 120);
        }
      } else if (entry.isFile()) {
        let stat;
        try {
          stat = fs.statSync(full);
        } catch {
          skipped++;
          continue;
        }
        files++;
        result.size += stat.size;
        if (stat.size < minSize) continue;
        const extensionGroup = level > 0 && !/\\AppData\\|\\\.git\\/i.test(full)
          ? archive.test(entry.name) ? 'Архивы и установщики' : video.test(entry.name) ? 'Видео' : '' : '';
        const item = { full, size: stat.size, date: stat.mtime.toISOString().slice(0, 10),
          group: protectedArea ? '' : category || extensionGroup };
        keep(majorFiles, item, 100);
        if (item.group) keep(candidates, item, 120);
      }
    }
  } catch {
    skipped++;
  } finally {
    directory.closeSync();
  }
  return result;
}

console.log('Scanning ' + root);
const tree = scan(root, 0);
if (files === 0) throw new Error('No readable files at ' + root);
const report = { root, time: new Date().toISOString(), tree, files, skipped, links, candidates, majorFiles };
const template = fs.readFileSync(new URL('./disk-report.template.html', import.meta.url), 'utf8');
fs.writeFileSync(output, template.replace('/* REPORT_DATA */', () =>
  JSON.stringify(report).replaceAll('<', '\\u003c')));
console.log(JSON.stringify({ output, files, skipped, links, candidates: candidates.length }));

