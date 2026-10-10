import { checkRepo, parseUrl } from './check.mjs';
import { initQuiz } from './quiz.mjs';

const $ = s => document.querySelector(s);
const GRADES = ['A', 'B', 'C', 'D'];
const PAGE = 30;
const COMMERCIAL = { yes: '상업 사용 가능', conditions: '조건부', readme: 'README에만 표기', custom: '원문 확인', no: '상업 사용 불가', unknown: '확인 불가' };
const DUTY = {
  'MIT': 'LICENSE 파일(저작권 고지)을 스킬 폴더에 같이 둡니다.',
  'Apache-2.0': 'LICENSE(와 NOTICE가 있으면 NOTICE)를 같이 두고, 고친 파일엔 고쳤다고 적습니다.',
  'BSD': 'LICENSE 파일(저작권 고지)을 같이 둡니다.',
  'ISC': 'LICENSE 파일(저작권 고지)을 같이 둡니다.',
  'CC0/Unlicense': '지킬 조건이 없습니다.',
  'CC-BY': '만든 사람(출처)을 표시합니다.',
};

let catalog = { skills: [], repos: [] };
let quiz = null;
const state = { q: '', cat: '전체', grades: new Set(['A', 'B']), sort: 'grade', shown: PAGE };

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 못 해도 동작 */ } },
};

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
const fmtStars = n => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n ?? 0));

// ---------- 탭 ----------
function showTab(name) {
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  for (const t of ['list', 'quiz', 'check', 'about']) $(`#tab-${t}`).hidden = t !== name;
  // 진단 중에는 맨 위 소개를 접어 질문에 집중
  $('.hero').hidden = name === 'quiz';
  if (name === 'quiz' && quiz) quiz.start();
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  showTab(b.dataset.tab);
  if (b.dataset.tab !== 'check') history.replaceState(null, '', location.pathname + (b.dataset.tab === 'list' ? '' : `#${b.dataset.tab}`));
}));

// 스킬 위치(저장소·브랜치·폴더)를 url에서 꺼낸다: https://github.com/{owner}/{repo}/tree/{ref}/{path}
function locationOf(s) {
  const m = String(s.url || '').match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/tree\/([^/]+)\/?(.*)$/);
  if (!m) return null;
  return { repo: m[1], ref: m[2], path: m[3] || '(저장소 맨 위)' };
}

const koOf = s => (typeof s.ko === 'string' ? s.ko : (s.ko && s.ko.ko) || '');

