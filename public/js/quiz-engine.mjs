// 스킬 진단 계산(화면 없음): 질문 목록, 다음 질문 고르기, 점수, 세트 고르기, 성향 4축.
// 방식: 지식 기반 추천 — 조건으로 거르고(등급·권한·코딩) 가중 점수로 순위, 겹치지 않게 욕심껏 세트를 채운다.
// 브라우저와 Node(eval/quiz-eval.mjs)가 같이 쓴다. AI 호출·서버 전송 없음.
import { tagSkill, detect, grams, textOf, OBJECTS, TASKS } from './tags.mjs';

export const OBJ_LABEL = Object.fromEntries(OBJECTS.map(([id, l]) => [id, l]));
export const TASK_LABEL = Object.fromEntries(TASKS.map(([id, l]) => [id, l]));

// ---------- 질문 ----------
// 선택지 효과: o(다루는 것), k(하는 일), cats(분류), set(답 기록)
export const GOALS = [
  { v: 'docs', label: '문서·오피스 작업', hint: '워드·PDF·발표자료·엑셀', cats: ['문서·오피스', '업무·생산성'], o: ['word', 'pdf', 'slides', 'sheet', 'docs'] },
  { v: 'design', label: '디자인·이미지·영상', hint: '포스터·로고·영상·웹 화면', cats: ['디자인·이미지'], o: ['image', 'video', 'web', 'audio'] },
  { v: 'writing', label: '글쓰기·마케팅·SNS', hint: '블로그·광고·SNS·판매', cats: ['글쓰기·마케팅'], o: ['writing', 'marketing', 'shop'] },
  { v: 'data', label: '데이터 분석·보고', hint: '표 정리·차트·지표', cats: ['데이터·분석'], o: ['data', 'sheet', 'db', 'finance'] },
  { v: 'dev', label: '개발·코딩', hint: '웹·앱·서버·테스트', cats: ['개발·코딩', '테스트·디버깅', '연동·API'], o: ['code', 'web', 'backend', 'git', 'cloud', 'mobile', 'db'] },
  { v: 'work', label: '업무 관리', hint: '메일·일정·회의·계획', cats: ['업무·생산성'], o: ['email', 'docs'] },
  { v: 'research', label: '연구·조사·공부', hint: '논문·과학·법률·시장 조사', cats: ['연구·과학'], o: ['research', 'science', 'legal'] },
  { v: 'ai', label: 'AI 에이전트 만들기', hint: '프롬프트·에이전트·스킬', cats: ['AI·에이전트'], o: ['ai'] },
  { v: 'security', label: '보안 점검', hint: '취약점·권한·규정', cats: ['보안'], o: ['security'] },
];

