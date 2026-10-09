// 스킬 버전(skill/skill-check/)에 검사 코드 복사: node tools/pack-skill.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const dest = new URL('skill/skill-check/scripts/lib/', root);
mkdirSync(dest, { recursive: true });
for (const f of ['check.mjs', 'license.mjs', 'known.mjs']) copyFileSync(new URL(`public/js/${f}`, root), new URL(f, dest));
const cli = readFileSync(new URL('cli.mjs', root), 'utf8').replace("'./public/js/check.mjs'", "'./lib/check.mjs'");
writeFileSync(new URL('skill/skill-check/scripts/cli.mjs', root), cli);
copyFileSync(new URL('LICENSE', root), new URL('skill/skill-check/LICENSE', root));
console.log('skill/skill-check 갱신 완료');
