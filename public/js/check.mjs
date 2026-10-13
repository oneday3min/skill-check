// GitHub 저장소(또는 하위 폴더)의 스킬을 찾아 라이선스·출처·위험 신호를 보고 등급을 매긴다.
// 브라우저와 Node(18+) 둘 다에서 돈다. GitHub API는 저장소당 2번(메타 + 파일 트리),
// 파일 내용은 raw.githubusercontent.com에서 읽는다(API 한도에 안 걸림).
import { classify, fromSpdx, NONE } from './license.mjs';
import { original } from './known.mjs';

const IS_NODE = typeof window === 'undefined';
const MAX_SKILLS = 40;
const MAX_FILES_PER_SKILL = 12;
const MAX_FILE_BYTES = 150000;
const CONCURRENCY = 6;

async function gh(path, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (IS_NODE) headers['User-Agent'] = 'skill-check';
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`https://api.github.com${path}`, { headers });
  if (r.status === 403 || r.status === 429) {
    const reset = Number(r.headers.get('x-ratelimit-reset')) * 1000;
    const mins = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
    throw new Error(`GitHub 무료 호출 한도(시간당 60회)를 다 썼어요. 약 ${mins}분 뒤 다시 해 주세요.`);
  }
  if (r.status === 404) throw new Error('저장소를 찾을 수 없어요(비공개이거나 주소가 틀림).');
  if (r.status === 409) throw new Error('빈 저장소예요.');
  if (!r.ok) throw new Error(`GitHub 응답 오류 ${r.status}`);
  return r.json();
}

