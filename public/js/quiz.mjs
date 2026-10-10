// 스킬 진단 화면: 질문 → 결과(유형·4축·추천 세트·한 번에 설치 문장·공유).
// 계산은 quiz-engine.mjs. 답은 브라우저 밖으로 보내지 않는다(공유 링크에는 한 문장 입력을 넣지 않음).
import { GOALS, BRANCH, COMMON, TEXT_Q, MAX_QUESTIONS, prepare, nextQuestion, recommend, axes, typeOf, basisOf, AXES, OBJ_LABEL } from './quiz-engine.mjs';
import { detect } from './tags.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TOOLS = [['claude', 'Claude Code'], ['codex', 'Codex'], ['other', '그 밖의 AI']];
const OFFICE = ['word', 'pdf', 'slides', 'sheet'];

export function initQuiz({ skills, root, onOpen, onRoute }) {
  const prep = prepare(skills);
  let a = {}, asked = [], tool = 'claude', result = null;

  const store = {
    get() { try { return JSON.parse(localStorage.getItem('sc:quiz')); } catch { return null; } },
    set(v) { try { localStorage.setItem('sc:quiz', JSON.stringify(v)); } catch { /* 저장 못 해도 동작 */ } },
  };

  // ---------- 시작 화면 ----------
  function intro() {
    const last = store.get();
    root.innerHTML = `<div class="qz-card qz-intro">
      <p class="eyebrow">스킬 진단</p>
      <h2>질문 몇 개로<br>나에게 맞는 스킬 세트를 찾아 드려요</h2>
      <p class="qz-lede">하는 일·일하는 방식·위험 태도를 묻고, 검사한 스킬 <b>${skills.length.toLocaleString()}개</b>를 모두 따져서 <b>서로 겹치지 않는 세트</b>를 골라 드립니다.</p>
      <ul class="qz-facts">
        <li>질문 8~12개 · 약 3분 (고른 답에 따라 다음 질문이 달라져요)</li>
        <li>답은 이 브라우저 안에서만 계산해요. 어디로도 보내지 않습니다.</li>
        <li>돈 버는 일에 쓴다고 하면 상업적으로 무료인 스킬만 골라요.</li>
      </ul>
      <div class="qz-row">
        <button type="button" class="qz-primary" data-act="start">시작하기</button>
        ${last && last.goal ? '<button type="button" class="qz-ghost" data-act="last">지난 결과 보기</button>' : ''}
      </div>
    </div>`;
  }

  // ---------- 질문 ----------
  function estimate() {
    const groups = (a.goal || []).length;
    const branchLeft = Math.max(0, Math.min(4, BRANCH.filter(q => (a.goal || []).includes(q.group)).length) - asked.filter(id => BRANCH.some(q => q.id === id)).length);
    const commonLeft = COMMON.filter(q => !asked.includes(q.id) && !(q.skipIf && q.skipIf(a))).length + (asked.includes('text') ? 0 : 1);
    return Math.min(MAX_QUESTIONS, asked.length + (asked.includes('goal') ? 0 : 1) + (groups ? branchLeft : 2) + commonLeft);
  }

  function show() {
    const q = nextQuestion(prep, a, asked);
    if (!q) return finish();
    const n = asked.length + 1;
    const total = Math.max(n, estimate());
    const pct = Math.round((asked.length / total) * 100);
    let body = '', multi = false;
    let title = q.text, sub = q.sub || '';
    if (q.id === 'goal') {
      title = '주로 어떤 일에 AI를 쓰고 싶나요?'; sub = '여러 개 골라도 돼요.'; multi = true;
      body = opts(GOALS.map(g => ({ v: g.v, label: g.label, hint: g.hint })), a.goal, true);
    } else if (q.id === 'text') {
      body = `<textarea id="qz-text" rows="3" maxlength="200" placeholder="${esc(TEXT_Q.sub.replace(/^예: /, '예: ').replace(/ \(건너뛰어도 돼요\)$/, ''))}">${esc(a.text || '')}</textarea>
        <p class="qz-detect" id="qz-detect" aria-live="polite"></p>`;
      sub = '건너뛰어도 돼요. 적어 주시면 그 문장과 비슷한 스킬에 점수를 더 줍니다.';
    } else if (BRANCH.includes(q)) {
      multi = true; sub = '여러 개 골라도 돼요.';
      body = opts(q.options, a[q.id], true);
    } else {
      body = opts(q.options, a[q.id] != null ? [a[q.id]] : [], false);
    }
    root.innerHTML = `<div class="qz-card qz-q" data-q="${esc(q.id)}">
      <div class="qz-prog" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <p class="qz-step">${n}번째 질문 · 전체 약 ${total}개</p>
      <h2>${esc(title)}</h2>
      ${sub ? `<p class="qz-sub">${esc(sub)}</p>` : ''}
      ${body}
      <div class="qz-row qz-nav">
        ${asked.length ? '<button type="button" class="qz-ghost" data-act="back">← 이전</button>' : '<span></span>'}
        ${q.id === 'text' ? '<span class="qz-row"><button type="button" class="qz-ghost" data-act="skip">건너뛰기</button><button type="button" class="qz-primary" data-act="next">다음</button></span>'
          : multi ? `<button type="button" class="qz-primary" data-act="next" ${(q.id === 'goal' ? a.goal : a[q.id])?.length ? '' : 'disabled'}>다음</button>` : '<span></span>'}
      </div>
    </div>`;
    root.querySelector('.qz-q').dataset.multi = multi ? '1' : '';
    root._q = q;
    if (q.id === 'text') {
      const ta = root.querySelector('#qz-text');
      const upd = () => {
        const d = detect(ta.value);
        const found = [...d.o.map(id => OBJ_LABEL[id])];
        root.querySelector('#qz-detect').textContent = found.length ? `알아들은 것: ${found.join(', ')}` : '';
      };
      ta.addEventListener('input', upd); upd(); ta.focus();
    } else {
      root.querySelector('.qz-opt')?.focus({ preventScroll: true });
    }
  }

  function opts(list, chosen, multi) {
    const set = new Set((chosen || []).map(String));
    return `<div class="qz-opts${list.length > 4 ? ' many' : ''}" role="group">${list.map(o =>
      `<button type="button" class="qz-opt" data-v="${esc(o.v)}" aria-pressed="${set.has(String(o.v))}"${multi ? '' : ' data-single="1"'}>
        <span>${esc(o.label)}</span>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</button>`).join('')}</div>`;
  }

  function choose(btn) {
    const q = root._q;
    const v = q.id === 'size' ? Number(btn.dataset.v) : btn.dataset.v;
    if (btn.dataset.single) {
      a[q.id] = v;
      asked.push(q.id);
      return show();
    }
    const key = q.id;
    const cur = new Set(a[key] || []);
    if (cur.has(v)) cur.delete(v); else cur.add(v);
    a[key] = [...cur];
    btn.setAttribute('aria-pressed', String(cur.has(v)));
    const next = root.querySelector('[data-act="next"]');
    if (next) next.disabled = !cur.size;
  }

  function next(skip) {
    const q = root._q;
    if (q.id === 'text') a.text = skip ? '' : root.querySelector('#qz-text').value.trim();
    // 고른 일이 바뀌면 그 일에 딸린 세부 답은 지운다
    if (q.id === 'goal') for (const b of BRANCH) if (!(a.goal || []).includes(b.group)) delete a[b.id];
    asked.push(q.id);
    show();
  }

  function back() {
    const id = asked.pop();
    if (id == null) return intro();
    show();
  }

  // ---------- 결과 ----------
  function finish() {
    const code = (a.goal || []).includes('dev') ? 'pro' : a.code;
    if (code && !a.code) a.code = code;
    store.set({ ...a, text: a.text || '' });
    renderResult();
    if (onRoute) onRoute(`quiz=${encode(a)}`);
  }

  function renderResult() {
    result = recommend(prep, a);
    const ax = axes(a);
    const ty = typeOf(ax);
    const basis = basisOf(a);
    const miss = result.missing.map(id => OBJ_LABEL[id]).filter(Boolean);
    const officeMiss = result.missing.some(id => OFFICE.includes(id)) && a.money !== 'no';
    const detected = a.text ? detect(a.text).o.map(id => OBJ_LABEL[id]) : [];
    root.innerHTML = `<div class="qz-res">
      <section class="qz-card qz-type" id="qz-type">
        <p class="eyebrow">나의 스킬 유형</p>
        <h2>${esc(ty.adj)} · <span>${esc(ty.noun)}</span></h2>
        <div class="qz-axes">${AXES.map(x => `<div class="qz-ax">
          <span class="l${ax[x.id] <= 50 ? ' on' : ''}">${esc(x.left)}</span>
          <span class="track" role="img" aria-label="${esc(x.left)} ${100 - ax[x.id]} : ${esc(x.right)} ${ax[x.id]}"><i style="left:${ax[x.id]}%"></i></span>
          <span class="r${ax[x.id] > 50 ? ' on' : ''}">${esc(x.right)}</span></div>`).join('')}</div>
        <p class="qz-basis"><b>이렇게 답하셔서</b> ${basis.map(esc).join(' · ')}</p>
        <p class="qz-small">유형 이름은 재미로 붙인 것이에요. 추천은 유형이 아니라 답 하나하나를 점수로 계산해서 골랐습니다.</p>
      </section>

      <section class="qz-card">
        <div class="qz-row qz-head"><h3>추천 스킬 세트 ${result.items.length}개</h3><span class="qz-small">조건에 맞는 후보 ${result.total}개 중</span></div>
        ${detected.length ? `<p class="qz-note">적어 주신 문장에서 <b>${esc(detected.join(', '))}</b>을(를) 알아듣고 반영했어요.</p>` : ''}
        ${miss.length ? `<p class="qz-note warn"><b>${esc(miss.join(', '))}</b>에 맞는 스킬은 ${a.money !== 'no' ? '상업적으로 무료로 쓸 수 있는 것 중에서 ' : ''}찾지 못해 넣지 않았어요.${officeMiss ? ' (Anthropic 공식 docx·pdf·pptx·xlsx 스킬은 공개돼 있지만 상업적으로 쓸 수 없는 라이선스입니다.)' : ''}</p>` : ''}
        ${result.items.length ? `<ol class="qz-list">${result.items.map((it, i) => item(it, i)).join('')}</ol>` : '<p>조건에 맞는 스킬이 없어요. "다시 하기"로 조건을 조금 넓혀 보세요.</p>'}
      </section>

      ${result.items.length ? `<section class="qz-card qz-install">
        <h3>한 번에 설치하기</h3>
        <p class="qz-small">혹시 모를 사고를 예방하기 위해 설치 링크는 드리지 않아요. 쓰시는 AI에 아래 문장을 붙여 넣으면, AI가 라이선스와 위험한 내용을 먼저 확인한 뒤 고른 것만 설치합니다.</p>
        <div class="chips" role="group" aria-label="쓰는 AI">${TOOLS.map(([v, l]) => `<button type="button" class="chip" data-tool="${v}" aria-pressed="${tool === v}">${l}</button>`).join('')}</div>
        <div class="prompt"><pre id="qz-prompt">${esc(promptOf())}</pre><button type="button" class="copy" data-act="copy-prompt">복사</button></div>
      </section>` : ''}

      <div class="qz-row qz-actions">
        <button type="button" class="qz-ghost" data-act="share">결과 링크 복사</button>
        <button type="button" class="qz-ghost" data-act="image">결과 이미지 저장</button>
        <button type="button" class="qz-primary" data-act="restart">다시 하기</button>
      </div>
      <p class="qz-small qz-msg" id="qz-msg" aria-live="polite"></p>
    </div>`;
  }

  function item(it, i) {
    const s = it.skill;
    const low = it.pct < 60;
    return `<li class="qz-item">
      <span class="g g-${s.grade.letter}" title="${esc(s.grade.label)}">${s.grade.letter}</span>
      <div class="qz-body">
        <div class="qz-name"><b>${esc(s.name)}</b><span class="qz-repo">github.com/${esc(s.repo)}</span></div>
        <p class="qz-desc">${esc(s.ko || s.description)}</p>
        <div class="qz-fit"><span class="meter"><i style="width:${it.pct}%"></i></span><span>맞는 정도 ${it.pct}%${low ? ' · 조금 덜 맞음' : ''}</span></div>
        <p class="qz-why">${it.why.map(esc).join(' · ')}</p>
        <div class="qz-row qz-item-act">
          <button type="button" class="qz-link" data-open="${esc(s.id)}">목록에서 자세히</button>
          <button type="button" class="qz-link" data-drop="${esc(s.id)}">이건 빼기</button>
        </div>
      </div>
    </li>`;
  }

  function locationOf(s) {
    const m = String(s.url || '').match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/tree\/([^/]+)\/?(.*)$/);
    return m ? { repo: m[1], path: m[3] || '(저장소 맨 위)' } : { repo: s.repo, path: s.path };
  }

  function promptOf() {
    if (!result || !result.items.length) return '';
    const where = { claude: 'Claude Code의 내 스킬 폴더(~/.claude/skills)', codex: 'Codex의 내 스킬 폴더(~/.codex/skills)', other: '네가 쓰는 스킬 폴더' }[tool];
    const lines = result.items.map((it, i) => { const l = locationOf(it.skill); return `${i + 1}) ${it.skill.name} — GitHub 저장소 ${l.repo}의 "${l.path}" 폴더 (라이선스 ${it.skill.license.id})`; });
    return `아래 스킬 ${lines.length}개를 ${where}에 설치해 줘.\n${lines.join('\n')}\n\n` +
      `설치하기 전에 스킬마다 먼저 확인해서 알려 줘:\n` +
      `1) 그 폴더(또는 저장소)의 LICENSE가 위에 적은 것과 같은지, 상업적으로 써도 되는지\n` +
      `2) SKILL.md와 스크립트에 위험한 내용(비밀키·인증 파일 읽기, 외부로 데이터 전송, 인터넷에서 받은 스크립트 바로 실행, 사용자 몰래 하라는 지시)이 없는지\n` +
      `3) 설명이 서로 겹쳐서 헷갈릴 만한 스킬이 있는지\n` +
      `내가 좋다고 한 것만 설치해 줘. 주소가 위에 적은 github.com 저장소가 아니면 설치하지 마.`;
  }

  async function copy(text, btn, done) {
    try { await navigator.clipboard.writeText(text); btn.textContent = done; }
    catch { btn.textContent = '복사가 막혔어요 — 직접 선택해 주세요'; }
    setTimeout(() => { btn.textContent = btn.dataset.label || '복사'; }, 2000);
  }

  // 결과 이미지(1080×1350): 유형·4축·추천 이름
  async function saveImage() {
    const ax = axes(a), ty = typeOf(ax);
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    const x = c.getContext('2d');
    try { await document.fonts.ready; } catch { /* 글꼴 없이도 그린다 */ }
    const F = (w, s) => `${w} ${s}px "IBM Plex Sans KR", "Malgun Gothic", sans-serif`;
    x.fillStyle = v('--bg') || '#f6efe7'; x.fillRect(0, 0, 1080, 1350);
    x.fillStyle = v('--rose') || '#c95a6b'; x.font = F(500, 30); x.fillText('SKILL CHECK · 나의 스킬 유형', 80, 130);
    x.fillStyle = v('--ink') || '#2a201c'; x.font = F(600, 64); x.fillText(ty.adj, 80, 230); x.fillText(ty.noun, 80, 315);
    AXES.forEach((d, i) => {
      const y = 430 + i * 92;
      x.font = F(400, 28); x.fillStyle = v('--mute') || '#7d6d63';
      x.textAlign = 'left'; x.fillText(d.left, 80, y); x.textAlign = 'right'; x.fillText(d.right, 1000, y); x.textAlign = 'left';
      x.fillStyle = v('--line') || '#e2d6ca'; x.fillRect(80, y + 22, 920, 10);
      x.fillStyle = v('--rose') || '#c95a6b'; x.beginPath(); x.arc(80 + 920 * ax[d.id] / 100, y + 27, 17, 0, Math.PI * 2); x.fill();
    });
    x.fillStyle = v('--ink') || '#2a201c'; x.font = F(600, 34); x.fillText(`추천 스킬 세트 ${result.items.length}개`, 80, 860);
    x.font = F(400, 30);
    result.items.slice(0, 8).forEach((it, i) => {
      const t = `${it.skill.grade.letter}  ${it.skill.name}`;
      x.fillText(t.length > 46 ? t.slice(0, 45) + '…' : t, 80, 915 + i * 46);
    });
    x.fillStyle = v('--mute') || '#7d6d63'; x.font = F(400, 26); x.fillText('onedayailab.com/skills · 3분 스킬 진단', 80, 1300);
    const link = document.createElement('a');
    link.download = 'my-skill-type.png';
    link.href = c.toDataURL('image/png');
    link.click();
  }

  // ---------- 이벤트 ----------
  root.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    const act = t.dataset.act;
    if (t.classList.contains('qz-opt')) return choose(t);
    if (act === 'start') { a = {}; asked = []; return show(); }
    if (act === 'last') { a = store.get() || {}; asked = []; renderResult(); if (onRoute) onRoute(`quiz=${encode(a)}`); return; }
    if (act === 'next') return next(false);
    if (act === 'skip') return next(true);
    if (act === 'back') return back();
    if (act === 'restart') { a = {}; asked = []; if (onRoute) onRoute('quiz'); return show(); }
    if (act === 'copy-prompt') { t.dataset.label = '복사'; return copy(root.querySelector('#qz-prompt').textContent, t, '복사됨'); }
    if (act === 'share') { t.dataset.label = '결과 링크 복사'; return copy(`${location.origin}${location.pathname}#quiz=${encode(a)}`, t, '링크 복사됨 (적은 문장은 빠짐)'); }
    if (act === 'image') return saveImage().catch(() => { root.querySelector('#qz-msg').textContent = '이미지를 만들지 못했어요. 화면을 캡처해 주세요.'; });
    if (t.dataset.tool) { tool = t.dataset.tool; root.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); root.querySelector('#qz-prompt').textContent = promptOf(); return; }
    if (t.dataset.drop) { a.exclude = [...(a.exclude || []), t.dataset.drop]; renderResult(); return; }
    if (t.dataset.open && onOpen) onOpen(t.dataset.open);
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'qz-text' && !e.shiftKey) { e.preventDefault(); next(false); }
  });

  return {
    start() { if (!root.innerHTML) intro(); },
    fromHash(h) {
      const v = decode(h);
      if (v && v.goal) { a = v; asked = []; renderResult(); } else intro();
    },
  };
}

// 공유 링크: 고른 답만(한 문장·뺀 스킬 제외) 짧게 담는다
const KEYS = ['goal', ...BRANCH.map(q => q.id), ...COMMON.map(q => q.id)];
function encode(a) {
  const o = {};
  for (const k of KEYS) if (a[k] != null && !(Array.isArray(a[k]) && !a[k].length)) o[k] = a[k];
  return btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(h) {
  try {
    const o = JSON.parse(atob(String(h).replace(/-/g, '+').replace(/_/g, '/')));
    const out = {};
    for (const k of KEYS) if (o[k] != null) out[k] = o[k];
    return out;
  } catch { return null; }
}
