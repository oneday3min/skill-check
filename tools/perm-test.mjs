// "쓰기·거래·출금 권한 키를 요구" 규칙 시험: node tools/perm-test.mjs  (GitHub 호출 없음)
import { scanFiles } from '../public/js/check.mjs';

const DESC = '쓰기·거래·출금 권한 키를 요구';
const cases = [
  // [이름, SKILL.md 본문, 위험으로 잡혀야 하는지]
  ['거래 권한 켜기', 'Create a Binance API key and enable trading permission.', true],
  ['출금 권한', 'The key needs withdrawal permissions to move funds.', true],
  ['거래 키', 'Paste your trading API key into .env.', true],
  ['권한 필요 없음 문장', 'Uses directory junctions, which need no admin rights.', false],
  ['취약점 설명', 'Misconfigured rules allow public write access to the database.', false],
  ['승인자 설명', 'Merging requires an approval from someone else with write access.', false],
  ['플래시 쓰기', 'Enable write access to the flash memory before programming.', false],
  ['GitHub repo 범위', 'Create a personal access token with scopes: repo, delete_repo', true],
  ['한국어 출금 권한', '업비트 키를 만들 때 출금 권한을 켜 주세요.', true],
  ['조회 전용 안내', 'Use a read-only API key. Keys with trading permission are rejected.', false],
  ['켜지 말라는 안내', 'Never enable withdrawal permissions on this key.', false],
  ['한국어 조회 전용', '조회 전용 키만 넣으세요. 거래 권한이 켜진 키는 등록을 거부합니다.', false],
  ['평범한 키', 'Set OPENAI_API_KEY in your environment.', false],
  ['쓰기 언급만', 'This skill helps you write better commit messages.', false],
];
let ok = 0;
for (const [name, text, want] of cases) {
  const r = scanFiles([{ path: 's/SKILL.md', text }], 's/SKILL.md');
  const got = r.risks.some(x => x.text.startsWith(DESC));
  ok += got === want;
  console.log(`${got === want ? '✓' : '✗'} ${name}: ${got ? '위험' : r.flags.some(f => /조회 전용/.test(f.text)) ? '안전 안내(좋음)' : '없음'}`);
}
console.log(`\n${ok}/${cases.length}`);
if (ok !== cases.length) process.exit(1);
