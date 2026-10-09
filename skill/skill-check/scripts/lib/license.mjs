// 라이선스 문구 → 상업적 사용 판정. 규칙 기반(모델 호출 없음, 비용 0).
// commercial: 'yes' | 'conditions' | 'no' | 'unknown'

const RULES = [
  // 순서 중요: 구체적인 것 먼저
  { id: 'Proprietary', re: /\bproprietary\b|all rights reserved|governed by your agreement/i, commercial: 'no',
    note: '저작권자 허락(계약) 없이는 쓸 수 없음' },
  { id: 'CC-BY-NC', re: /\bCC[- ]?BY[- ]?NC\b|non-?commercial|noncommercial/i, commercial: 'no',
    note: '비영리만 허용' },
  { id: 'CC-BY-ND', re: /\bCC[- ]?BY[- ]?ND\b|no ?derivatives/i, commercial: 'conditions',
    note: '수정본 배포 금지' },
  { id: 'AGPL-3.0', re: /\bAGPL|GNU AFFERO/i, commercial: 'conditions',
    note: '네트워크 서비스로 제공해도 소스 공개 의무' },
  { id: 'LGPL', re: /\bLGPL|GNU LESSER/i, commercial: 'conditions', note: '수정한 라이브러리 소스 공개' },
  { id: 'GPL', re: /\bGPL|GNU GENERAL PUBLIC/i, commercial: 'conditions', note: '배포 시 같은 라이선스로 소스 공개' },
  { id: 'MPL-2.0', re: /\bMPL|Mozilla Public License/i, commercial: 'conditions', note: '수정한 파일 소스 공개' },
  { id: 'CC-BY-SA', re: /\bCC[- ]?BY[- ]?SA\b|ShareAlike/i, commercial: 'conditions', note: '같은 조건으로 공유, 출처 표시' },
  { id: 'BUSL', re: /Business Source License|\bBUSL\b|\bBSL-1/i, commercial: 'conditions', note: '운영 서비스 사용 제한 가능(조건 확인)' },
  { id: 'Elastic/SSPL', re: /Elastic License|\bSSPL\b|Server Side Public/i, commercial: 'conditions', note: '관리형 서비스 제공 제한' },
  { id: 'Apache-2.0', re: /Apache License,?\s*Version 2|\bApache-2\.0\b|^\s*Apache License/im, commercial: 'yes',
    note: '상업 사용 가능, 고지문(NOTICE)·변경 표시 유지' },
  { id: 'MIT', re: /\bMIT\b|Permission is hereby granted, free of charge/i, commercial: 'yes', note: '상업 사용 가능, 저작권 고지 유지' },
  { id: 'BSD', re: /\bBSD\b|Redistribution and use in source and binary forms/i, commercial: 'yes', note: '상업 사용 가능, 고지 유지' },
  { id: 'ISC', re: /\bISC\b/i, commercial: 'yes', note: '상업 사용 가능' },
  { id: 'CC0/Unlicense', re: /\bCC0\b|Unlicense|public domain|\b0BSD\b/i, commercial: 'yes', note: '조건 없음' },
  { id: 'CC-BY', re: /\bCC[- ]?BY\b|Creative Commons Attribution/i, commercial: 'yes', note: '상업 사용 가능, 출처 표시 필수' },
];

const SPDX = {
  'MIT': 'MIT', 'Apache-2.0': 'Apache-2.0', 'BSD-2-Clause': 'BSD', 'BSD-3-Clause': 'BSD', 'ISC': 'ISC',
  'Unlicense': 'CC0/Unlicense', 'CC0-1.0': 'CC0/Unlicense', '0BSD': 'CC0/Unlicense',
  'GPL-2.0': 'GPL', 'GPL-3.0': 'GPL', 'AGPL-3.0': 'AGPL-3.0', 'LGPL-2.1': 'LGPL', 'LGPL-3.0': 'LGPL',
  'MPL-2.0': 'MPL-2.0', 'CC-BY-4.0': 'CC-BY', 'CC-BY-SA-4.0': 'CC-BY-SA',
};

function classify(text) {
  if (!text || !String(text).trim()) return null;
  const t = String(text).slice(0, 6000);
  for (const r of RULES) if (r.re.test(t)) return { id: r.id, commercial: r.commercial, note: r.note };
  return { id: 'Custom', commercial: 'unknown', note: '표준 라이선스가 아님 — 원문 확인 필요' };
}

function fromSpdx(spdx) {
  if (!spdx || spdx === 'NOASSERTION') return null;
  const id = SPDX[spdx] || SPDX[spdx.replace(/-(only|or-later)$/, '')];
  if (!id) return { id: spdx, commercial: 'unknown', note: 'GitHub가 인식한 라이선스 — 원문 확인' };
  const r = RULES.find(x => x.id === id);
  return { id, commercial: r.commercial, note: r.note };
}

const NONE = { id: 'None', commercial: 'no', note: '라이선스 없음 = 법적으로 모든 권리 보유. 공개돼 있어도 쓸 권리는 없음' };

export { classify, fromSpdx, NONE };