// 고른 일에 따라 나오는 세부 질문(여러 개 고르기)
export const BRANCH = [
  { id: 'docs_type', group: 'docs', text: '어떤 문서를 주로 다루나요?', options: [
    { v: 'word', label: '워드·한글 문서', o: ['word'] }, { v: 'pdf', label: 'PDF', o: ['pdf'] },
    { v: 'slides', label: '발표자료(PPT)', o: ['slides'] }, { v: 'sheet', label: '엑셀·표', o: ['sheet'] },
    { v: 'docs', label: '기획서·보고서·회의록', o: ['docs'] }] },
  { id: 'docs_do', group: 'docs', text: '문서로 무엇을 하나요?', options: [
    { v: 'create', label: '새로 만들기', k: ['create'] }, { v: 'edit', label: '고치기·변환·번역', k: ['edit'] },
    { v: 'analyze', label: '내용 뽑기·요약', k: ['analyze'] }] },
  { id: 'design_type', group: 'design', text: '무엇을 만들고 싶나요?', options: [
    { v: 'image', label: '이미지·포스터·로고', o: ['image'] }, { v: 'video', label: '영상', o: ['video'] },
    { v: 'web', label: '웹 화면 디자인', o: ['web'] }, { v: 'audio', label: '소리·음성', o: ['audio'] },
    { v: 'game3d', label: '게임·3D', o: ['game3d'] }] },
  { id: 'write_type', group: 'writing', text: '어떤 글·마케팅인가요?', options: [
    { v: 'writing', label: '블로그·긴 글', o: ['writing'] }, { v: 'sns', label: 'SNS·광고 문구', o: ['marketing'], t: 'social ads copy sns 광고' },
    { v: 'mail', label: '메일·뉴스레터', o: ['email', 'writing'], t: 'email newsletter' }, { v: 'seo', label: '검색 노출(SEO)', o: ['marketing'], t: 'seo search ranking 검색' },
    { v: 'shop', label: '쇼핑몰·판매', o: ['shop'] }] },
  { id: 'data_type', group: 'data', text: '어떤 데이터 일을 하나요?', options: [
    { v: 'sheet', label: '엑셀·CSV 정리', o: ['sheet'] }, { v: 'chart', label: '차트·대시보드', o: ['data'], t: 'chart dashboard visualization 차트' },
    { v: 'db', label: '데이터베이스·SQL', o: ['db'] }, { v: 'finance', label: '돈·회계·가격', o: ['finance'] },
    { v: 'collect', label: '시장·상품 데이터 모으기', o: ['shop'], k: ['search'] }] },
  { id: 'dev_area', group: 'dev', text: '무엇을 개발하나요?', options: [
    { v: 'web', label: '웹 화면', o: ['web'] }, { v: 'backend', label: '서버·API', o: ['backend'] },
    { v: 'mobile', label: '모바일 앱', o: ['mobile'] }, { v: 'cloud', label: '클라우드·배포', o: ['cloud'] },
    { v: 'db', label: '데이터베이스', o: ['db'] }, { v: 'game3d', label: '게임·3D', o: ['game3d'] }] },
  { id: 'dev_stage', group: 'dev', text: '개발에서 어디를 도움받고 싶나요?', options: [
    { v: 'create', label: '새로 만들기·설계', k: ['create'] }, { v: 'review', label: '테스트·디버깅', k: ['review'] },
    { v: 'edit', label: '코드 정리·리팩터링', k: ['edit'], o: ['code'] }, { v: 'git', label: 'GitHub·코드 리뷰', o: ['git'] },
    { v: 'ops', label: '배포·운영', k: ['ops'], o: ['cloud'] }] },
  { id: 'work_type', group: 'work', text: '어떤 업무를 줄이고 싶나요?', options: [
    { v: 'email', label: '메일·일정·회의', o: ['email'] }, { v: 'docs', label: '기획서·보고서 쓰기', o: ['docs'] },
    { v: 'plan', label: '할 일 쪼개기·계획', o: ['email'], t: 'plan planning task breakdown 계획' },
    { v: 'connect', label: '노션·슬랙 같은 도구 연동', o: ['email'], k: ['automate'], t: 'notion slack jira integration 연동' }] },
  { id: 'res_type', group: 'research', text: '무엇을 조사하나요?', options: [
    { v: 'paper', label: '논문 찾기·정리', o: ['research'] }, { v: 'science', label: '과학·의료', o: ['science'] },
    { v: 'legal', label: '법률·계약·규정', o: ['legal'] }, { v: 'market', label: '시장·경쟁사 조사', o: ['marketing'], k: ['search', 'analyze'], t: 'competitor market research 경쟁사' }] },
  { id: 'ai_type', group: 'ai', text: 'AI로 무엇을 만들고 싶나요?', options: [
    { v: 'prompt', label: '프롬프트 다듬기', o: ['ai'], t: 'prompt 프롬프트' }, { v: 'agent', label: '에이전트·자동화 설계', o: ['ai'], k: ['automate'], t: 'agent workflow 에이전트' },
    { v: 'skill', label: '스킬·MCP 만들기', o: ['ai'], t: 'skill mcp server 스킬' }, { v: 'team', label: '여러 AI에게 일 나눠 시키기', o: ['ai'], t: 'parallel agents subagent team' }] },
  { id: 'sec_type', group: 'security', text: '어떤 보안 일이 필요한가요?', options: [
    { v: 'code', label: '코드 취약점 점검', o: ['security', 'code'] }, { v: 'access', label: '비밀키·계정 권한 관리', o: ['security'], t: 'secret access permission 권한' },
    { v: 'policy', label: '위협 분석·규정 준비', o: ['security', 'legal'], t: 'threat compliance 규정' }] },
];

