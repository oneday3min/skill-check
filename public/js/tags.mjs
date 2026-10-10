// 스킬 꼬리표: 이름·설명(영어)·한국어 한 줄에서 규칙으로 "다루는 것"·"하는 일"·코딩 필요·강한 권한을 붙인다.
// 브라우저(진단)와 Node(검증 tools/tag-audit.mjs)가 같이 쓴다. AI 호출 없음.

// 다루는 것 — [id, 한국어 이름, 규칙]
export const OBJECTS = [
  ['word', '워드·한글 문서', /\bdocx?\b|\bword (document|file)s?\b|microsoft word|\bhwpx?\b|한글 문서|워드/],
  ['pdf', 'PDF', /\bpdfs?\b/],
  ['slides', '발표자료', /\bpptx?\b|powerpoint|\bslides?\b|slide ?deck|\bdecks?\b|presentation|keynote|발표|슬라이드/],
  ['sheet', '엑셀·표', /\bxlsx?\b|\bexcel\b|spreadsheet|\bcsv\b|google sheets|엑셀|스프레드시트/],
  ['image', '이미지·디자인', /\bimages?\b|\blogos?\b|\bicons?\b|illustrat|\bposters?\b|\bfigma\b|\bsvg\b|\bpng\b|photo|graphic design|visual design|brand(ing)? (asset|guideline|identity)|generative art|canvas|이미지|그림|포스터|로고|아이콘|사진|디자인/],
  ['video', '영상', /\bvideos?\b|youtube|remotion|ffmpeg|영상|동영상|유튜브/],
  ['audio', '소리·음성', /\baudio\b|\bspeech\b|voice ?(over|clon|agent|record)|podcast|\bmusic\b|\btts\b|transcri|음성|소리|음악|팟캐스트|받아쓰기/],
  ['web', '웹 화면', /front-?end|\breact\b|next\.?js|\bvue\b|svelte|\bcss\b|tailwind|\bhtml\b|\bui\b|\bux\b|landing page|website|web ?app|web page|browser|component librar|웹|프론트|화면/],
  ['backend', '서버·API', /back-?end|\bapis?\b|\brest(ful)?\b|graphql|\bservers?\b|endpoint|fastapi|django|express|\bflask\b|microservice|서버|백엔드/],
  ['db', '데이터베이스', /database|\bsql\b|postgres|mysql|sqlite|supabase|mongo|\bredis\b|db schema|데이터베이스|\bdb\b/],
  ['mobile', '모바일 앱', /\bios\b|android|\bswift(ui)?\b|kotlin|react native|flutter|\bmobile\b|\bexpo\b|모바일|앱 개발/],
  ['git', 'GitHub·버전관리', /\bgit\b|github|pull request|\bprs?\b|\bcommits?\b|\bbranch|code review|깃허브|커밋|브랜치/],
  ['cloud', '클라우드·배포', /\baws\b|\bgcp\b|google cloud|azure|cloudflare|vercel|netlify|docker|kubernetes|\bk8s\b|terraform|\bdeploy|ci\/cd|github actions|infrastructure|클라우드|배포|도커/],
  ['security', '보안', /security|vulnerab|pentest|penetration|threat model|\bcve\b|malware|exploit (dev|code|chain)|secrets? (scan|manage)|owasp|보안|취약/],
  ['writing', '글쓰기', /\bwriting\b|\bwrite (an? )?(article|post|essay|story|copy)|blog|article|\bessays?\b|copywrit|proofread|\btone\b|storytell|newsletter|\bstory\b|글쓰기|블로그|기사|문장|카피|교정|원고/],
  ['marketing', 'SNS·마케팅', /marketing|\bseo\b|social media|twitter|\bx\.com\b|linkedin|instagram|tiktok|\bads?\b|advertis|campaign|\bbrand\b|growth (loop|hack|strateg|marketing)|go-to-market|\bgtm\b|product launch|competitor|landing|conversion|마케팅|광고|\bsns\b|브랜드|홍보|검색 노출|경쟁사/],
  ['shop', '쇼핑몰·판매', /e-?commerce|amazon|\bebay\b|shopify|marketplace|product listing|\bsellers?\b|\bproducts? (page|detail|data)|쇼핑|마켓|상품|판매자|셀러/],
  ['docs', '기획서·문서 작성', /documentation|\bdocs\b|\bprd\b|\bspecs?\b|specification|requirements? doc|user stor|readme|changelog|release notes|\bmemo\b|기획서|명세|문서 작성|회의록|보고서/],
  ['email', '메일·일정·업무 관리', /\bemails?\b|gmail|outlook|\bslack\b|calendar|meeting|notion|\bjira\b|linear|asana|trello|todo|to-do|\btasks? (list|manag|breakdown)|break (work|it) into|project manag|이메일|메일|일정|회의|슬랙|노션|협업|할 일|작업 목록/],
  ['research', '연구·논문', /research (paper|literature|question|method)|academic research|scientific research|\bpapers?\b|arxiv|literature|scientific|citation|academic|scholar|pubmed|논문|연구|문헌|학술/],
  ['data', '데이터 분석', /data analy|analytics|dataset|pandas|\bcharts?\b|visuali[sz]|dashboard|statistic|metrics|\bkpi\b|jupyter|notebook|데이터|분석|차트|통계|시각화|대시보드/],
  ['finance', '돈·회계', /financ|accounting|invoice|\bstocks?\b|budget|\btax(es)?\b|revenue|bookkeep|payroll|\bpayments?\b|stripe|pricing|monetiz|회계|재무|세금|주식|매출|예산|결제|인보이스|가격/],
  ['legal', '법률·계약', /\blegal\b|contract (review|draft|clause|negotiat|law)|\bclauses?\b|\bnda\b|compliance|hipaa|soc ?2|\bgdpr\b|privacy polic|terms of service|\blaw\b|regulat|법률|계약서|규정|약관|컴플라이언스/],
  ['game3d', '게임·3D', /game (dev|engine|design|play)|video games?|\bgamedev|\bunity\b|unreal|godot|\b3d\b|blender|three\.js|게임/],
  ['ai', 'AI·에이전트 만들기', /\bllms?\b|\bprompts?\b|\bagents?\b|mcp server|build(ing)? (an? )?mcp|\brag\b|embedding|fine-?tun|subagent|\bskills?\b|claude code|claude api|anthropic sdk|에이전트|프롬프트|스킬/],
  ['code', '코드 전반', /\bcode\b|codebase|refactor|\blint|typescript|javascript|python|\brust\b|golang|\bjava\b|programming|\bfunction|\bbugs?\b|firmware|embedded|코드|리팩터|프로그래밍|펌웨어/],
  ['science', '과학·의료', /biolog|chemi|genom|protein|physics|mathemat|math (proof|problem|olympiad)|medical|clinical|healthcare|patient|bioinfo|molecul|\bdrugs?\b|의료|생물|화학|수학|의학|약물|유전자/],
];