// ---------- 카드 ----------
function card(s) {
  const li = $('#card-tpl').content.firstElementChild.cloneNode(true);
  const g = li.querySelector('.g');
  g.textContent = s.grade.letter;
  g.classList.add(`g-${s.grade.letter}`);
  g.title = s.grade.label;
  li.querySelector('.name').textContent = s.name;
  const repo = s.repo || '';
  li.querySelector('.meta').innerHTML = `${repo ? `github.com/${esc(repo)} · ★${fmtStars(s.stars)} · ` : ''}${esc(s.category)}`;
  const lic = li.querySelector('.lic');
  lic.textContent = `${COMMERCIAL[s.license.commercial] || ''} · ${s.license.id}`;
  lic.classList.add(s.license.commercial);
  lic.title = s.license.note || '';
  li.querySelector('.desc').innerHTML = koOf(s) ? esc(koOf(s)) : `<span class="en">${esc(s.description || '(설명 없음)')}</span>`;
  li.querySelector('.cat').textContent = s.category;
  li.querySelector('.why').innerHTML = `<b>${esc(s.grade.label)}</b>: ${esc(s.grade.reasons.join(' · '))}${koOf(s) && s.description ? `<br><span class="en">${esc(s.description)}</span>` : ''}`;
  li.dataset.id = s.id || '';

  const flags = li.querySelector('.flags');
  const items = [
    ...s.flags.map(f => [f.level, f.text]),
    ...s.risks.map(r => [`risk-${r.level}`, `위험(${({ low: '낮음', medium: '중간', high: '높음' })[r.level]}): ${r.text}`]),
  ];
  if (!items.length) items.push(['good', '출처·위험 신호에서 걸린 것이 없음']);
  flags.innerHTML = items.map(([c, t]) => `<li class="${esc(c)}">${esc(t)}</li>`).join('');

  // 설치는 링크를 주지 않는다(혹시 모를 사고 예방). 주소는 글자로 보여 주고,
  // 사용자가 자기 AI(Claude Code·Codex 등)에게 "확인하고 설치해 줘"라고 붙여 넣을 문장을 준다.
  const howto = li.querySelector('.howto');
  const loc = locationOf(s);
  const duty = DUTY[s.license.id];
  const evidence = s.license_url ? s.license_url.replace(/^https:\/\//, '') : s.license.source;
  const prompt = loc && `GitHub 저장소 ${loc.repo}의 "${loc.path}" 폴더에 있는 스킬 "${s.name}"을 설치해 줘.\n` +
    `설치하기 전에 먼저 확인해서 알려 줘:\n` +
    `1) 그 폴더(또는 저장소)의 LICENSE가 ${s.license.id}가 맞는지, 상업적으로 써도 되는지\n` +
    `2) SKILL.md와 스크립트에 위험한 내용(비밀키·인증 파일 읽기, 외부로 데이터 전송, 인터넷에서 받은 스크립트 바로 실행, 사용자 몰래 하라는 지시)이 없는지\n` +
    `내가 좋다고 하면 그때 설치해 줘. 주소가 github.com/${loc.repo}가 아니면 설치하지 마.`;
  howto.innerHTML = `
    <p><b>라이선스 근거:</b> <code>${esc(evidence)}</code>${s.license.note ? ` — ${esc(s.license.note)}` : ''}</p>
    ${s.license.commercial === 'yes' && duty ? `<p><b>지킬 것:</b> ${esc(duty)}</p>` : ''}
    ${s.license.commercial === 'no' || s.license.commercial === 'unknown' || !loc
      ? '<p><b>설치 전에:</b> 상업적으로 쓰려면 저작권자에게 허락을 받아야 합니다. 개인 학습용으로 볼 때도 라이선스 원문을 확인하세요.</p>'
      : `<p><b>설치:</b> 링크를 따로 드리지 않습니다. 쓰시는 AI(Claude Code·Codex 등)에 아래 문장을 붙여 넣으면, AI가 라이선스와 위험한 내용을 먼저 확인한 뒤 설치합니다.</p>
         <div class="prompt"><pre>${esc(prompt)}</pre><button type="button" class="copy">복사</button></div>
         <p class="small">스킬 위치: <code>github.com/${esc(loc.repo)}/tree/${esc(loc.ref)}/${esc(loc.path)}</code></p>`}`;
  const copy = howto.querySelector('.copy');
  if (copy) copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(prompt); copy.textContent = '복사됨'; }
    catch { const r = document.createRange(); r.selectNodeContents(howto.querySelector('pre')); getSelection().removeAllRanges(); getSelection().addRange(r); copy.textContent = '선택됨 — Ctrl+C'; }
    setTimeout(() => { copy.textContent = '복사'; }, 2000);
  });
  return li;
}

