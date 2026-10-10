// 꼬리표 검증: 분포 출력, 표본 뽑기, 손 꼬리표(tools/tag-sample.tsv)와 일치도 계산.
// 사용: node tools/tag-audit.mjs [--sample 60]
import { readFileSync, existsSync } from 'node:fs';
import { tagSkill, OBJECTS, TASKS } from '../public/js/tags.mjs';

const cat = JSON.parse(readFileSync(new URL('../public/catalog.json', import.meta.url), 'utf8'));
const tags = cat.skills.map(s => ({ s, t: tagSkill(s) }));
const count = (f) => tags.filter(f).length;

console.log('스킬', tags.length, '| 다루는 것 없음', count(x => !x.t.o.length), '| 하는 일 없음', count(x => !x.t.k.length),
  '| 개발자용', count(x => x.t.dev), '| 키 필요', count(x => x.t.key), '| 권한 2', count(x => x.t.power === 2));
console.log(OBJECTS.map(([id]) => `${id} ${count(x => x.t.o.includes(id))}`).join(' · '));
console.log(TASKS.map(([id]) => `${id} ${count(x => x.t.k.includes(id))}`).join(' · '));

// 고정 순서 표본(매번 같은 것): id 해시로 정렬
const h = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const n = Number(process.argv[process.argv.indexOf('--sample') + 1]) || 0;
if (n) {
  for (const { s, t } of [...tags].sort((a, b) => h(a.s.id) - h(b.s.id)).slice(0, n)) {
    console.log(`\n${s.id}\n  ${s.category} | ${s.ko}\n  ${String(s.description).slice(0, 220)}\n  => o:${t.o.join(',')} k:${t.k.join(',')} dev:${t.dev ? 1 : 0} key:${t.key ? 1 : 0}`);
  }
}

// 손 꼬리표와 비교: id \t o(쉼표) \t k(쉼표) \t dev(0/1)
const sampleFile = new URL('tag-sample.tsv', import.meta.url);
if (existsSync(sampleFile)) {
  const rows = readFileSync(sampleFile, 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
  const byId = Object.fromEntries(tags.map(x => [x.s.id, x.t]));
  const facet = (name, ids, pick) => {
    // 꼬리표마다 있음/없음을 맞춘 비율과 kappa(우연 일치 보정)
    let tp = 0, fp = 0, fn = 0, tn = 0;
    const miss = [];
    for (const r of rows) {
      const auto = byId[r[0]]; if (!auto) continue;
      const hand = new Set((r[pick.col] || '').split(',').filter(Boolean));
      for (const id of ids) {
        const a = pick.get(auto).includes(id), b = hand.has(id);
        if (a && b) tp++; else if (a) { fp++; miss.push(`+${id} ${r[0]}`); } else if (b) { fn++; miss.push(`-${id} ${r[0]}`); } else tn++;
      }
    }
    const N = tp + fp + fn + tn, po = (tp + tn) / N;
    const pe = ((tp + fp) * (tp + fn) + (fn + tn) * (fp + tn)) / N / N;
    console.log(`\n[${name}] 일치 ${(po * 100).toFixed(1)}% · kappa ${((po - pe) / (1 - pe)).toFixed(2)} · 정밀도 ${(tp / (tp + fp) * 100).toFixed(0)}% · 재현율 ${(tp / (tp + fn) * 100).toFixed(0)}%`);
    if (process.argv.includes('--miss')) console.log(miss.join('\n'));
  };
  facet('다루는 것', OBJECTS.map(x => x[0]), { col: 1, get: t => t.o });
  facet('하는 일', TASKS.map(x => x[0]), { col: 2, get: t => t.k });
  facet('개발자용', ['dev'], { col: 3, get: t => (t.dev ? ['dev'] : []) });
}