// 하는 일
export const TASKS = [
  ['create', '새로 만들기', /\bcreat|generat|\bbuild|\bwrit(e|ing)\b|\bdraft|\bmake\b|\bdesign|scaffold|compose|만들|생성|작성|제작|설계/],
  ['edit', '고치기·변환', /\bedit|convert|transform|\bformat|refactor|migrat|translat|\bfix|rewrite|improve|polish|수정|변환|편집|번역|고치|개선|다듬/],
  ['analyze', '분석·요약', /analy[sz]|summari|extract|insight|\breport|\bparse|evaluat|assess|분석|요약|추출|보고서|평가/],
  ['search', '찾기·수집', /\bsearch|scrap|crawl|\bfetch|look ?up|\bfind\b|discover|gather|collect|monitor|검색|수집|크롤|찾/],
  ['automate', '자동화', /automat|workflow|pipeline|schedul|\bbatch|integrat|orchestrat|\bcron\b|자동|워크플로|연동|반복/],
  ['review', '검토·테스트', /\btests?\b|testing|debug|\breview|\blint|\bqa\b|\baudit|troubleshoot|테스트|디버그|디버깅|검토|검사|점검|검증/],
  ['ops', '배포·운영', /\bdeploy|release|incident|devops|observab|on-?call|\binfra|\bci\b|배포|운영|장애/],
  ['learn', '배우기·안내', /\bteach|\blearn|tutorial|\bguide|explain|onboard|best practice|\bcourse|\bcoach|학습|안내|가이드|배우|설명|교육/],
];

