# 장애 대응/복구 절차

이 문서는 오토원워크 운영 중 장애가 발생했을 때의 확인, 임시 조치, 복구, 사후 점검 절차다.

## 원칙

1. 먼저 증상을 기록한다.
2. 복구 전 현재 상태를 백업한다.
3. 데이터 복구는 새 리소스 또는 테스트 환경에서 먼저 검증한다.
4. 브라우저 캐시 문제와 서버/API 문제를 구분한다.
5. 복구 후 `docs/GROUPWARE_RELEASE_CHECKLIST.md`의 핵심 항목을 다시 확인한다.

## 1. 장애 접수 기록

장애가 발생하면 아래 정보를 먼저 남긴다.

| 항목 | 기록 |
| --- | --- |
| 발생 시각 |  |
| 보고자 |  |
| 영향 사용자 |  |
| 영향 화면 |  |
| 증상 |  |
| 재현 경로 |  |
| 최근 배포 여부 |  |
| 최근 직원/부서/데이터 수정 여부 |  |

## 2. 빠른 분류

| 증상 | 우선 의심 |
| --- | --- |
| 설치 앱 이름/아이콘이 예전 값 | PWA/브라우저 캐시 |
| 새 기능이 반영되지 않음 | 서비스워커 캐시 또는 HTML 버전 |
| 로그인 실패 | Auth API, D1 `users`, 임시 비밀번호 상태 |
| 직원/부서 목록 오류 | D1 `users`, `departments` |
| 메일/결재/채팅/게시판 데이터 누락 | KV `MAIL_KV` |
| 클라우드 파일 다운로드 실패 | R2 `GROUPWARE_FILES` 또는 D1 `cloud_files.object_key` |
| 채팅 실시간 수신 실패 | Durable Object/WebSocket, Worker |
| 전체 API 오류 | Worker 배포, Cloudflare 장애, `wrangler.toml` 바인딩 |

## 3. 캐시 장애 조치

새 배포 후 화면이 예전 상태라면 아래 순서로 확인한다.

1. 브라우저 새로고침을 한다.
2. 설치 앱을 완전히 종료 후 재실행한다.
3. 브라우저 사이트 데이터를 삭제한다.
4. 기존 설치 앱을 삭제 후 재설치한다.
5. 수정한 JS/CSS/HTML의 `?v=` 버전이 올라갔는지 확인한다.

확인 명령:

```bash
rg -n "layout/app.js|layout/auth.js|mainArea.js" *.html */*.html
```

## 4. 로컬 정적 서버 장애 조치

로컬 앱이 열리지 않으면 서버 상태를 확인한다.

```bash
ps -ax | rg "local-static-server|http.server"
```

launchd 서버 로그:

```bash
tail -n 80 /tmp/groupware-localserver.err.log
tail -n 80 /tmp/groupware-localserver.out.log
```

수동 실행:

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory "/Users/jinzero/Desktop/소스 백업/0506"
```

또는 Node 정적 서버:

```bash
node launchd/local-static-server.mjs
```

## 5. Worker/API 장애 조치

API가 실패하면 Worker와 리소스 바인딩을 확인한다.

```bash
npx wrangler deploy --dry-run
npx wrangler d1 info autone-groupware-db --json
npx wrangler kv key list --binding MAIL_KV --remote
```

확인할 파일:

- `wrangler.toml`
- `worker.js`
- `layout/config.js`

주요 바인딩:

- D1: `GROUPWARE_DB`
- KV: `MAIL_KV`
- R2: `GROUPWARE_FILES`
- Durable Object: `CHAT_ROOMS`

## 6. 배포 롤백

최근 코드 변경 직후 문제가 생겼다면 아래 순서로 대응한다.

1. 현재 운영 데이터 백업을 먼저 실행한다.
2. 마지막 정상 코드 폴더 또는 백업본을 확인한다.
3. `wrangler.toml` 바인딩이 운영 리소스와 일치하는지 확인한다.
4. 정상 코드로 Worker를 다시 배포한다.
5. PWA 캐시 버전을 올리고 프론트 파일을 갱신한다.
6. 설치 앱에서 새로고침 또는 재설치를 안내한다.

배포:

```bash
npx wrangler deploy
```

배포 후 필수 확인:

- 로그인
- 홈
- 메일 목록/읽기
- 채팅 목록/메시지
- 전자결재 목록/상세
- 클라우드 파일 다운로드

## 7. D1 복구

D1은 직원, 부서, 클라우드 파일 메타데이터의 원본이다.

복구 전 반드시 현재 상태를 다시 백업한다.

```bash
BACKUP_DIR="$HOME/Desktop/groupware-backups/pre-restore-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR/d1"
npx wrangler d1 export autone-groupware-db --remote --output "$BACKUP_DIR/d1/groupware-db.sql" --skip-confirmation
```

복구:

```bash
npx wrangler d1 execute autone-groupware-db \
  --remote \
  --file "$RESTORE_DIR/d1/groupware-db.sql"