// 공통 질문(한 개 고르기)
export const COMMON = [
  { id: 'money', text: '돈 버는 일(회사 업무·유료 서비스·외주)에도 쓰나요?', sub: '"예"면 상업적으로 무료인 스킬만 고릅니다.', options: [
    { v: 'yes', label: '예, 돈 버는 일에 써요' }, { v: 'unsure', label: '아직 모르겠어요', hint: '안전하게 "예"처럼 고릅니다' }, { v: 'no', label: '아니요, 개인 공부·취미예요' }] },
  { id: 'code', text: '코딩은 어느 정도 하나요?', skipIf: a => (a.goal || []).includes('dev'), auto: 'pro', options: [
    { v: 'none', label: '전혀 못 해요' }, { v: 'some', label: '복사해서 실행하는 정도' }, { v: 'pro', label: '직접 짤 수 있어요' }] },
  { id: 'style', text: '반복되는 일은 어떻게 하고 싶나요?', options: [
    { v: 'auto', label: 'AI에게 통째로 맡기고 싶어요' }, { v: 'mix', label: 'AI가 초안, 마무리는 내가' }, { v: 'hands', label: '내가 하고 AI는 옆에서 조언' }] },
  { id: 'power', text: 'AI에게 강한 권한을 줘도 괜찮나요?', sub: '인터넷 접속·명령 실행·외부 서비스 가입이 필요한 스킬', options: [
    { v: 'safe', label: '안전 우선 — 그런 스킬은 빼 주세요' }, { v: 'mid', label: '가입은 괜찮고, 위험 표시만 빼 주세요' }, { v: 'any', label: '기능이 좋으면 상관없어요' }] },
  { id: 'exp', text: 'AI는 얼마나 써 봤나요?', options: [
    { v: 'new', label: '이제 막 시작했어요' }, { v: 'some', label: '가끔 써요' }, { v: 'daily', label: '매일 써요' }] },
  { id: 'size', text: '몇 개를 추천받을까요?', sub: '많이 깔수록 비슷한 스킬끼리 헷갈릴 수 있어요.', options: [
    { v: 3, label: '가볍게 3개' }, { v: 6, label: '기본 세트 6개' }, { v: 10, label: '넉넉하게 10개' }] },
];
export const TEXT_Q = { id: 'text', text: '하고 싶은 일을 한 문장으로 적어 주세요', sub: '예: 매주 매출 엑셀을 정리해서 보고용 발표자료로 만들고 싶다 (건너뛰어도 돼요)' };
export const MAX_QUESTIONS = 12;
export const MAX_BRANCH = 4;

// ---------- 준비 ----------
export function prepare(skills) {
  return skills.map(s => ({ s, t: tagSkill(s), g: grams(textOf(s)) }));
}

// 비슷한 말 사전: 한국어 문장을 영어 설명과도 맞춰 보려고 영어 단어를 덧붙인다
const SYN = [
  [/찾/, 'search find 검색'], [/정리/, 'organize manage 관리'], [/요약/, 'summary summarize'], [/만들|작성|생성/, 'create generate'],
  [/엑셀|스프레드/, 'excel xlsx spreadsheet csv'], [/발표|ppt|슬라이드/, 'slide presentation pptx deck'], [/워드|한글 문서/, 'docx word document'],
  [/논문/, 'paper literature research'], [/인용|참고문헌/, 'citation reference bibliography'], [/영상|동영상/, 'video'], [/유튜브/, 'youtube video'],
  [/썸네일|표지|커버/, 'thumbnail cover image'], [/대본|스크립트/, 'script'], [/블로그/, 'blog article post'], [/번역/, 'translate translation'],
  [/메일/, 'email'], [/회의/, 'meeting notes'], [/일정/, 'calendar schedule'], [/보고/, 'report'], [/매출|수익/, 'revenue sales'],
  [/가격/, 'price pricing'], [/경쟁/, 'competitor'], [/상품|제품/, 'product'], [/쇼핑몰|스마트스토어/, 'ecommerce shop store'],
  [/광고/, 'ads advertising campaign'], [/검색 노출|seo/i, 'seo search ranking'], [/디자인/, 'design'], [/로고/, 'logo brand'],
  [/랜딩|홈페이지|웹사이트/, 'landing page website'], [/고급/, 'premium elegant'], [/테스트/, 'test testing'], [/리뷰|검토/, 'review'],
  [/자동/, 'automate automation workflow'], [/계약/, 'contract legal'], [/세금|회계/, 'tax accounting'], [/데이터/, 'data'], [/차트|그래프/, 'chart graph'],
];
export function expand(text) {
  const t = String(text || '');
  return `${t} ${SYN.filter(([re]) => re.test(t)).map(([, w]) => w).join(' ')}`;
}

