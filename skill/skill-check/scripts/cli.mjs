// 사용: node cli.mjs <GitHub 주소> [--json]
import { checkRepo } from './lib/check.mjs';

const url = process.argv[2];
if (!url) { console.log('사용: node cli.mjs https://github.com/owner/repo [--json]'); process.exit(1); }
try {
  const r = await checkRepo(url);
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log(`${r.repo.full_name}  ★${r.repo.stars}  저장소 라이선스: ${r.repo.license || '표시 없음'}  스킬 ${r.total_skills}개`);
  for (const f of r.repoFlags) console.log(`  [${f.level}] ${f.text}`);
  for (const s of r.skills) {
    console.log(`\n${s.grade.letter} ${s.grade.label}  ${s.name}  [${s.category}]  (${s.license.id}, 상업: ${s.license.commercial}, 근거: ${s.license.source})`);
    console.log(`  이유: ${s.grade.reasons.join(' · ')}`);
    for (const f of s.flags) console.log(`  [${f.level}] ${f.text}`);
    for (const x of s.risks) console.log(`  [위험 ${x.level}] ${x.text}`);
  }
} catch (e) { console.error('오류:', e.message); process.exit(1); }
