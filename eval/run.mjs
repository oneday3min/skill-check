// 정확도 검사: node eval/run.mjs  (public/catalog.json을 읽음, GitHub 호출 없음)
// 비교 기준(baseline): 사람들이 흔히 보는 "GitHub 저장소 첫 화면의 라이선스 표시"만 믿었을 때.
import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const { cases, checked } = JSON.parse(readFileSync(new URL('cases.json', here), 'utf8'));
const catalog = JSON.parse(readFileSync(new URL('../public/catalog.json', here), 'utf8'));
const repoLicense = Object.fromEntries(catalog.repos.map(r => [r.full_name, r.license]));

const ours = c => ({ yes: 'yes', conditions: 'conditions', readme: 'conditions', custom: 'conditions', no: 'no', unknown: 'no' })[c];
const PERMISSIVE = /^(MIT|Apache-2\.0|BSD|ISC|CC0\/Unlicense|CC-BY)$/;
const COPYLEFT = /GPL|MPL|CC-BY-SA|AGPL|LGPL/;
const baseline = lic => (!lic ? 'no' : PERMISSIVE.test(lic) ? 'yes' : COPYLEFT.test(lic) ? 'conditions' : 'no');

let okOurs = 0, okBase = 0, n = 0;
console.log(`정답 확인일 ${checked} · 목록 ${catalog.built_at.slice(0, 10)}\n`);
for (const c of cases) {
  const s = catalog.skills.find(x => (c.id ? x.id === c.id : x.id.startsWith(c.id_prefix)));
  if (!s) { console.log(`  (없음) ${c.id || c.id_prefix}`); continue; }
  n++;
  const o = ours(s.license.commercial);
  const b = baseline(repoLicense[s.repo]);
  okOurs += o === c.expect; okBase += b === c.expect;
  console.log(`${o === c.expect ? '✓' : '✗'} ${b === c.expect ? '✓' : '✗'}  ${s.id}  정답 ${c.expect} · Skill Check ${o}(${s.license.id}) · 저장소 표시만 ${b}(${repoLicense[s.repo] || '없음'})`);
}
console.log(`\nSkill Check ${okOurs}/${n} · 저장소 라이선스 표시만 볼 때 ${okBase}/${n}`);
