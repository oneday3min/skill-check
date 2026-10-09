// 추천 목록 만들기: repos.txt의 저장소를 검사해 public/catalog.json으로 저장.
// 사용: node catalog/build.mjs   (GitHub 키 없이 시간당 60회 → 저장소 30개까지 한 번에 가능)
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { checkRepo } from '../public/js/check.mjs';

const here = new URL('.', import.meta.url);
// 한 줄: owner/repo [include=폴더1,폴더2]
const lines = readFileSync(new URL('repos.txt', here), 'utf8').split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
const include = Object.fromEntries(lines.map(l => [l.split(/\s+/)[0].toLowerCase(), ((l.match(/include=(\S+)/) || [])[1] || '').split(',').filter(Boolean)]));
const repos = lines.map(l => l.split(/\s+/)[0]);
// 한국어 한 줄 설명·용도: ko_*.tsv (id \t 용도 \t 설명), 사람이 쓴 것
const ko = {};
for (const f of readdirSync(here).filter(n => /^ko_.*\.tsv$/.test(n))) {
  for (const line of readFileSync(new URL(f, here), 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const [id, cat, text] = line.split('\t');
    if (id && text) ko[id.trim()] = { cat: cat.trim(), ko: text.trim() };
  }
}
// 경로가 바뀌어도(사본 대신 원본 폴더를 고르게 되는 등) 같은 저장소·같은 스킬 이름이면 설명을 다시 쓴다
const byName = {};
for (const [id, v] of Object.entries(ko)) {
  const parts = id.split('/');
  byName[`${parts[0]}/${parts[1]}::${parts[parts.length - 1]}`.toLowerCase()] = v;
}
const koOf = s => ko[s.id] || byName[`${s.repo}::${s.id.split('/').pop()}`.toLowerCase()];
const withKo = s => { const k = koOf(s); return { ...s, category: (k && k.cat) || s.category, ko: (k && k.ko) || '' }; };

// 이어서 만들기: 이미 검사한 저장소는 건너뛴다(--refresh면 전부 다시)
const outPath = new URL('../public/catalog.json', here);
const prev = existsSync(outPath) && !process.argv.includes('--refresh') ? JSON.parse(readFileSync(outPath, 'utf8')) : { repos: [], skills: [] };
const out = { built_at: new Date().toISOString(), repos: [], skills: [] };
const done = new Set(prev.repos.map(r => r.full_name.toLowerCase()));
let limited = false;
for (const r of repos) {
  if (done.has(r.toLowerCase())) {
    out.repos.push(prev.repos.find(x => x.full_name.toLowerCase() === r.toLowerCase()));
    out.skills.push(...prev.skills.filter(s => s.repo.toLowerCase() === r.toLowerCase()).map(withKo));
    continue;
  }
  if (limited) { console.log(`${r}: 건너뜀(한도) — 다음 실행 때`); continue; }
  try {
    const res = await checkRepo(r, { include: include[r.toLowerCase()] });
    out.repos.push({ ...res.repo, flags: res.repoFlags, total_skills: res.total_skills, truncated: res.truncated });
    for (const s of res.skills) {
      const id = `${res.repo.full_name}/${s.path}`;
      out.skills.push(withKo({ id, repo: res.repo.full_name, stars: res.repo.stars, ...s }));
    }
    const g = res.skills.reduce((a, s) => (a[s.grade.letter] = (a[s.grade.letter] || 0) + 1, a), {});
    console.log(`${res.repo.full_name}: ${res.skills.length}/${res.total_skills}  ${JSON.stringify(g)}`);
  } catch (e) {
    console.log(`${r}: 실패 — ${e.message}`);
    if (/한도/.test(e.message)) limited = true;
  }
}
writeFileSync(outPath, JSON.stringify(out));
console.log(`저장: 저장소 ${out.repos.length}개, 스킬 ${out.skills.length}개`);
