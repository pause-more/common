# 오토원워크 백업/복구 가이드

이 문서는 2026-05-13 현재 `/Users/jinzero/Desktop/소스 백업/0506` 프로젝트 기준이다.

## 저장소 구조

운영 데이터는 Cloudflare 리소스에 나뉘어 저장된다.

| 리소스 | 바인딩 | 저장 내용 |
| --- | --- | --- |
| D1 | `GROUPWARE_DB` | 직원, 부서, 클라우드 파일 메타데이터 |
| R2 | `GROUPWARE_FILES` | 클라우드 파일/첨부파일 원본 |
| KV | `MAIL_KV` | 메일, 임시저장, 전자결재, 게시판, 일정, 근태, 채팅 메시지, 알림 |
| Durable Object | `CHAT_ROOMS` | 채팅 WebSocket 연결 상태 |

Durable Object는 실시간 연결 상태가 중심이므로 정기 백업 대상은 아니다. 채팅방/메시지 원본은 `MAIL_KV`의 `chat:rooms`, `chat:messages:*` 키를 백업한다.

## 백업 폴더 규칙

백업은 프로젝트 밖 안전한 위치에 날짜별로 저장한다. 기본 자동화 스크립트는 `scripts/backup-data.sh`다.

```bash
BACKUP_DIR="$HOME/Desktop/groupware-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"/{d1,kv,r2,meta}
```

백업 세트에는 최소한 아래 파일이 있어야 한다.

```text
groupware-backups/YYYYMMDD-HHMMSS/
  d1/groupware-db.sql
  kv/kv-keys.json
  kv/*.json
  r2/object-keys.json
  meta/backup-manifest.json
  meta/wrangler.toml
  meta/README.txt
```

## D1 백업

D1은 정식 데이터베이스 백업 파일을 만든다.

```bash
npx wrangler d1 export autone-groupware-db \
  --remote \
  --output "$BACKUP_DIR/d1/groupware-db.sql" \
  --skip-confirmation
```

확인:

```bash
test -s "$BACKUP_DIR/d1/groupware-db.sql"
npx wrangler d1 info autone-groupware-db --json > "$BACKUP_DIR/meta/d1-info.json"
```

## KV 백업

먼저 전체 키 목록을 저장한다.

```bash
npx wrangler kv key list \
  --binding MAIL_KV \
  --remote \
  > "$BACKUP_DIR/kv/kv-keys.json"
```

현재 앱에서 중요한 KV 키/프리픽스는 아래와 같다.

| 키/프리픽스 | 내용 |
| --- | --- |
| `mail:*` | 수신/발신/이동된 메일 본문과 메타 |
| `draft:*` | 메일 임시저장 |
| `approval:document:*` | 전자결재 문서 상세 |
| `approval:documents` | 전자결재 레거시/목록 호환 데이터 |
| `calendar:shared` | 공유/전사/팀 일정 |
| `board:news` | 공지사항 |
| `board:resources` | 리소스센터 |
| `board:teamboard` | 팀게시판 |
| `attendance:*` | 사용자별 근태 기록 |
| `chat:rooms` | 채팅방 목록 |
| `chat:messages:*` | 채팅 메시지 |
| `notifications:user:*` | 사용자별 알림 |
| `auth:temp-password-flags` | 임시 비밀번호 상태 |

단일 키는 아래처럼 저장한다.

```bash
npx wrangler kv key get "board:news" --binding MAIL_KV --remote --text > "$BACKUP_DIR/kv/board-news.json"
npx wrangler kv key get "board:resources" --binding MAIL_KV --remote --text > "$BACKUP_DIR/kv/board-resources.json"
npx wrangler kv key get "board:teamboard" --binding MAIL_KV --remote --text > "$BACKUP_DIR/kv/board-teamboard.json"
npx wrangler kv key get "calendar:shared" --binding MAIL_KV --remote --text > "$BACKUP_DIR/kv/calendar-shared.json"
npx wrangler kv key get "chat:rooms" --binding MAIL_KV --remote --text > "$BACKUP_DIR/kv/chat-rooms.json"
```

프리픽스가 있는 데이터는 `kv-keys.json`에서 키를 확인한 뒤 `kv key get`으로 하나씩 저장한다. `scripts/backup-kv.mjs`를 실행하면 키별 값과 `wrangler kv bulk put` 복구용 `kv/bulk-put.json`을 함께 만든다.

## R2 백업

R2 파일 원본은 `GROUPWARE_FILES` 버킷에 있다. 객체 키는 D1의 `cloud_files.object_key`에 저장된다.

우선 D1에서 R2 객체 키 목록을 별도로 저장한다.

```bash
npx wrangler d1 execute autone-groupware-db \
  --remote \
  --command "SELECT object_key FROM cloud_files WHERE object_key IS NOT NULL AND object_key != ''" \
  --json \
  > "$BACKUP_DIR/r2/object-keys.json"
```

개별 객체 다운로드 예시:

```bash
npx wrangler r2 object get "autone-groupware-files/<OBJECT_KEY>" \
  --remote \
  --file "$BACKUP_DIR/r2/<OBJECT_KEY>"
```

