// 라이선스 판정 시험: SPDX 공식 원문 22종 + 실제 사례. node tools/license-test.mjs
import { classify } from '../public/js/license.mjs';

const base = 'https://raw.githubusercontent.com/spdx/license-list-data/main/text/';
const expect = {
  'MIT': 'MIT', 'Apache-2.0': 'Apache-2.0', 'BSD-2-Clause': 'BSD', 'BSD-3-Clause': 'BSD', 'ISC': 'ISC', '0BSD': 'ISC',
  'Unlicense': 'CC0/Unlicense', 'CC0-1.0': 'CC0/Unlicense', 'CC-BY-4.0': 'CC-BY', 'CC-BY-SA-4.0': 'CC-BY-SA',
  'CC-BY-NC-4.0': 'CC-BY-NC', 'CC-BY-NC-SA-4.0': 'CC-BY-NC', 'CC-BY-ND-4.0': 'CC-BY-ND', 'GPL-2.0-only': 'GPL',
  'GPL-3.0-only': 'GPL', 'LGPL-2.1-only': 'LGPL', 'LGPL-3.0-only': 'LGPL', 'AGPL-3.0-only': 'AGPL-3.0', 'MPL-2.0': 'MPL-2.0',
  'BUSL-1.1': 'BUSL', 'Elastic-2.0': 'Elastic/SSPL', 'SSPL-1.0': 'Elastic/SSPL',
};
const real = {
  'https://raw.githubusercontent.com/NeoLabHQ/context-engineering-kit/master/LICENSE': 'GPL',
  'https://raw.githubusercontent.com/anthropics/skills/main/skills/docx/LICENSE.txt': 'Proprietary',
  'https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/LICENSE.txt': 'Apache-2.0',
  'https://raw.githubusercontent.com/deanpeters/Product-Manager-Skills/main/LICENSE': 'CC-BY-NC',
  'https://raw.githubusercontent.com/trailofbits/skills/main/LICENSE': 'CC-BY-SA',
};
let ok = 0, n = 0;
const check = (name, text, want) => {
  const got = classify(text)?.id;
  n++; ok += got === want;
  console.log(`${got === want ? '✓' : '✗'} ${name.padEnd(70).slice(0, 70)} 정답 ${want} · 판정 ${got}`);
};
for (const [id, want] of Object.entries(expect)) check(id, await (await fetch(base + id + '.txt')).text(), want);
for (const [u, want] of Object.entries(real)) check(u.replace('https://raw.githubusercontent.com/', ''), await (await fetch(u)).text(), want);
check('MIT + "All rights reserved" 머리말', 'Copyright (c) 2024 Foo. All rights reserved.\n\nPermission is hereby granted, free of charge, to any person', 'MIT');
console.log(`\n${ok}/${n}`);
