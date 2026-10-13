// 목록(catalog.json)의 '권한 키' 판정을 새 규칙으로 다시 본다: 걸렸던 문장을 새 규칙에 다시 넣어 보고, 안 걸리면 지운 뒤 등급을 다시 매긴다.
// GitHub 호출 없음. 사용: node tools/regrade-perm.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { scanFiles, grade } from '../public/js/check.mjs';
const path = new URL('../public/catalog.json', import.meta.url);
const c = JSON.parse(readFileSync(path, 'utf8'));
const DESC = '쓰기·거래·출금 권한 키를 요구';
let kept = 0, dropped = 0;
for (const s of c.skills) {
  const i = (s.risks || []).findIndex(r => r.text.startsWith(DESC));
  if (i < 0) continue;
  const quote = (s.risks[i].text.match(/"(.*)"$/) || [])[1] || '';
  const again = scanFiles([{ path: 'x/SKILL.md', text: quote }], 'x/SKILL.md').risks.some(r => r.text.startsWith(DESC));
  if (again) { kept++; continue; }
  dropped++;
  s.risks.splice(i, 1);
  s.grade = grade(s.license, s.flags, s.risks, s.opaque || []);
  console.log('지움:', s.id, '|', quote);
}
writeFileSync(path, JSON.stringify(c));
console.log(`유지 ${kept} · 지움 ${dropped}`);