async function raw(owner, repo, ref, path) {
  const u = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  try {
    const r = await fetch(u, IS_NODE ? { headers: { 'User-Agent': 'skill-check' } } : undefined);
    if (!r.ok) return '';
    return (await r.text()).slice(0, MAX_FILE_BYTES);
  } catch { return ''; }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

export function parseUrl(input) {
  const s = String(input).trim();
  const short = s.match(/^([\w.-]+)\/([\w.-]+)$/); // owner/repo 형태도 받는다
  if (short) return { owner: short[1], repo: short[2], ref: '', sub: '' };
  const m = s.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*?))?)?\/?(?:[?#].*)?$/i);
  if (!m) throw new Error('GitHub 주소를 넣어 주세요 (예: https://github.com/owner/repo)');
  const sub = (m[4] || '').replace(/\/?SKILL\.md$/i, '').replace(/\/$/, '');
  return { owner: m[1], repo: m[2], ref: m[3] || '', sub: decodeURIComponent(sub) };
}

export function frontmatter(md) {
  const m = md.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^[>|][-+]?$/.test(v)) { // 여러 줄 값 (description: >)
      const buf = [];
      while (i + 1 < lines.length && /^\s+\S|^\s*$/.test(lines[i + 1])) buf.push(lines[++i].trim());
      v = buf.join(' ').trim();
    }
    out[kv[1].toLowerCase()] = v.replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

const dirOf = p => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const isLicense = p => /(^|\/)(LICEN[CS]E|COPYING)(\.[\w]+)?$/i.test(p);

// 위험 신호: [정규식, 심각도, 설명, 종류]
const RISKS = [
  [/curl[^\n|]*\|\s*(ba)?sh|wget[^\n|]*\|\s*(ba)?sh|iex\s*\(\s*(iwr|irm|New-Object)/i, 'medium', '인터넷에서 받은 스크립트를 바로 실행', 'pipe'],
  [/~\/\.ssh|id_rsa|id_ed25519|\.aws\/credentials|\.npmrc|keychain/i, 'medium', '비밀키·인증 파일 경로 언급', 'secret'],
  [/ignore (all )?(previous|prior) instructions|do not (tell|inform) the user|without (telling|asking) the user/i, 'high', '사용자 몰래 행동하라는 문구(프롬프트 주입)', 'inject'],
  [/base64\s+(-d|--decode)|atob\(|frombase64string/i, 'medium', '숨긴(인코딩된) 내용 해독'],
  // re.exec(…)·/…/g.exec(…) 같은 정규식 메서드는 제외
  [/(?<!(?:\b(?:re|rx|regex|regexp|pattern)\w*|\/[dgimsuyv]*)\.)\b(eval|exec)\s*\(/i, 'medium', '동적 코드 실행', 'code'],
  [/process\.env|os\.environ|\$env:|getenv\(/i, 'low', '환경변수 읽기(키 노출 가능성)'],
  [/requests\.(post|put)|fetch\(\s*['"`]https?:|axios\.post|urllib\.request|Invoke-WebRequest|curl\s+-X\s*POST/i, 'low', '외부로 데이터 전송 가능', 'net'],
  [/rm\s+-rf\s+[~/]|Remove-Item[^\n]*-Recurse[^\n]*(\$HOME|C:\\)/i, 'medium', '넓은 범위 삭제 명령'],
  // 조회만 하면 될 일에 쓰기·거래·출금·관리자 권한 키를 달라는 것 (DG일기장 310 매매일지 봇: 조회 전용 키만 받고 권한 키는 거부)
  // 키·토큰 이야기일 때만 센다(취약점 설명 속 "public write access"나 "write access가 있는 사람" 같은 문장은 제외)
  [/\b(api[ -]?keys?|tokens?|access keys?|keys?)\b[^\n.]{0,60}\b(withdraw(al)?|trading|trade|transfer)\b[^\n.]{0,20}\b(permissions?|access|rights|enabled)\b|\b(enable|grant|turn on)\b[^\n.]{0,30}\b(withdraw(al)?|trading|transfer)\b[^\n.]{0,20}\b(permissions?|access)\b[^\n.]{0,60}\b(api[ -]?keys?|tokens?|keys?)\b|\b(enable|grant|turn on)\b[^\n.]{0,30}\b(withdraw(al)?|trading|transfer)\b[^\n.]{0,20}\bpermissions?\b|\b(read[- ]write|withdraw(al)?|trading|full[- ]access)\s+(api\s+)?(key|token)s?\b|\btokens?\b[^\n]{0,60}\bscopes?\b[^\n]{0,30}\b(repo|admin:org|delete_repo|write:packages)\b|\bscopes?\b[^\n]{0,30}\b(admin:org|delete_repo|write:packages)\b|(키|토큰)[^\n.]{0,30}(출금|거래)\s*권한|(출금|거래)\s*권한[^\n.]{0,20}(켜|허용|필요)/i, 'medium', '쓰기·거래·출금 권한 키를 요구', 'perm'],
];
const READ_ONLY = /read[- ]only|view[- ]only|조회\s*전용|읽기\s*전용|only (read|view)|never (enable|grant)|reject(s|ed)?|refuse|\bno\b[^\n.]{0,15}(admin|write)|without[^\n.]{0,15}(admin|write)/i;
const NET_RE = RISKS.find(r => r[3] === 'net')[0];

// 정적 판정 불가: 코드를 읽어서는 무엇을 하는지 알 수 없는 것. 위험하다는 뜻이 아니라 "확인할 수 없다"는 뜻이다.
// [정규식, 설명] — 설치·실행할 때 인터넷에서 코드를 받아 오는 명령
const REMOTE_FETCH = [
  [/curl[^\n|]*\|\s*(ba)?sh|wget[^\n|]*\|\s*(ba)?sh|iex\s*\(\s*(iwr|irm|New-Object)/i, '받은 스크립트를 바로 실행'],
  [/\b(npx|bunx|pnpm\s+dlx|uvx|pipx\s+run)\s+(-y\s+|--yes\s+)?[@\w][\w@/.-]*/i, '실행할 때마다 패키지를 내려받아 실행'],
  [/\bpip3?\s+install\s+[^\n]*(git\+|https?:\/\/)/i, '저장소·주소에서 바로 설치'],
  [/\bnpm\s+(i|install)\s+[^\n]*(github:|git\+|https?:\/\/)/i, '저장소·주소에서 바로 설치'],
  [/\bgo\s+install\s+\S+@latest/i, '최신판을 받아 설치(버전 고정 없음)'],
  [/\bdeno\s+run\s+[^\n]*https?:\/\//i, '주소의 코드를 바로 실행'],
];
const LOCAL_DEV_TOOL = /^(npx|bunx|pnpm\s+dlx)\s+(-y\s+|--yes\s+)?(tsc|eslint|prettier|jest|vitest|playwright|hardhat|tsx|ts-node|vite|next|prisma|webpack|rollup|esbuild|turbo|nx|lerna|husky|lint-staged|mocha|cypress|storybook|tailwindcss|postcss|nodemon|rimraf|install|expo|react-native|wrangler|astro|svelte-kit|nuxi|biome)(\s|$)/i;
// 난독화·압축된 코드
function obfuscated(path, text) {
  if (/\.min\.(js|mjs|cjs)$/i.test(path)) return '압축(min)된 코드';
  if (/\.(md|txt)$/i.test(path)) return '';
  if ((text.match(/\b_0x[0-9a-f]{4,6}\b/gi) || []).length >= 5) return '난독화된 이름(_0x…)';
  if ((text.match(/\\x[0-9a-f]{2}/gi) || []).length >= 80) return '16진 문자열로 숨긴 코드';
  if (/exec\s*\(\s*(marshal\.loads|zlib\.decompress|base64\.b64decode)/.test(text)) return '압축·인코딩된 파이썬 코드 실행';
  const longLine = text.split('\n').find(l => l.length > 1000 && (l.match(/\s/g) || []).length / l.length < 0.05);
  if (longLine) return '한 줄로 뭉친 코드(압축·난독화 추정)';
  return '';
}
const DEFENSIVE = /e\.g\.|such as|like\s*["“]|contains|says|looks like|treat (it|them) as|never (follow|interpret|obey)|do not (follow|obey)|untrusted|injection|watch (out )?for|detect|block|attack|malicious|jailbreak|pattern|example/i;
const NEGATED = /\b(do not|don't|never|must not|mustn't|should not|shouldn't|not)\b[^.\n]{0,160}$/i;
// 받은 스크립트 실행 중 출처가 수상한 것(평문 http, 붙여넣기·단축 주소, IP)만 높음
const SHADY_PIPE = /(curl|wget)[^\n|]*(http:\/\/|pastebin|paste\.|gist\.githubusercontent|bit\.ly|tinyurl|transfer\.sh|ngrok|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})[^\n|]*\|\s*(ba)?sh/i;

const BRANDS = /\b(anthropic|claude official|openai|google|microsoft|github official|notion|figma|stripe)\b/i;
const BRAND_OWNERS = /^(anthropics?|openai|google|microsoft|github|makenotion|figma|stripe|googleapis|google-gemini)$/i;
const BORROWED = /\b[Aa]dapted from\s+\S|\b(?:[Cc]opied|[Pp]orted|[Ff]orked|[Dd]erived) from\s+(?:https?:\/\/|github|the original|[A-Z][\w-]+)[^\n]{0,70}|[Bb]ased on (?:the )?(?:original|work of|code (?:from|by))[^\n.]{0,60}|[Oo]riginally (?:written|created|made|authored) by\s+[^\n.]{3,60}|[Cc]redits? (?:go )?to\s+[A-Z@][^\n.]{2,60}/;

// 용도 분류(이름+설명 키워드). 위에서부터 먼저 맞는 것.
const CATEGORIES = [
  ['문서·오피스', /\b(docx|pdf|pptx|xlsx|word|excel|powerpoint|spreadsheet|slides?|presentation|document)\b/i],
  ['연구·과학', /\b(scien|bio|genom|protein|molecul|chemi|physics|astro|clinical|single-cell|rna|paper|academic)/i],
  ['AI·에이전트', /\b(agents?|subagent|llm|prompt|skills?|fine-tun|model training|rlhf|mcp server)\b/i],
  ['디자인·이미지', /\b(design|ui|ux|css|figma|canvas|art|image|icon|theme|brand|visual|color|font|gif|svg|illustrat)/i],
  ['테스트·디버깅', /\b(test|tdd|debug|bug|qa|playwright|e2e|lint)/i],
  ['보안', /\b(security|secure|vulnerab|audit|threat|pentest|secret)/i],
  ['데이터·분석', /\b(data|analy|sql|database|csv|chart|dashboard|metric|statistic)/i],
  ['글쓰기·마케팅', /\b(writ|blog|copy|content|seo|marketing|social|tweet|newsletter|email|comms|story)/i],
  ['연동·API', /\b(api|mcp|integrat|automation|webhook|slack|notion|github|jira|stripe)\b/i],
  ['개발·코딩', /\b(code|coding|develop|refactor|review|git|commit|frontend|backend|react|python|typescript|deploy|build|architect|engineer)/i],
  ['업무·생산성', /\b(plan|task|meeting|note|research|brainstorm|productiv|workflow|project|summar)/i],
];
export function categoryOf(name, description) {
  const t = `${name} ${description}`;
  for (const [c, re] of CATEGORIES) if (re.test(t)) return c;
  return '기타';
}

export async function checkRepo(input, opts = {}) {
  const token = opts.token || (IS_NODE ? (globalThis.process && process.env.GITHUB_TOKEN) || '' : '');
  const progress = opts.onProgress || (() => {});
  const { owner, repo, ref: wantRef, sub } = parseUrl(input);
  progress('저장소 정보 읽는 중');
  const meta = await gh(`/repos/${owner}/${repo}`, token);
  const ref = wantRef || meta.default_branch;
  const tree = await gh(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token);
  // 심볼릭 링크(mode 120000)는 내용이 경로 한 줄뿐이라 뺀다
  const files = (tree.tree || []).filter(x => x.type === 'blob' && x.mode !== '120000').map(x => ({ path: x.path, size: x.size }));
  const inSub = p => !sub || p === sub || p.startsWith(sub + '/');

  // 같은 스킬이 에이전트별 숨김 폴더(.gemini/ .codex/ …)나 번역본(i18n/)에 복사돼 있으면 원본 하나만 본다
  const hidden = p => /(^|\/)\.[^/]+\//.test(p);
  const seenNames = new Set();
  const skillFiles = files
    .filter(f => /(^|\/)SKILL\.md$/i.test(f.path) && inSub(f.path) && !/(^|\/)(templates?|i18n|locales?|tests?|fixtures|examples?)\//i.test(f.path))
    .sort((a, b) => hidden(a.path) - hidden(b.path) || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))
    .filter(f => {
      const n = (dirOf(f.path).split('/').pop() || '').toLowerCase();
      if (seenNames.has(n)) return false;
      seenNames.add(n);
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const repoLicenseByApi = fromSpdx(meta.license && meta.license.spdx_id);
  const licenseFiles = files.filter(f => isLicense(f.path));
  const licenseCache = {};
  async function licenseAt(dir) {
    // 스킬 폴더 → 상위 폴더 → 저장소 루트 순으로 가장 가까운 LICENSE 파일
    let d = dir;
    while (true) {
      const lf = licenseFiles.find(f => dirOf(f.path) === d);
      if (lf) {
        if (!(lf.path in licenseCache)) {
          licenseCache[lf.path] = raw(owner, repo, ref, lf.path).then(text => ({ path: lf.path, text, verdict: classify(text) }));
        }
        return licenseCache[lf.path];
      }
      if (d === '') return null;
      d = dirOf(d);
    }
  }

  let readmePromise = null;
  function readmeNote() {
    if (!readmePromise) {
      const rf = files.find(f => /^readme(\.md)?$/i.test(f.path));
      readmePromise = (rf ? raw(owner, repo, ref, rf.path) : Promise.resolve('')).then(text => {
        const line = text.split(/\r?\n/).find(l => /licen[cs]e|apache|\bMIT\b|open source/i.test(l)) || '';
        return line.replace(/[#*`>\[\]]/g, '').replace(/\(\.?\/[^)]*\)/g, '').trim();
      });
    }
    return readmePromise;
  }

  const repoFlags = [];
  const ageDays = Math.round((Date.now() - Date.parse(meta.created_at)) / 864e5);
  const idleDays = Math.round((Date.now() - Date.parse(meta.pushed_at)) / 864e5);
  if (!repoLicenseByApi && licenseFiles.some(f => dirOf(f.path) !== '')) {
    repoFlags.push({ level: 'warn', text: '저장소 전체 라이선스가 없고 스킬 폴더마다 따로 있음 — 저장소 이름만 보고 판단하면 안 됨' });
  }
  if (!repoLicenseByApi && !licenseFiles.length) repoFlags.push({ level: 'warn', text: '저장소에 라이선스 파일이 하나도 없음' });
  if (meta.fork) repoFlags.push({ level: 'warn', text: `포크 저장소(원본: ${meta.parent ? meta.parent.full_name : '미확인'}) — 원본의 라이선스·저작권 고지가 유지됐는지 확인` });
  if (meta.archived) repoFlags.push({ level: 'warn', text: '보관(archived)됨 — 더 이상 관리 안 함' });
  if (idleDays > 365) repoFlags.push({ level: 'info', text: `${idleDays}일째 업데이트 없음` });
  if (ageDays < 30) repoFlags.push({ level: 'warn', text: `생긴 지 ${ageDays}일 된 저장소 — 이력이 짧음` });
  if (meta.owner && meta.owner.type === 'Organization') repoFlags.push({ level: 'good', text: `조직 계정(${meta.owner.login})이 관리` });

  // opts.include: 큰 저장소에서 꼭 볼 하위 폴더(앞 40개 안에 없어도 먼저 검사)
  const inc = (opts.include || []).map(s => s.replace(/\/$/, ''));
  const must = skillFiles.filter(f => inc.some(s => f.path.startsWith(s + '/')));
  const list = [...must, ...skillFiles.filter(f => !must.includes(f))].slice(0, Math.max(MAX_SKILLS, must.length));
  let done = 0;
  progress(`스킬 ${list.length}개 검사 중`);
  const skills = await pool(list, CONCURRENCY, async sf => {
    const r = await checkSkill(sf);
    progress(`스킬 검사 ${++done}/${list.length}`);
    return r;
  });

  async function checkSkill(sf) {
    const dir = dirOf(sf.path);
    const md = await raw(owner, repo, ref, sf.path);
    const fm = frontmatter(md);
    const flags = [];
    const risks = [];

    // 1) 라이선스: 폴더의 LICENSE 파일 > SKILL.md의 license 필드 > 저장소 라이선스 > README 문구
    const lic = await licenseAt(dir);
    const fmVerdict = fm.license ? classify(fm.license) : null;
    let license, source;
    const ownLic = lic && dirOf(lic.path) === dir; // 스킬 폴더 바로 안의 LICENSE
    if (ownLic && lic.verdict) { license = lic.verdict; source = lic.path; }
    else if (fmVerdict && !/licen[cs]e\.(txt|md)|see licen|^licen[cs]e$/i.test(fm.license)) {
      license = fmVerdict; source = `SKILL.md license 필드("${fm.license.slice(0, 60)}")`;
      if (lic && lic.verdict && lic.verdict.id !== fmVerdict.id) {
        flags.push({ level: 'warn', text: `SKILL.md는 "${fm.license.slice(0, 40)}", 저장소 ${lic.path}는 ${lic.verdict.id} — 서로 다름(어느 쪽이 스킬에 적용되는지 확인)` });
      }
    }
    else if (lic && lic.verdict) { license = lic.verdict; source = lic.path; }
    else if (fmVerdict) { license = fmVerdict; source = 'SKILL.md license 필드'; }
    else if (repoLicenseByApi) { license = repoLicenseByApi; source = '저장소 라이선스(GitHub 표시)'; }
    else {
      const note = await readmeNote();
      const nv = note ? classify(note) : null;
      if (nv && nv.commercial === 'yes') {
        license = { id: `README: ${nv.id}`, commercial: 'readme', note: `라이선스 파일은 없고 README에만 ${nv.id}라고 적혀 있음: "${note.slice(0, 160)}" — 조건 원문·저작권자 표기가 없음` };
        source = 'README 문구';
      } else if (note) {
        license = { id: 'README only', commercial: 'unknown', note: `라이선스 파일 없이 README 문구만 있음: "${note.slice(0, 160)}"` };
        source = 'README 문구';
      } else { license = NONE; source = '없음'; }
    }
    if (ownLic && fmVerdict && fmVerdict.id !== 'Custom' && lic.verdict && fmVerdict.id !== lic.verdict.id &&
        !/licen[cs]e\.txt|see licen/i.test(fm.license)) {
      flags.push({ level: 'warn', text: `SKILL.md에는 ${fmVerdict.id}, LICENSE 파일은 ${lic.verdict.id} — 표기가 서로 다름` });
    }
    if (repoLicenseByApi && license.id !== repoLicenseByApi.id && !flags.some(f => /서로 다름/.test(f.text))) {
      flags.push({ level: 'warn', text: `저장소 전체는 ${repoLicenseByApi.id}인데 이 스킬은 ${license.id} — 스킬마다 따로 확인해야 함` });
    }
    if (lic && lic.text && license.commercial !== 'no' && !/copyright|©|\(c\)/i.test(lic.text)) {
      flags.push({ level: 'info', text: '라이선스에 저작권자 이름이 없음 — 출처 표시 대상 불분명' });
    }

    // 2) 출처
    const name = fm.name || dir.split('/').pop() || repo;
    const brandHit = (`${fm.name || ''} ${fm.description || ''}`).match(BRANDS);
    if (brandHit && !BRAND_OWNERS.test(owner)) {
      flags.push({ level: 'warn', text: `'${brandHit[1]}' 이름을 쓰지만 그 회사 계정이 아님 — 공식 스킬인 척하는지 확인` });
    }
    const orig = original(fm.name || dir.split('/').pop(), fm.description, owner, lic && lic.text);
    if (orig) {
      if (orig.license === 'Proprietary') {
        flags.push({ level: 'warn', text: `${orig.from}의 사본으로 보임 — 원본은 비공개 라이선스라 재배포·상업 사용 불가` });
        license = { id: 'Proprietary (원본)', commercial: 'no', note: '원본 라이선스를 따름' };
        source = `원본 ${orig.from}`;
      } else if (orig.license === 'None') {
        flags.push({ level: 'warn', text: `${orig.from}의 사본으로 보임 — 원본에도 라이선스 파일이 없음` });
      } else if (!lic) {
        flags.push({ level: 'warn', text: `${orig.from}의 사본으로 보이는데 원본 ${orig.license} 라이선스 파일을 안 가져옴 — 고지 누락` });
      } else {
        flags.push({ level: 'info', text: `${orig.from}의 사본(원본 ${orig.license})` });
      }
    }
    // 스킬이 "무엇을 하는지" 적는 description만 본다(본문의 점검 항목 설명 등은 제외)
    if (/reverse[- ]engineered|unofficial (web )?api|비공식 API/i.test(fm.description || '')) {
      flags.push({ level: 'warn', text: '비공식(역설계) API를 씀 — 그 서비스 약관 위반·계정 정지 위험' });
    } else if (/\b(scrap(e|er|es|ing)|internal (graphql )?api)\b/i.test(fm.description || '') &&
               /\b(amazon|airbnb|ebay|etsy|taobao|tmall|walmart|linkedin|instagram|tiktok|facebook|x\.com|twitter|1688|goofish)\b/i.test(fm.description || '')) {
      flags.push({ level: 'warn', text: '대형 사이트 데이터를 긁어옴 — 그 사이트 약관상 자동 수집이 금지일 수 있음' });
    }
    const borrowed = md.match(BORROWED);
    if (borrowed) flags.push({ level: 'info', text: `남의 것을 가져왔다고 적혀 있음: "${borrowed[0].slice(0, 90)}" — 원본 라이선스 확인` });
    if (!fm.name || !fm.description) flags.push({ level: 'info', text: 'SKILL.md 앞머리(name/description)가 규격과 다름' });

    // 3) 포함 파일
    const mine = dir ? files.filter(f => f.path.startsWith(dir + '/')) : files.filter(f => !f.path.includes('/'));
    const scripts = mine.filter(f => /\.(py|js|mjs|cjs|ts|sh|ps1|bat|cmd|rb|go)$/i.test(f.path));
    const fonts = mine.filter(f => /\.(ttf|otf|woff2?)$/i.test(f.path));
    const media = mine.filter(f => /\.(png|jpe?g|gif|svg|mp3|wav|mp4)$/i.test(f.path));
    const bins = mine.filter(f => /\.(exe|dll|so|dylib|bin|jar|whl|zip|tgz|node|wasm|pyc|pyd|msi|apk|7z|rar|gz|xz)$/i.test(f.path));
    const opaque = [];
    if (fonts.length) flags.push({ level: 'warn', text: `글꼴 ${fonts.length}개 포함 — 글꼴은 따로 라이선스(OFL 등)가 있음` });
    if (media.length > 3) flags.push({ level: 'info', text: `이미지·미디어 ${media.length}개 포함 — 출처 확인 권장` });
    if (bins.length) {
      const names = bins.slice(0, 3).map(b => b.path.split('/').pop()).join(', ');
      risks.push({ level: 'high', text: `실행 파일·압축 파일 ${bins.length}개 포함 (${names})` });
      opaque.push(`실행 파일·압축 파일 ${bins.length}개 (${names})`);
    }
    const bigScripts = scripts.filter(f => f.size > MAX_FILE_BYTES);
    if (bigScripts.length) opaque.push(`너무 커서 못 읽은 코드 ${bigScripts.length}개 (${bigScripts.slice(0, 3).map(b => b.path.split('/').pop()).join(', ')})`);

    // 4) 위험 신호 (SKILL.md + 스크립트·문서 일부)
    const extra = [...scripts, ...mine.filter(f => /\.(md|txt)$/i.test(f.path) && f.path !== sf.path)]
      .filter(f => f.size <= MAX_FILE_BYTES).slice(0, MAX_FILES_PER_SKILL);
    const texts = await Promise.all(extra.map(f => raw(owner, repo, ref, f.path)));
    const toScan = [{ path: sf.path, text: md }, ...extra.map((f, i) => ({ path: f.path, text: texts[i] }))];
    const scanned = scanFiles(toScan, sf.path);
    flags.push(...scanned.flags);
    risks.push(...scanned.risks);
    opaque.push(...scanned.opaque);
    if (/allowed-tools:\s*.*\bBash\b(?!\()/i.test(md)) risks.push({ level: 'medium', text: 'allowed-tools에 Bash를 제한 없이 미리 허용' });

    const description = (fm.description || '').slice(0, 400);
    return {
      name, path: dir || '(root)', description, category: categoryOf(name, description),
      license: { ...license, source }, flags, risks, opaque,
      counts: { scripts: scripts.length, files: mine.length },
      grade: grade(license, flags, risks, opaque),
      url: `https://github.com/${owner}/${repo}/tree/${ref}/${dir}`,
      license_url: source && !/없음|README|SKILL\.md|저장소|원본/.test(source) ? `https://github.com/${owner}/${repo}/blob/${ref}/${source}` : null,
    };
  }

  return {
    repo: { full_name: meta.full_name, url: meta.html_url, stars: meta.stargazers_count, owner_type: meta.owner && meta.owner.type,
      license: repoLicenseByApi ? repoLicenseByApi.id : null, created: meta.created_at, pushed: meta.pushed_at, fork: meta.fork, ref, sub },
    repoFlags, skills, truncated: skillFiles.length > MAX_SKILLS, total_skills: skillFiles.length,
    checked_at: new Date().toISOString(),
  };
}

function isCommentAt(text, index) {
  const start = text.lastIndexOf('\n', index) + 1;
  const before = text.slice(start, index);
  return /^\s*(\/\/|#|\*|\/\*)/.test(before) || /\s\/\/\s/.test(before);
}

// 그 위치가 정규식 리터럴(/a|b|c/i) 안이면 "찾는 규칙"이지 실제 동작이 아니다
function inPatternRule(text, index) {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  const line = text.slice(start, end < 0 ? undefined : end);
  const at = index - start;
  const re = /\/(?![/*])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[dgimsuyv]*/g;
  for (let m; (m = re.exec(line));) {
    if (at >= m.index && at < m.index + m[0].length && m[0].includes('|')) return true;
  }
  return false;
}

// 파일 묶음에서 위험 신호 찾기. 같은 종류는 한 번만 센다.
export function scanFiles(toScan, skillMdPath) {
  const flags = [];
  const risks = [];
  const opaque = [];
  const seen = new Set();
  for (const { path, text } of toScan) {
    const isCode = !/\.(md|txt)$/i.test(path);
    const short = path.split('/').slice(-2).join('/');
    const ob = obfuscated(path, text);
    if (ob && !seen.has(`ob:${ob}`)) { seen.add(`ob:${ob}`); opaque.push(`${ob} — ${short}`); }
    for (const [re, desc] of REMOTE_FETCH) {
      if (seen.has(`rf:${desc}`)) continue;
      // npx tsc·npx playwright처럼 프로젝트에 이미 깔린 개발 도구 실행은 원격 코드로 보지 않는다
      const m = [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))]
        .find(x => !LOCAL_DEV_TOOL.test(x[0]));
      if (!m) continue;
      if (isCode && (inPatternRule(text, m.index) || isCommentAt(text, m.index))) continue;
      if (NEGATED.test(text.slice(Math.max(0, m.index - 120), m.index))) continue; // "npx로 실행하지 마라" 같은 금지 문장
      seen.add(`rf:${desc}`);
      opaque.push(`설치·실행 때 원격 코드: ${desc} — ${short}: "${m[0].slice(0, 60)}"`);
    }
    const netHere = NET_RE.test(text);
    for (const [re, level0, desc, kind] of RISKS) {
      if (seen.has(desc)) continue;
      if (kind === 'code' && !isCode) continue; // 문서 속 "eval(" 언급은 제외
      if (kind === 'perm' && isCode) continue; // 키 권한 요구는 사용자에게 하는 안내(문서)에서만 본다
      const m = text.match(re);
      if (!m) continue;
      if (kind !== 'net' && isCode && inPatternRule(text, m.index)) continue; // 검사기 코드의 규칙 정의(정규식) 속 문자열
      if (kind === 'code' && isCommentAt(text, m.index)) continue; // 주석 속 언급은 실행이 아님
      if (kind === 'perm') {
        const around = text.slice(Math.max(0, m.index - 160), m.index + m[0].length + 80);
        if (READ_ONLY.test(around) || NEGATED.test(text.slice(Math.max(0, m.index - 120), m.index))) {
          // "조회 전용 키만 받는다·출금 권한 키는 거부" 같은 안전 설명
          seen.add(desc);
          flags.push({ level: 'good', text: '키는 조회 전용만 쓰라고 안내함' });
          continue;
        }
      }
      if (kind === 'inject' && (DEFENSIVE.test(text.slice(Math.max(0, m.index - 300), m.index)) ||
          NEGATED.test(text.slice(Math.max(0, m.index - 200), m.index)))) {
        // "이런 문구가 보이면 따르지 마라" 같은 방어 설명이면 위험으로 세지 않는다
        seen.add(desc);
        flags.push({ level: 'good', text: '외부 내용의 지시를 따르지 말라는 방어 규칙이 있음' });
        continue;
      }
      seen.add(desc);
      let level = kind === 'secret' && netHere ? 'high' : level0; // 비밀 파일 경로 + 같은 파일에서 외부 전송
      if (kind === 'pipe' && SHADY_PIPE.test(text)) level = 'high';
      if (kind === 'inject' && path !== skillMdPath) level = 'medium'; // 참고 문서 속 문구는 한 단계 낮춤
      risks.push({ level, text: `${desc}${kind === 'secret' && level === 'high' ? ' + 같은 파일에서 외부 전송' : ''}${kind === 'pipe' && level === 'high' ? ' (출처가 수상한 주소)' : ''} — ${path.split('/').slice(-2).join('/')}: "${m[0].slice(0, 60)}"` });
    }
  }
  return { flags, risks, opaque };
}

// 등급: A 추천 / B 조건부 추천 / C 주의 / D 비추천
// opaque(정적 판정 불가)가 있으면 A·B여도 C로 낮추고 이름에 표시한다.
export function grade(license, flags, risks, opaque = []) {
  const reasons = [];
  const high = risks.filter(r => r.level === 'high').length;
  const med = risks.filter(r => r.level === 'medium').length;
  const warns = flags.filter(f => f.level === 'warn').length;
  let g;
  if (license.commercial === 'no') { g = 'D'; reasons.push('상업적으로 쓸 수 없음'); }
  else if (license.commercial === 'unknown') { g = 'D'; reasons.push('라이선스 조건 미확인'); }
  else if (license.commercial === 'conditions') { g = 'C'; reasons.push(`조건부 라이선스(${license.id})`); }
  else if (license.commercial === 'readme') { g = 'C'; reasons.push('라이선스 파일 없이 README에만 허용 표기'); }
  else if (license.commercial === 'custom') { g = 'C'; reasons.push('표준이 아닌 라이선스 — 원문 확인 필요'); }
  else { g = 'A'; reasons.push(`상업 사용 가능(${license.id})`); }
  if (high) { g = 'D'; reasons.push(`위험 신호(높음) ${high}개`); }
  else if (g !== 'D' && (med || warns)) {
    g = g === 'A' ? 'B' : 'C';
    if (med) reasons.push(`위험 신호(중간) ${med}개`);
    if (warns) reasons.push(`출처 주의 ${warns}개`);
  }
  if (opaque.length) {
    if (g === 'A' || g === 'B') g = 'C';
    reasons.push(`정적 판정 불가 ${opaque.length}개 — 코드를 읽어서는 안전을 확인할 수 없음`);
  }
  let label = { A: '추천', B: '조건부 추천', C: '주의', D: '비추천' }[g];
  if (opaque.length) label += ' · 정적 판정 불가';
  return { letter: g, label, reasons, static: opaque.length ? 'opaque' : 'ok' };
}