```

복구 후 확인:

- 직원 목록
- 부서 목록
- 로그인
- 클라우드 파일 목록

## 8. KV 복구

KV는 메일, 전자결재, 일정, 근태, 게시판, 채팅, 알림 데이터를 담는다.

단일 키 복구:

```bash
npx wrangler kv key put "calendar:shared" \
  --binding MAIL_KV \
  --remote \
  --path "$RESTORE_DIR/kv/calendar-shared.json"
```

주요 복구 단위:

| 장애 화면 | 우선 복구 키 |
| --- | --- |
| 메일 | `mail:*`, `draft:*` |
| 전자결재 | `approval:document:*`, `approval:documents` |
| 캘린더 | `calendar:shared` |
| 근태 | `attendance:*` |
| 공지사항 | `board:news` |
| 리소스센터 | `board:resources` |
| 팀게시판 | `board:teamboard` |
| 채팅 | `chat:rooms`, `chat:messages:*` |
| 알림 | `notifications:user:*` |

복구 후에는 해당 화면을 직접 열어 데이터가 표시되는지 확인한다.

## 9. R2 복구

R2는 파일 원본을 담는다. D1의 `cloud_files.object_key`와 R2 객체 키가 반드시 일치해야 한다.

개별 객체 복구:

```bash
npx wrangler r2 object put "autone-groupware-files/<OBJECT_KEY>" \
  --remote \
  --file "$RESTORE_DIR/r2/<OBJECT_KEY>"
```

복구 후 확인:

- 클라우드 파일 다운로드
- 메일 공유 첨부 다운로드
- 전자결재 첨부 다운로드

## 10. 채팅 장애 조치

채팅 목록은 보이지만 실시간 메시지가 오지 않으면 아래를 확인한다.

1. 새로고침 후 메시지 목록이 갱신되는지 확인한다.
2. WebSocket 연결이 막혔는지 브라우저 개발자 도구에서 확인한다.
3. Worker 배포 상태를 확인한다.
4. Durable Object 바인딩 `CHAT_ROOMS`가 `wrangler.toml`에 있는지 확인한다.
5. 실시간만 실패하고 목록/메시지 조회가 정상이라면, 사용자는 새로고침으로 임시 대응한다.

채팅 원본 복구 대상은 Durable Object가 아니라 KV의 `chat:rooms`, `chat:messages:*`다.

## 11. 메일 장애 조치

메일 발송 실패:

- Worker API 오류 확인
- SendGrid 키 설정 확인
- 수신자/발신자 메일주소 확인

메일 목록 누락:

- `mail:*` KV 키 확인
- 폴더 이동/삭제 API 최근 변경 확인
- 백업에서 해당 메일 키 복구

임시저장 누락:

- `draft:*` KV 키 확인
- 작성 화면 자동저장 동작 확인

## 12. 로그인/비밀번호 장애 조치

로그인 실패:

1. 직원 목록에 계정이 있는지 확인한다.
2. 관리자에서 비밀번호 초기화를 실행한다.
3. 임시 비밀번호 `1234`로 로그인한다.
4. 비밀번호 변경 화면으로 이동되는지 확인한다.

관리자도 로그인할 수 없으면 D1 `users` 테이블 또는 KV 레거시 `auth:employees` 상태를 확인한다.

## 13. 복구 후 확인 체크리스트

- [ ] 운영 URL 로그인 성공
- [ ] PWA 앱 로그인 성공
- [ ] 직원/부서 목록 정상
- [ ] 메일 목록/읽기/발송 정상
- [ ] 채팅 목록/메시지/실시간 수신 정상
- [ ] 전자결재 목록/상세/승인 정상
- [ ] 캘린더 일정 정상
- [ ] 근태/휴가 정상
- [ ] 게시판/클라우드 정상
- [ ] 파일 다운로드 정상
- [ ] 서비스워커 캐시 갱신 정상

## 14. 사후 기록

| 항목 | 기록 |
| --- | --- |
| 장애 원인 |  |
| 복구 시작 시각 |  |
| 복구 완료 시각 |  |
| 사용한 백업 |  |
| 복구한 리소스 | D1 / KV / R2 / Worker / PWA |
| 추가 조치 |  |
| 재발 방지 |  |

## 관련 문서

- `docs/GROUPWARE_BACKUP_RESTORE.md`
- `docs/GROUPWARE_RELEASE_CHECKLIST.md`
- `docs/GROUPWARE_EMPLOYEE_OPERATIONS.md`