// 답 → 원하는 것(가중치)
export function wants(a) {
  const o = {}, k = {}, cats = new Set(), terms = [];
  const add = (m, ids, w) => { for (const id of ids || []) m[id] = Math.max(m[id] || 0, w); };
  for (const v of a.goal || []) { const g = GOALS.find(x => x.v === v); if (g) { add(o, g.o, 1); g.cats.forEach(c => cats.add(c)); } }
  for (const q of BRANCH) {
    for (const v of a[q.id] || []) {
      const op = q.options.find(x => x.v === v); if (!op) continue;
      add(o, op.o, 3); add(k, op.k, 1.5); if (op.t) terms.push(op.t);
    }
  }
  const d = detect(expand(a.text));
  add(o, d.o, 3); add(k, d.k, 1);
  const qg = grams(`${expand(a.text)} ${terms.join(' ')}`);
  return { o, k, cats, qg, textG: grams(a.text || ''), detected: d };
}

// 조건으로 거르기
export function allowed(x, a) {
  const { s, t } = x;
  const L = s.grade.letter;
  if (L === 'D') return false;
  if (a.money !== 'no' && !(L === 'A' || L === 'B')) return false;
  if (a.power === 'safe' && (t.power >= 1 || t.key)) return false;
  if (a.power === 'mid' && t.power >= 2) return false;
  const code = (a.goal || []).includes('dev') ? 'pro' : a.code;
  if (code === 'none' && t.dev) return false;
  if ((a.exclude || []).includes(s.id)) return false;
  return true;
}

// 점수: 관련도(다루는 것 > 분류 > 하는 일 > 한 문장) + 품질 + 성향
export function score(x, w, a) {
  const { s, t, g } = x;
  let obj = 0;
  for (const id of t.o) obj += w.o[id] || 0;
  obj = Math.min(obj, 6) * (t.oc ? 1 : 0.5); // 핵심 문장이 아닌 곳에서만 잡혔으면 약한 근거
  const cat = w.cats.has(s.category) ? 2.5 : 0;
  let task = 0;
  for (const id of t.k) task += w.k[id] || 0;
  task = Math.min(task, 2) * 0.7;
  let text = 0;
  // 직접 적은 문장이 있으면 더 크게
  if (w.qg.size) { let hit = 0; for (const q of w.qg) if (g.has(q)) hit++; text = (w.textG.size ? 8 : 3) * hit / w.qg.size; }
  const rel = obj + cat + task + text;
  if (rel < 2) return { total: 0, rel };
  let q = (s.grade.letter === 'A' ? 1 : s.grade.letter === 'B' ? 0.3 : 0) + Math.log10((s.stars || 0) + 1) * 0.25 + (s.ko ? 0.3 : 0);
  if (t.power === 1) q -= 0.3;
  if (t.own) q -= 2; // 특정 회사 전용
  if (a.power === 'safe' && s.grade.letter === 'B') q -= 1.5; // 안전 우선이면 확인할 것이 있는 B는 뒤로
  const auto = { auto: 1, mix: 0.5, hands: 0 }[a.style] ?? 0.5;
  if (t.k.includes('automate')) q += (auto - 0.5) * 2;
  const code = (a.goal || []).includes('dev') ? 'pro' : a.code;
  if (code === 'some' && t.dev) q -= 1;
  if (a.exp === 'new') { if (t.k.includes('learn')) q += 0.5; if (t.scripts) q -= 0.3; }
  return { total: rel + q, rel, obj, cat, task, text };
}

