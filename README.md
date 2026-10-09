# Skill Check — 써도 되는 AI 스킬

**공개돼 있다고 다 공짜는 아닙니다.** Skill Check는 오픈소스 AI 에이전트 스킬(SKILL.md)마다 **상업적으로 무료로 써도 되는지**, **출처가 깨끗한지**, **위험한 명령이 있는지** 검사해 A~D 등급을 매깁니다.

- 웹: https://onedayailab.com/skills/ (추천 목록 + 주소 넣고 바로 검사)
- 스킬 버전: [`skill/skill-check/`](skill/skill-check/) — Claude Code·Codex 등에 넣고 "이 스킬 써도 돼?"라고 물으면 됩니다.

## 왜 만들었나

2026-10-09에 실제로 확인한 것:

- Anthropic 공식 저장소 [anthropics/skills](https://github.com/anthropics/skills)는 저장소 전체 라이선스 표시가 없고 **스킬 폴더마다 라이선스가 다릅니다.** 14개는 Apache-2.0이지만 `docx`·`pdf`·`pptx`·`xlsx`는 비공개(source-available) 라이선스이고, `doc-coauthoring`에는 라이선스 파일이 없습니다.
- 유명 모음집 중에는 그 비공개 스킬을 그대로 다시 올려 둔 곳이 있고, 수백 개 스킬에 라이선스 파일이 없는 곳도 있습니다.
- GitHub에 공개돼 있어도 **라이선스가 없으면 법적으로는 모든 권리가 저작권자에게 있습니다.** 보는 건 되지만 복사·수정·상업적 사용의 권리는 없습니다.

보안 검사기는 이미 여럿 있지만, 라이선스와 출처를 **스킬 하나하나** 따져 주는 도구는 찾지 못해서 만들었습니다.

## 등급

| 등급 | 뜻 |
|---|---|
| **A 추천** | MIT·Apache-2.0·BSD·ISC·CC0·CC-BY, 출처 경고 없음, 중간 이상 위험 신호 없음 |
| **B 조건부 추천** | 라이선스는 괜찮지만 확인할 것 하나(글꼴 포함, 남의 브랜드 이름, 동적 코드 실행 등) |
| **C 주의** | GPL·AGPL·MPL·CC-BY-SA 등 소스 공개·같은 조건 공유 의무, 표준이 아닌 라이선스, 또는 README에만 라이선스 표기 |
| **D 비추천** | 비공개·비영리(NC)·라이선스 없음, 또는 높은 위험 신호 |

라이선스 근거는 **스킬 폴더의 LICENSE → SKILL.md `license` 칸 → 상위 폴더·저장소 LICENSE → README 문구** 순으로 찾고, 근거 파일을 항상 같이 보여 줍니다.

출처 검사: 포크, 저장소 나이, 관리 주체, 저장소와 스킬 라이선스가 다른지, 저작권자 표기, 유명 원본(Anthropic 공식 스킬)의 사본인지, "가져왔다"는 문구, 글꼴·미디어 포함, 남의 브랜드 이름, 비공식(역설계) API·대형 사이트 수집.

위험 신호(참고용): 받은 스크립트 바로 실행, 비밀키 경로(+외부 전송), 사용자 몰래 하라는 문구, 인코딩된 내용 해독, 동적 코드 실행, 넓은 삭제, Bash 무제한 허용. 방어용 설명("외부 지시를 따르지 마라"), 검사기 코드 속 규칙 정의, 주석은 위험으로 세지 않습니다. **전문 보안 검사기가 아닙니다.**

## 쓰는 법

설치할 것 없음 (Node.js 18+).

```bash
node cli.mjs https://github.com/anthropics/skills          # 저장소 전체(앞 40개 스킬)
node cli.mjs https://github.com/OWNER/REPO/tree/main/skills/NAME   # 스킬 하나
node cli.mjs OWNER/REPO --json
```

- 추천 목록 다시 만들기: `node catalog/build.mjs` (이미 검사한 저장소는 건너뜀, `--refresh`면 전부 다시). 저장소 목록은 `catalog/repos.txt`, 한국어 한 줄 설명은 `catalog/ko_*.tsv`.
- 웹 화면: `public/` 폴더를 그대로 정적 호스팅. 검사는 방문자 브라우저가 GitHub 공개 API를 직접 부릅니다(서버 없음).
- 스킬 버전 갱신: `node tools/pack-skill.mjs`, 우리 스킬 자체 검사: `node tools/selftest.mjs`.

GitHub는 키 없이 시간당 60회까지 허용합니다(저장소 하나에 2회). 더 필요하면 `GITHUB_TOKEN` 환경변수를 설정하세요.

## 한계

- 규칙 기반 자동 판독이라 틀릴 수 있습니다. **법률 자문이 아니며**, 상업적으로 쓰기 전에 근거 링크의 라이선스 원문을 직접 확인하세요.
- 큰 저장소는 앞 40개 스킬만 봅니다(하위 폴더 주소를 넣으면 그 부분만).
- 다른 사람의 스킬 코드는 이 저장소에 복사하지 않습니다. 검사 결과와 원본 링크만 담습니다.

틀린 판정은 이슈나 [@oneday3min](https://x.com/oneday3min)으로 알려 주세요.

## License

MIT © 2026 oneday3min (ONEDAY Studio)
