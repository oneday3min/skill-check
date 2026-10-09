// 로컬 폴더를 위험 신호 규칙으로 검사: node tools/selftest.mjs skill/skill-check
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scanFiles } from '../public/js/check.mjs';
const root = resolve(process.argv[2] || 'skill/skill-check');
const walk = d => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]);
const files = walk(root).filter(f => /\.(md|txt|mjs|js|py|sh)$/.test(f))
  .map(f => ({ path: f.slice(root.length + 1).replace(/\\/g, '/'), text: readFileSync(f, 'utf8') }));
const r = scanFiles(files, 'SKILL.md');
console.log(r.risks.length || r.flags.length ? JSON.stringify(r, null, 1) : '걸린 것 없음');