// 다음 세부 질문: 남은 후보를 가장 고르게 가르는 질문(엔트로피가 큰 것)
export function nextBranch(pool, a, asked) {
  const groups = new Set(a.goal || []);
  let best = null;
  for (const q of BRANCH) {
    if (!groups.has(q.group) || asked.includes(q.id)) continue;
    const counts = q.options.map(op => pool.filter(x => (op.o || []).some(id => x.t.o.includes(id)) || (op.k || []).some(id => x.t.k.includes(id))).length);
    const n = counts.reduce((p, c) => p + c, 0);
    if (n < 5) continue; // 가를 후보가 거의 없으면 묻지 않는다
    let h = 0;
    for (const c of counts) if (c) { const p = c / n; h -= p * Math.log2(p); }
    const gain = h * Math.min(1, n / 30);
    if (!best || gain > best.gain) best = { q, gain };
  }
  return best && best.q;
}

// 질문 순서: 고른 일 → 세부(적응형, 최대 4) → 한 문장 → 공통
export function nextQuestion(prep, a, asked) {
  if (!asked.includes('goal')) return { id: 'goal' };
  const branchAsked = asked.filter(id => BRANCH.some(q => q.id === id)).length;
  if (branchAsked < MAX_BRANCH && asked.length < MAX_QUESTIONS) {
    const w = wants(a);
    const pool = prep.filter(x => x.s.grade.letter !== 'D' && score(x, w, a).total > 0);
    const q = nextBranch(pool, a, asked);
    if (q) return q;
  }
  if (!asked.includes('text')) return TEXT_Q;
  for (const q of COMMON) {
    if (asked.includes(q.id)) continue;
    if (q.skipIf && q.skipIf(a)) continue;
    return q;
  }
  return null;
}

// 유사도(겹침 판단): 꼬리표 겹침 + 이름·설명 두 글자 조각 겹침
function sim(x, y) {
  const A = new Set([...x.t.o, ...x.t.k]), B = new Set([...y.t.o, ...y.t.k]);
  let i = 0; for (const v of A) if (B.has(v)) i++;
  const tag = i / (A.size + B.size - i || 1);
  const nx = grams(`${x.s.name} ${x.s.ko || ''}`), ny = grams(`${y.s.name} ${y.s.ko || ''}`);
  let j = 0; for (const v of nx) if (ny.has(v)) j++;
  const name = j / (nx.size + ny.size - j || 1);
  return Math.max(tag * 0.8, name);
}

// 추천 세트: 점수 + 아직 안 덮은 원하는 것 보너스 − 이미 고른 것과 닮은 정도. 한 저장소 2개, 같은 이름 1개.
export function recommend(prep, a) {
  const w = wants(a);
  const size = Number(a.size) || 6;
  let scored = prep.filter(x => allowed(x, a)).map(x => ({ ...x, sc: score(x, w, a) })).filter(x => x.sc.total > 0)
    .sort((p, q) => q.sc.total - p.sc.total).slice(0, 200);
  // 안전 우선: A등급이 충분하면 확인할 것이 있는 B는 아예 뺀다
  if (a.power === 'safe' && scored.filter(x => x.s.grade.letter === 'A').length >= size * 2) scored = scored.filter(x => x.s.grade.letter === 'A');
  const max = scored.length ? scored[0].sc.total : 1;
  const want = Object.entries(w.o).filter(([, v]) => v >= 3).map(([id]) => id);
  const wantSet = want.length ? want : Object.keys(w.o);
  const covered = new Set(), perRepo = {}, names = new Set(), picked = [];
  while (picked.length < size) {
    let best = null;
    for (const x of scored) {
      if (picked.includes(x) || names.has(x.s.name.toLowerCase()) || (perRepo[x.s.repo] || 0) >= 2) continue;
      const cover = x.t.o.filter(id => wantSet.includes(id) && !covered.has(id)).length;
      const red = picked.length ? Math.max(...picked.map(p => sim(x, p))) : 0;
      const v = x.sc.total + 1.5 * Math.min(cover, 2) - 4 * red - (perRepo[x.s.repo] ? 1 : 0); // 같은 저장소 두 번째는 조금 뒤로
      if (!best || v > best.v) best = { x, v };
    }
    if (!best) break;
    const x = best.x;
    picked.push(x);
    names.add(x.s.name.toLowerCase());
    perRepo[x.s.repo] = (perRepo[x.s.repo] || 0) + 1;
    x.t.o.forEach(id => covered.add(id));
  }
  return {
    wants: w,
    total: scored.length,
    items: picked.map(x => ({ skill: x.s, tags: x.t, score: x.sc, pct: Math.max(40, Math.min(99, Math.round(99 * x.sc.total / max))), why: whyOf(x, w) })),
    missing: wantSet.filter(id => !covered.has(id)),
  };
}