// ---------- 추천 목록 ----------
function filtered() {
  const q = state.q.trim().toLowerCase();
  let list = catalog.skills.filter(s =>
    state.grades.has(s.grade.letter) &&
    (state.cat === '전체' || s.category === state.cat) &&
    (!q || `${s.name} ${s.description} ${typeof s.ko === 'string' ? s.ko : ''} ${s.repo} ${s.category}`.toLowerCase().includes(q)));
  const gi = l => GRADES.indexOf(l);
  if (state.sort === 'grade') list.sort((a, b) => gi(a.grade.letter) - gi(b.grade.letter) || (b.stars || 0) - (a.stars || 0) || a.name.localeCompare(b.name));
  if (state.sort === 'stars') list.sort((a, b) => (b.stars || 0) - (a.stars || 0) || a.name.localeCompare(b.name));
  if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function renderList() {
  const list = filtered();
  const ul = $('#cards');
  ul.replaceChildren(...list.slice(0, state.shown).map(card));
  $('#count').textContent = list.length ? `${list.length}개 스킬` : '조건에 맞는 스킬이 없어요. 등급이나 용도를 바꿔 보세요.';
  $('#more').hidden = list.length <= state.shown;
}

function renderFilters() {
  const cats = ['전체', ...[...new Set(catalog.skills.map(s => s.category))].sort((a, b) => (a === '기타') - (b === '기타') || a.localeCompare(b, 'ko'))];
  $('#cats').innerHTML = cats.map(c => `<button type="button" class="chip" aria-pressed="${c === state.cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  $('#cats').onclick = e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.cat = b.dataset.cat; state.shown = PAGE;
    $('#cats').querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderList();
  };
  const labels = { A: 'A 추천', B: 'B 조건부', C: 'C 주의', D: 'D 비추천' };
  $('#grades').innerHTML = GRADES.map(g => `<label><input type="checkbox" value="${g}" ${state.grades.has(g) ? 'checked' : ''}> <span class="g g-${g}" style="width:22px;height:22px;font-size:12px;border-radius:6px">${g}</span>${labels[g].slice(2)}</label>`).join('');
  $('#grades').onchange = e => {
    if (e.target.checked) state.grades.add(e.target.value); else state.grades.delete(e.target.value);
    state.shown = PAGE; renderList();
  };
}

function renderStats() {
  const n = catalog.skills.length;
  const by = l => catalog.skills.filter(s => s.grade.letter === l).length;
  const notFree = catalog.skills.filter(s => s.license.commercial === 'no' || s.license.commercial === 'unknown').length;
  $('#stats').innerHTML = [
    [n.toLocaleString(), `스킬 검사 (저장소 ${catalog.repos.length}곳)`],
    [by('A').toLocaleString(), 'A 추천'],
    [(by('B') + by('C')).toLocaleString(), 'B·C 확인하고 쓰기'],
    [notFree.toLocaleString(), '상업 사용 불가·확인 불가'],
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  const off = catalog.skills.filter(s => s.repo === 'anthropics/skills');
  const prop = off.filter(s => s.license.commercial === 'no').map(s => s.name);
  if (prop.length) {
    $('#finding').innerHTML = `예: Anthropic 공식 저장소(anthropics/skills)도 스킬마다 라이선스가 다릅니다. <b>${esc(prop.join(' · '))}</b>는 공개돼 있지만 상업적으로 쓸 수 없습니다.`;
  }
  if (catalog.built_at) $('#built').textContent = `목록 갱신 ${new Date(catalog.built_at).toLocaleDateString('ko-KR')}`;
}

// ---------- 용도별 한눈에 ----------
const CAT_ICON = {
  '개발·코딩': '⌨', 'AI·에이전트': '✦', '글쓰기·마케팅': '✎', '데이터·분석': '▦', '연동·API': '⇄', '업무·생산성': '✓',
  '보안': '⛨', '디자인·이미지': '◐', '테스트·디버깅': '⚑', '연구·과학': '⚗', '문서·오피스': '▤', '기타': '·',
};
function renderOverview() {
  const byCat = {};
  for (const s of catalog.skills) (byCat[s.category] ||= []).push(s);
  const cats = Object.keys(byCat).sort((a, b) => (a === '기타') - (b === '기타') ||
    byCat[b].filter(s => s.grade.letter === 'A').length - byCat[a].filter(s => s.grade.letter === 'A').length);
  $('#overview').innerHTML = cats.map(c => {
    const list = byCat[c];
    const a = list.filter(s => s.grade.letter === 'A');
    // 같은 이름(여러 저장소의 사본)은 하나만, 한 저장소에서 2개까지(여러 곳을 보여 주려고), 한국어 설명·별 많은 것 먼저
    const seen = new Set();
    const perRepo = {};
    const top = [...a].sort((x, y) => (!!koOf(y) - !!koOf(x)) || (y.stars || 0) - (x.stars || 0))
      .filter(s => {
        if (seen.has(s.name) || (perRepo[s.repo] || 0) >= 2) return false;
        seen.add(s.name); perRepo[s.repo] = (perRepo[s.repo] || 0) + 1;
        return true;
      }).slice(0, 5);
    const dist = GRADES.map(g => [g, list.filter(s => s.grade.letter === g).length]);
    return `<section class="ov">
      <header><h3><span class="ic" aria-hidden="true">${CAT_ICON[c] || '·'}</span>${esc(c)}</h3>
        <span class="ov-n">A ${a.length} / ${list.length}</span></header>
      <div class="bar" aria-label="등급 분포">${dist.map(([g, n]) => n ? `<i class="b-${g}" style="flex:${n}" title="${g} ${n}개"></i>` : '').join('')}</div>
      <ol>${top.map(s => `<li><button type="button" data-open="${esc(s.id)}"><b>${esc(s.name)}</b><span>${esc(koOf(s) || s.description)}</span></button></li>`).join('') || '<li class="none">A등급 없음</li>'}</ol>
      <button type="button" class="ov-more" data-cat="${esc(c)}">${esc(c)} 전체 ${list.length}개 보기 →</button>
    </section>`;
  }).join('');
}
function setView(v) {
  document.querySelectorAll('.views button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  $('#overview').hidden = v !== 'overview';
  $('#all-view').hidden = v !== 'all';
}
document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
$('#overview').addEventListener('click', e => {
  const more = e.target.closest('.ov-more');
  const open = e.target.closest('[data-open]');
  if (more) {
    state.cat = more.dataset.cat; state.q = ''; $('#q').value = ''; state.shown = PAGE;
    $('#cats').querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.cat === state.cat)));
    setView('all'); renderList(); $('#all-view').scrollIntoView({ block: 'start' });
  } else if (open) {
    openSkill(open.dataset.open);
  }
});

// 목록에서 스킬 하나를 찾아 펼친다(용도별 상자·진단 결과에서 씀)
function openSkill(id) {
  const s = catalog.skills.find(x => x.id === id);
  if (!s) return;
  showTab('list'); history.replaceState(null, '', location.pathname);
  state.cat = '전체'; state.q = s.name; $('#q').value = s.name; state.shown = PAGE;
  $('#cats').querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.cat === '전체')));
  setView('all'); renderList();
  const li = [...document.querySelectorAll('#cards .card')].find(x => x.dataset.id === s.id);
  if (li) { li.querySelector('details').open = true; li.scrollIntoView({ block: 'center' }); }
}

$('#q').addEventListener('input', e => { state.q = e.target.value; state.shown = PAGE; renderList(); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; renderList(); });
$('#more').addEventListener('click', () => { state.shown += PAGE; renderList(); });

// ---------- 직접 검사 ----------
const CACHE_MS = 24 * 3600 * 1000;
async function runCheck(input) {
  const msg = $('#check-msg');
  const btn = $('#check-btn');
  msg.className = 'msg';
  $('#check-repo').innerHTML = '';
  $('#check-cards').replaceChildren();
  let key;
  try { const p = parseUrl(input); key = `sc:${p.owner}/${p.repo}/${p.ref}/${p.sub}`.toLowerCase(); }
  catch (e) { msg.className = 'msg err'; msg.textContent = e.message; return; }
  history.replaceState(null, '', `#check=${encodeURIComponent(input.trim())}`);

  let res = null;
  const cached = store.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) res = cached.res;
  if (!res) {
    btn.disabled = true;
    try {
      res = await checkRepo(input, { onProgress: t => { msg.textContent = `${t}…`; } });
      store.set(key, { at: Date.now(), res });
    } catch (e) {
      msg.className = 'msg err'; msg.textContent = e.message; btn.disabled = false; return;
    }
    btn.disabled = false;
  }
  renderCheck(res, cached && res === cached.res);
}

function renderCheck(res, fromCache) {
  const r = res.repo;
  const dist = GRADES.map(g => [g, res.skills.filter(s => s.grade.letter === g).length]).filter(([, n]) => n);
  $('#check-msg').textContent = res.skills.length
    ? `${fromCache ? '저장된 결과(24시간 안에 검사함) · ' : ''}스킬 ${res.total_skills}개 중 ${res.skills.length}개 검사${res.truncated ? ' (큰 저장소는 앞 40개만 — 하위 폴더 주소를 넣으면 그 부분만 검사)' : ''}`
    : 'SKILL.md가 있는 스킬을 찾지 못했어요. 스킬 폴더 주소가 맞는지 확인해 주세요.';
  $('#check-repo').innerHTML = `<div class="repo-box">
    <h3>github.com/${esc(r.full_name)}</h3>
    <div>★${fmtStars(r.stars)} · 저장소 라이선스: ${esc(r.license || 'GitHub 표시 없음')} · 마지막 업데이트 ${esc(new Date(r.pushed).toLocaleDateString('ko-KR'))}</div>
    <div class="dist">${dist.map(([g, n]) => `<span class="g g-${g}" style="width:auto;padding:0 10px;height:28px;font-size:13px">${g} ${n}</span>`).join('')}</div>
    <ul class="flags">${res.repoFlags.map(f => `<li class="${esc(f.level)}">${esc(f.text)}</li>`).join('')}</ul>
  </div>`;
  const gi = l => GRADES.indexOf(l);
  const list = [...res.skills].sort((a, b) => gi(a.grade.letter) - gi(b.grade.letter) || a.name.localeCompare(b.name));
  $('#check-cards').replaceChildren(...list.map(s => card({ ...s, repo: '', stars: null })));
}

$('#check-form').addEventListener('submit', e => { e.preventDefault(); runCheck($('#url').value); });
document.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { $('#url').value = b.dataset.ex; runCheck(b.dataset.ex); }));

// ---------- 시작 ----------
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('check=')) { showTab('check'); $('#url').value = h.slice(6); runCheck(h.slice(6)); }
  else if (h.startsWith('quiz=')) { showTab('quiz'); quiz.fromHash(h.slice(5)); }
  else if (h === 'check' || h === 'about' || h === 'quiz') showTab(h);
  else showTab('list');
}

(async () => {
  try {
    const r = await fetch('catalog.json', { cache: 'no-cache' });
    catalog = await r.json();
  } catch {
    $('#count').textContent = '추천 목록을 불러오지 못했어요. 새로고침해 주세요.';
  }
  quiz = initQuiz({
    skills: catalog.skills, root: $('#quiz'), onOpen: openSkill,
    onRoute: h => history.replaceState(null, '', `#${h}`),
  });
  $('#quiz-cta').addEventListener('click', () => { showTab('quiz'); history.replaceState(null, '', '#quiz'); scrollTo(0, 0); });
  renderStats();
  renderFilters();
  renderOverview();
  renderList();
  route();
})();