파일이 많아지면 R2는 수동 다운로드보다 일괄 다운로드가 적합하다. 현재는 `scripts/backup-r2.mjs`가 `r2/object-keys.json`을 기준으로 `autone-groupware-files` 객체를 내려받는다. 버킷 전체 동기화가 필요해지면 별도 R2 API 토큰과 S3 호환 도구를 추가한다.

## 설정 백업

운영 리소스 연결 정보를 함께 보관한다.

```bash
cp wrangler.toml "$BACKUP_DIR/meta/wrangler.toml"
cp wrangler.example.toml "$BACKUP_DIR/meta/wrangler.example.toml"
```

`wrangler.toml`에는 실제 리소스 ID가 들어 있으므로 백업 폴더 권한을 제한한다.

## 백업 검증

백업 생성 후 최소 복구 파일이 모두 있는지 확인한다.

```bash
node scripts/verify-backup.mjs "$BACKUP_DIR"
```

검증 대상은 D1 SQL, D1 메타정보, KV 키 목록, R2 객체 키 메타데이터, `wrangler.toml`, `meta/backup-manifest.json`이다.

## 복구 순서

복구는 항상 새 리소스 또는 테스트 환경에서 먼저 검증한다.

1. Worker 배포를 잠시 멈추거나, 사용자가 쓰지 않는 시간에 작업한다.
2. 새 D1/KV/R2 리소스를 만들거나 기존 리소스의 현재 상태를 추가 백업한다.
3. D1 SQL을 복원한다.
4. KV 데이터를 복원한다.
5. R2 객체를 복원한다.
6. `wrangler.toml`의 리소스 ID와 버킷 이름을 확인한다.
7. Worker를 배포한다.
8. 로그인, 메일, 전자결재, 채팅, 클라우드 다운로드를 순서대로 확인한다.

## D1 복구

새 D1에 복구하는 예시:

```bash
npx wrangler d1 execute autone-groupware-db \
  --remote \
  --file "$BACKUP_DIR/d1/groupware-db.sql"
```

기존 운영 D1에 바로 덮어쓰는 것은 위험하다. 기존 DB에 적용해야 한다면, 반드시 현재 DB를 먼저 `d1 export`로 한 번 더 백업한다.

## KV 복구

단일 키 복구 예시:

```bash
npx wrangler kv key put "board:news" \
  --binding MAIL_KV \
  --remote \
  --path "$BACKUP_DIR/kv/board-news.json"
```

여러 키 복구는 `wrangler kv bulk put`을 사용할 수 있다. 입력 파일은 key/value 쌍을 포함해야 하므로, 백업 자동화 스크립트에서 bulk put 형식으로 저장하는 방식을 권장한다.

## R2 복구

개별 객체 업로드 예시:

```bash
npx wrangler r2 object put "autone-groupware-files/<OBJECT_KEY>" \
  --remote \
  --file "$BACKUP_DIR/r2/<OBJECT_KEY>"
```

D1의 `cloud_files.object_key`와 R2 객체 키가 맞아야 클라우드 다운로드가 정상 동작한다.

## 백업 주기

권장 주기:

- 매일 1회: D1, KV
- 매주 1회: R2 전체
- 배포 전: D1, KV 즉시 백업
- 직원/부서 대량 수정 전: D1 즉시 백업

## 복구 확인 체크리스트

복구 후 아래를 확인한다.

- 로그인 가능
- 직원 목록/부서 목록 정상
- 출퇴근/휴가 현황 정상
- 메일 목록/읽기/발송 정상
- 전자결재 문서 목록/상세 정상
- 일정 표시 정상
- 게시판 글 정상
- 채팅방 목록/메시지 정상
- 클라우드 파일 다운로드 정상

## 자동화 스크립트

현재 준비된 운영 스크립트는 아래와 같다.

- `scripts/start-local.sh`: 정적 파일 로컬 서버 실행
- `scripts/deploy-worker.sh`: Worker dry-run 후 배포
- `scripts/release.sh`: preflight, 선택 백업, 선택 배포, 선택 smoke test 실행
- `scripts/export-d1-schema.sh`: D1 스키마만 `schema/groupware-schema.sql`로 저장
- `scripts/apply-d1-schema.sh`: 확인 플래그가 있을 때 D1 스키마 적용
- `scripts/backup-data.sh`: D1 export, KV key list, R2 객체 키 목록, 설정 파일 복사
- `scripts/verify-backup.mjs`: 백업 세트 최소 복구 파일 검증
- `scripts/backup-kv.mjs`: KV 모든 키를 value 포함 JSON으로 저장
- `scripts/backup-r2.mjs`: D1의 `cloud_files.object_key` 기준으로 R2 객체 다운로드
- `scripts/restore-kv.mjs`: KV JSON 백업을 bulk put 형식으로 복원

D1 스키마 적용 전에는 `scripts/backup-data.sh`로 현재 운영 데이터를 먼저 백업한다.

## 참고 문서

- Cloudflare D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Cloudflare KV Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/kv/
- Cloudflare R2 Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/r2/