function whyOf(x, w) {
  const { s, t } = x;
  const hit = t.o.filter(id => w.o[id]).sort((p, q) => w.o[q] - w.o[p]).slice(0, 3).map(id => OBJ_LABEL[id]);
  const out = [];
  if (hit.length) out.push(`${hit.join('·')}에 맞음`);
  else if (w.cats.has(s.category)) out.push(`${s.category} 분야`);
  if (x.sc.text >= 1) out.push('적어 주신 문장과 비슷함');
  out.push(s.license.commercial === 'yes' ? `상업 사용 가능(${s.license.id})` : `${s.license.id} — 조건 확인`);
  out.push(t.power ? '위험 표시 낮음 1건 이상' : '위험 표시 없음');
  if (s.stars >= 1000) out.push(`★${s.stars >= 10000 ? Math.round(s.stars / 1000) + 'k' : (s.stars / 1000).toFixed(1) + 'k'}`);
  return out;
}

// ---------- 성향 4축 (각 0~100, 높을수록 오른쪽) ----------
export const AXES = [
  { id: 'way', left: '직접 손봄', right: '자동으로 맡김' },
  { id: 'risk', left: '안전 우선', right: '기능 우선' },
  { id: 'range', left: '두루두루', right: '한 우물' },
  { id: 'skill', left: '처음', right: '능숙' },
];
const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
export function axes(a) {
  const goals = (a.goal || []).length;
  const picks = BRANCH.reduce((n, q) => n + (a[q.id] || []).length, 0);
  const code = (a.goal || []).includes('dev') ? 'pro' : a.code;
  return {
    way: clamp(({ auto: 85, mix: 50, hands: 15 }[a.style] ?? 50) + ((a.goal || []).some(g => g === 'ai' || g === 'work') ? 8 : 0)),
    risk: clamp(({ safe: 15, mid: 50, any: 85 }[a.power] ?? 50) - (a.money === 'yes' ? 8 : 0)),
    range: clamp(({ 1: 85, 2: 65, 3: 45 }[goals] ?? 25) - Math.max(0, picks - goals * 2) * 4),
    skill: clamp((({ new: 15, some: 50, daily: 85 }[a.exp] ?? 50) + ({ none: 10, some: 50, pro: 90 }[code] ?? 50)) / 2),
  };
}
const ADJ = { 'safe-new': '꼼꼼한 새내기', 'safe-pro': '신중한 고수', 'bold-new': '용감한 탐험가', 'bold-pro': '거침없는 해커' };
const NOUN = { 'auto-wide': '만능 비서형', 'auto-deep': '자동화 공장장형', 'hand-wide': '멀티 크리에이터형', 'hand-deep': '한 우물 장인형' };
export function typeOf(x) {
  const adj = ADJ[`${x.risk > 50 ? 'bold' : 'safe'}-${x.skill > 50 ? 'pro' : 'new'}`];
  const noun = NOUN[`${x.way > 50 ? 'auto' : 'hand'}-${x.range > 50 ? 'deep' : 'wide'}`];
  return { name: `${adj} · ${noun}`, adj, noun };
}

// 결과가 왜 이렇게 나왔는지(막연한 설명 대신 실제 답을 그대로)
export function basisOf(a) {
  const out = [];
  const goals = (a.goal || []).map(v => GOALS.find(g => g.v === v)?.label).filter(Boolean);
  if (goals.length) out.push(`고른 일: ${goals.join(', ')}`);
  const picks = BRANCH.flatMap(q => (a[q.id] || []).map(v => q.options.find(o => o.v === v)?.label)).filter(Boolean);
  if (picks.length) out.push(`세부: ${picks.join(', ')}`);
  const lab = (id) => { const q = COMMON.find(c => c.id === id); return q && a[id] != null ? q.options.find(o => String(o.v) === String(a[id]))?.label : null; };
  for (const id of ['money', 'code', 'style', 'power', 'exp']) { const l = lab(id); if (l) out.push(l); }
  return out;
}
