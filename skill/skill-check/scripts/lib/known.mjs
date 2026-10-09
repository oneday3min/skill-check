// 잘 알려진 원본 스킬. 다른 저장소에 같은 이름·설명이 있으면 "사본"으로 본다.
// 출처: https://github.com/anthropics/skills (2026-10-09 확인, 스킬 폴더별 LICENSE.txt)
const ANTHROPIC = {
  repo: 'anthropics/skills',
  proprietary: ['docx', 'pdf', 'pptx', 'xlsx'],
  apache: ['academy-guide', 'algorithmic-art', 'brand-guidelines', 'canvas-design', 'claude-api', 'discernment-nudge',
    'frontend-design', 'internal-comms', 'mcp-builder', 'skill-creator', 'slack-gif-creator', 'theme-factory',
    'web-artifacts-builder', 'webapp-testing'],
  nolicense: ['doc-coauthoring'],
};

function original(name, description, owner, licText) {
  if (/^anthropics?$/i.test(owner)) return null;
  const n = String(name || '').toLowerCase();
  const d = String(description || '');
  const all = [...ANTHROPIC.proprietary, ...ANTHROPIC.apache, ...ANTHROPIC.nolicense];
  if (!all.includes(n)) return null;
  // 이름이 흔한 경우(pdf 등) 오탐을 줄이려고 설명에 원본 특유 문구가 있는지도 본다
  const sig = /Anthropic|Claude's|Use this skill whenever|comprehensive|toolkit/i.test(d) || /Anthropic, PBC/.test(licText || '');
  if (!sig) return null;
  const license = ANTHROPIC.proprietary.includes(n) ? 'Proprietary' : ANTHROPIC.apache.includes(n) ? 'Apache-2.0' : 'None';
  return { from: `${ANTHROPIC.repo}/skills/${n}`, license };
}

export { original };
