// 스킬 진단 시험: 가상 사용자 10명의 답으로 추천 세트를 만들고 규칙을 지키는지 확인한다.
// 사용: node eval/quiz-eval.mjs [--show]
import { readFileSync } from 'node:fs';
import { prepare, recommend, nextQuestion, axes, typeOf, wants, OBJ_LABEL } from '../public/js/quiz-engine.mjs';

const cat = JSON.parse(readFileSync(new URL('../public/catalog.json', import.meta.url), 'utf8'));
const prep = prepare(cat.skills);

const P = [
  { who: '문서 많은 1인 사장님', a: { goal: ['docs', 'work'], docs_type: ['word', 'pdf', 'slides'], docs_do: ['create', 'analyze'], work_type: ['email'], text: '매주 매출 엑셀을 정리해서 보고용 발표자료로 만들고 싶다', money: 'yes', code: 'none', style: 'auto', power: 'safe', exp: 'some', size: 6 } },
  { who: '유튜버', a: { goal: ['design', 'writing'], design_type: ['video', 'image'], write_type: ['sns'], text: '유튜브 썸네일과 쇼츠 대본', money: 'yes', code: 'none', style: 'mix', power: 'mid', exp: 'daily', size: 6 } },
  { who: '웹 개발자', a: { goal: ['dev'], dev_area: ['web', 'backend'], dev_stage: ['review', 'git'], text: '리액트 앱 테스트랑 코드 리뷰 자동화', money: 'yes', style: 'auto', power: 'any', exp: 'daily', size: 10 } },
  { who: '마케터', a: { goal: ['writing', 'data'], write_type: ['seo', 'sns'], data_type: ['chart'], text: '', money: 'yes', code: 'none', style: 'mix', power: 'mid', exp: 'some', size: 6 } },
  { who: '대학원생', a: { goal: ['research'], res_type: ['paper', 'science'], text: '논문 찾아서 요약하고 인용 정리', money: 'no', code: 'some', style: 'hands', power: 'mid', exp: 'some', size: 6 } },
  { who: '쇼핑몰 셀러', a: { goal: ['writing', 'data'], write_type: ['shop'], data_type: ['collect', 'sheet'], text: '아마존 경쟁 상품 가격 조사', money: 'yes', code: 'none', style: 'auto', power: 'any', exp: 'new', size: 6 } },
  { who: 'AI 입문자', a: { goal: ['ai'], ai_type: ['prompt'], text: '', money: 'unsure', code: 'none', style: 'mix', power: 'safe', exp: 'new', size: 3 } },
  { who: '에이전트 만드는 사람', a: { goal: ['ai', 'dev'], ai_type: ['skill', 'agent'], dev_area: ['backend'], text: 'MCP 서버랑 스킬 만들기', money: 'yes', style: 'auto', power: 'any', exp: 'daily', size: 10 } },
  { who: '보안 담당', a: { goal: ['security'], sec_type: ['code', 'policy'], text: '', money: 'yes', code: 'pro', style: 'hands', power: 'mid', exp: 'daily', size: 6 } },
  { who: '디자이너', a: { goal: ['design'], design_type: ['web', 'image'], text: '랜딩 페이지 디자인을 고급스럽게', money: 'yes', code: 'some', style: 'hands', power: 'safe', exp: 'some', size: 6 } },
];

let fail = 0;
const show = process.argv.includes('--show');
for (const { who, a } of P) {
  // 질문 흐름: 몇 개를 묻는지
  const asked = []; const ans = {};
  for (let q; (q = nextQuestion(prep, ans, asked));) { asked.push(q.id); ans[q.id] = a[q.id] ?? (q.auto || (q.options ? q.options[0].v : '')); if (asked.length > 20) break; }
  const r = recommend(prep, a);
  const ax = axes(a);
  const errs = [];
  const code = a.goal.includes('dev') ? 'pro' : a.code;
  for (const it of r.items) {
    const s = it.skill, t = it.tags;
    if (s.grade.letter === 'D') errs.push(`D등급 ${s.name}`);
    if (a.money !== 'no' && !'AB'.includes(s.grade.letter)) errs.push(`상업용인데 ${s.grade.letter} ${s.name}`);
    if (a.power === 'safe' && (t.power || t.key)) errs.push(`안전인데 권한 ${s.name}`);
    if (code === 'none' && t.dev) errs.push(`코딩 못 하는데 개발자용 ${s.name}`);
  }
  const names = r.items.map(i => i.skill.name.toLowerCase());
  if (new Set(names).size !== names.length) errs.push('같은 이름 중복');
  const per = {}; r.items.forEach(i => (per[i.skill.repo] = (per[i.skill.repo] || 0) + 1));
  if (Object.values(per).some(n => n > 2)) errs.push('한 저장소 3개 이상');
  if (r.items.length < Math.min(a.size, 3)) errs.push(`추천 ${r.items.length}개뿐`);
  if (asked.length > 12) errs.push(`질문 ${asked.length}개`);
  fail += errs.length ? 1 : 0;
  console.log(`${errs.length ? '✗' : '✓'} ${who}: 질문 ${asked.length}개 · 후보 ${r.total} · 추천 ${r.items.length} · ${typeOf(ax).name} · 못 덮은 것 ${r.missing.map(id => OBJ_LABEL[id]).join(',') || '없음'}${errs.length ? '\n   ' + errs.join(' / ') : ''}`);
  if (show) for (const it of r.items) console.log(`   ${it.pct}% ${it.skill.grade.letter} ${it.skill.name} (${it.skill.repo}) — ${it.skill.ko || ''} | ${it.why.join(' · ')}`);
}
console.log(fail ? `실패 ${fail}/${P.length}` : `모두 통과 ${P.length}/${P.length}`);
process.exit(fail ? 1 : 0);
