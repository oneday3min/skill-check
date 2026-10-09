// 라이선스 판정 규칙을 고친 뒤, 목록(catalog.json)을 GitHub API 호출 없이 다시 판정한다.
// 근거 LICENSE 파일은 raw.githubusercontent.com에서 다시 읽고, SKILL.md·README 근거는 저장된 문구로 다시 판정.
// 사용: node tools/relicense.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { classify, fromSpdx } from '../public/js/license.mjs';
import { grade } from '../public/js/check.mjs';

const p = new URL('../public/catalog.json', import.meta.url);
const c = JSON.parse(readFileSync(p, 'utf8'));
const repos = Object.fromEntries(c.repos.map(r => [r.full_name, r]));
const cache = {};
const raw = async (repo, ref, path) => {
  const k = `${repo}@${ref}/${path}`;
  if (!(k in cache)) {
    const r = await fetch(`https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/${path.split('/').map(encodeURIComponent).join('/')}`);
    cache[k] = r.ok ? await r.text() : null;
  }
  return cache[k];
};

let changed = 0;
for (const s of c.skills) {
  const repo = repos[s.repo];
  const src = s.license.source || '';
  let v = null;
  if (/^원본 /.test(src) || src === '없음') continue;                          // 원본 사본 판정·라이선스 없음은 그대로
  const fmText = (src.match(/^SKILL\.md license 필드\("(.*)"\)$/) || [])[1];
  if (fmText) v = classify(fmText);
  else if (src === 'README 문구') {
    const note = (s.license.note.match(/"(.*)"/) || [])[1] || '';
    const nv = classify(note);
    v = nv && nv.commercial === 'yes' ? { id: `README: ${nv.id}`, commercial: 'readme', note: s.license.note } : null;
  } else if (src === '저장소 라이선스(GitHub 표시)') v = fromSpdx(repo.license === 'GPL' ? 'GPL-3.0' : repo.license);
  else if (src !== 'SKILL.md license 필드') {
    const text = await raw(s.repo, repo.ref, src);
    if (text) v = classify(text);
  }
  if (!v || v.id === s.license.id) continue;
  const before = `${s.grade.letter} ${s.license.id}`;
  s.license = { ...v, source: src };
  // 라이선스 이름이 들어간 "서로 다름" 경고는 새 판정 기준으로 다시 본다
  s.flags = s.flags.filter(f => !/저장소 전체는 .+인데 이 스킬은/.test(f.text));
  if (repo.license && fromSpdx(repo.license === 'GPL' ? 'GPL-3.0' : repo.license)?.id !== v.id && !s.flags.some(f => /서로 다름/.test(f.text))) {
    s.flags.push({ level: 'warn', text: `저장소 전체는 ${repo.license}인데 이 스킬은 ${v.id} — 스킬마다 따로 확인해야 함` });
  }
  s.grade = grade(s.license, s.flags, s.risks);
  s.license_url = s.license_url || null;
  changed++;
  console.log(`${s.id}: ${before} → ${s.grade.letter} ${v.id}`);
}
writeFileSync(p, JSON.stringify(c));
console.log(`다시 판정: ${changed}개 바뀜`);