const DEV_OBJ = new Set(['web', 'backend', 'db', 'mobile', 'git', 'cloud', 'code', 'game3d']);
const DEV_CAT = new Set(['개발·코딩', '테스트·디버깅', '연동·API']);
// 가입·키가 필요한 외부 서비스
const NEEDS_KEY = /api[ _-]?key|access token|\btoken\b|credentials|\boauth\b|account required|sign ?up|\bsubscription|_api_key|composio|rube mcp|환경변수|키가 필요|계정/;

// 여러 스킬에 똑같이 붙은 상투 문구는 꼬리표에서 뺀다
const BOILER = /as csv, sql, json schema,? or notion on request\.?/gi;
export function textOf(s) {
  const ko = typeof s.ko === 'string' ? s.ko : (s.ko && s.ko.ko) || '';
  return `${String(s.name || '').replace(/[-_]+/g, ' ')} ${String(s.description || '').replace(BOILER, '')} ${ko}`.toLowerCase();
}

// 핵심 문장: 이름 + 한국어 한 줄 + 영어 설명 첫 문장("Use when…" 앞까지). 나머지 설명은 쓰는 상황이라 동사가 많이 섞인다.
export function coreOf(s) {
  const ko = typeof s.ko === 'string' ? s.ko : (s.ko && s.ko.ko) || '';
  const first = String(s.description || '').replace(BOILER, '').split(/(?<=[.!?])\s|\buse (this )?(skill )?(when|for|to)\b|\btrigger/i)[0];
  return `${String(s.name || '').replace(/[-_]+/g, ' ')} ${ko} ${first}`.toLowerCase();
}
// 핵심 문장에서 먼저 찾고, 없을 때만 전체 설명에서(약한 근거로 표시)
const pick = (list, core, full) => {
  const hit = list.filter(([, , re]) => re.test(core)).map(([id]) => id);
  return hit.length ? { ids: hit, core: true } : { ids: list.filter(([, , re]) => re.test(full)).map(([id]) => id), core: false };
};
// 특정 회사 전용(남의 브랜드 규칙 등) — 남에게는 쓸모가 적다
const OWN = /전용\)|anthropic'?s? (official )?brand/;
const DEV_HINT = /codebase|repositor|\brepo\b|implement|compil|binar|firmware|\bgpu\b|train(s|ing)? (large )?(language )?models?|pull request|\bcli\b|source code|저장소|깃허브/;

export function tagSkill(s) {
  const t = textOf(s);
  const c = coreOf(s);
  const po = pick(OBJECTS, c, t), o = po.ids;
  const k = pick(TASKS, c, t).ids;
  // 개발자용: 개발 분류, 개발 대상이 대부분인 스킬, 또는 핵심 문장에 개발 용어
  const devObj = o.filter(x => DEV_OBJ.has(x)).length;
  const dev = DEV_CAT.has(s.category) || (devObj > 0 && devObj > o.length - devObj) || DEV_HINT.test(c);
  const risks = s.risks || [];
  const power = risks.some(r => r.level === 'high' || r.level === 'medium') ? 2 : risks.length ? 1 : 0;
  return { o, oc: po.core, k, dev, own: OWN.test(t), scripts: (s.counts && s.counts.scripts) || 0, power, key: NEEDS_KEY.test(t) };
}

// 한 문장 입력 → 꼬리표 감지 + 두 글자 조각(한국어) / 단어(영어)
export function detect(q) {
  const t = String(q || '').toLowerCase();
  return {
    o: OBJECTS.filter(([, , re]) => re.test(t)).map(([id]) => id),
    k: TASKS.filter(([, , re]) => re.test(t)).map(([id]) => id),
  };
}
export function grams(text) {
  const out = new Set();
  for (const w of String(text || '').toLowerCase().split(/[^0-9a-z가-힣]+/).filter(Boolean)) {
    if (/[가-힣]/.test(w)) { if (w.length === 1) out.add(w); for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2)); }
    else if (w.length > 2) out.add(w.replace(/(ing|es|s)$/, ''));
  }
  return out;
}
