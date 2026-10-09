import { checkRepo, parseUrl } from './check.mjs';

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
  for (const t of ['list', 'check', 'about']) $(`#tab-${t}`).hidden = t !== name;
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  showTab(b.dataset.tab);
  if (b.dataset.tab !== 'check') history.replaceState(null, '', location.pathname + (b.dataset.tab === 'list' ? '' : `#${b.dataset.tab}`));
}));

// ---------- 카드 ----------
function card(s) {
  const li = $('#card-tpl').content.firstElementChild.cloneNode(true);
  const g = li.querySelector('.g');
  g.textContent = s.grade.letter;
  g.classList.add(`g-${s.grade.letter}`);
  g.title = s.grade.label;
  li.querySelector('.name').textContent = s.name;
  const repo = s.repo || '';
  li.querySelector('.meta').innerHTML = `${repo ? `<a href="https://github.com/${esc(repo)}" target="_blank" rel="noopener">${esc(repo)}</a> · ★${fmtStars(s.stars)} · ` : ''}${esc(s.category)}`;
  const lic = li.querySelector('.lic');
  lic.textContent = `${COMMERCIAL[s.license.commercial] || ''} · ${s.license.id}`;
  lic.classList.add(s.license.commercial);
  lic.title = s.license.note || '';
  const ko = typeof s.ko === 'string' ? s.ko : (s.ko && s.ko.ko) || '';
  li.querySelector('.desc').innerHTML = ko ? esc(ko) : `<span class="en">${esc(s.description || '(설명 없음)')}</span>`;
  li.querySelector('.why').textContent = `${s.grade.label}: ${s.grade.reasons.join(' · ')}`;

  const flags = li.querySelector('.flags');
  const items = [
    ...s.flags.map(f => [f.level, f.text]),
    ...s.risks.map(r => [`risk-${r.level}`, `위험(${({ low: '낮음', medium: '중간', high: '높음' })[r.level]}): ${r.text}`]),
  ];
  if (!items.length) items.push(['good', '출처·위험 신호에서 걸린 것이 없음']);
  flags.innerHTML = items.map(([c, t]) => `<li class="${esc(c)}">${esc(t)}</li>`).join('');

  const howto = li.querySelector('.howto');
  const folder = s.path && s.path !== '(root)' ? s.path.split('/').pop() : s.name;
  const licLink = s.license_url ? `<a href="${esc(s.license_url)}" target="_blank" rel="noopener">${esc(s.license.source)}</a>` : esc(s.license.source);
  const duty = DUTY[s.license.id];
  howto.innerHTML = `
    <p><b>라이선스 근거:</b> ${licLink}${s.license.note ? ` — ${esc(s.license.note)}` : ''}</p>
    ${s.license.commercial === 'yes' && duty ? `<p><b>지킬 것:</b> ${esc(duty)}</p>` : ''}
    ${s.license.commercial === 'no' || s.license.commercial === 'unknown'
      ? '<p><b>설치 전에:</b> 상업적으로 쓰려면 저작권자에게 허락을 받아야 합니다. 개인 학습용으로 볼 때도 라이선스 원문을 확인하세요.</p>'
      : `<p><b>설치:</b> <a href="${esc(s.url)}" target="_blank" rel="noopener">스킬 폴더</a>를 통째로 내려받아 Claude Code는 <code>~/.claude/skills/${esc(folder)}/</code>, 프로젝트용은 <code>.claude/skills/${esc(folder)}/</code>에 넣습니다. Codex는 <code>.agents/skills/</code>, Copilot은 <code>.github/skills/</code>.</p>
         <p><b>넣기 전에:</b> SKILL.md와 스크립트를 한 번 읽어 보세요. 스킬은 AI가 그대로 따라 하는 지시문입니다.</p>`}`;
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
    <h3><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.full_name)}</a></h3>
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
  else if (h === 'check' || h === 'about') showTab(h);
  else showTab('list');
}

(async () => {
  try {
    const r = await fetch('catalog.json', { cache: 'no-cache' });
    catalog = await r.json();
  } catch {
    $('#count').textContent = '추천 목록을 불러오지 못했어요. 새로고침해 주세요.';
  }
  renderStats();
  renderFilters();
  renderList();
  route();
})();
