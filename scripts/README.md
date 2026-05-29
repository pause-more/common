# 운영 스크립트

프로젝트 루트에서 실행한다. Cloudflare 원격 리소스를 다루는 스크립트는 `wrangler login`이 되어 있어야 한다.

## 로컬 실행

```bash
scripts/start-local.sh
```

기본 주소는 `http://127.0.0.1:8000`이다. 포트 변경:

```bash
PORT=8080 scripts/start-local.sh
```

## Worker 배포

```bash
scripts/deploy-worker.sh
```

먼저 `wrangler deploy --dry-run`을 실행한 뒤 실제 배포한다.

## 릴리즈 흐름 실행

```bash
scripts/release.sh
```

기본 실행은 배포 전 자동 점검만 수행하고, 원격 백업/배포/스모크 테스트는 건너뛴다.

백업까지 포함:

```bash
RELEASE_BACKUP=1 scripts/release.sh
```

Worker 배포까지 포함:

```bash
RELEASE_BACKUP=1 RELEASE_DEPLOY=1 CONFIRM_DEPLOY=YES scripts/release.sh
```

배포 후 스모크 테스트까지 포함:

```bash
RELEASE_BACKUP=1 RELEASE_DEPLOY=1 CONFIRM_DEPLOY=YES RELEASE_SMOKE=1 scripts/release.sh
```

KV 값 전체와 R2 파일까지 백업하려면 `RELEASE_BACKUP_KV=1`, `RELEASE_BACKUP_R2=1`을 추가한다.

## 배포 전 자동 점검

```bash
node scripts/preflight-check.mjs
```

PWA manifest, 서비스워커 캐시, HTML 앱 이름 메타, Wrangler 바인딩, JS/쉘 문법을 확인한다.

## Worker API 라우트 문서 생성

```bash
node scripts/generate-api-routes.mjs
```

`worker.js`의 라우팅 조건을 읽어 `docs/GROUPWARE_API_ROUTES.md`를 생성한다.
`worker/routes/*.js`로 분리된 라우트 파일도 함께 읽는다.

문서가 최신인지 확인:

```bash
node scripts/generate-api-routes.mjs --check
```

## 배포 후 스모크 테스트

```bash
node scripts/smoke-test.mjs
```

기본 프론트 주소는 `http://127.0.0.1:8000`이고, API 주소는 `layout/config.js`의 기본 Worker 주소를 읽는다.

```bash
FRONTEND_ORIGIN=https://example.com API_ORIGIN=https://example.workers.dev node scripts/smoke-test.mjs
```

주요 HTML, manifest, service worker, Worker health 응답을 빠르게 확인한다.

로컬 프론트만 확인할 때:

```bash
SMOKE_SKIP_API=1 node scripts/smoke-test.mjs
```

## D1 스키마 관리

```bash
scripts/export-d1-schema.sh
```

원격 D1에서 데이터 없이 스키마만 `schema/groupware-schema.sql`로 저장한다.

```bash
CONFIRM_APPLY=YES scripts/apply-d1-schema.sh
```

스키마 파일을 원격 D1에 적용한다. 기존 운영 DB에 실행하기 전에는 반드시 백업을 먼저 만든다.

## 기본 백업

```bash
scripts/backup-data.sh
```

기본 백업 위치는 `~/Desktop/groupware-backups/YYYYMMDD-HHMMSS`다.
운영 D1/KV/R2 메타데이터를 읽으므로 사용자가 적은 시간에 실행하는 것을 권장한다.

생성 항목:

- D1 SQL export
- D1 info JSON
- KV key list
- R2 object key metadata
- `wrangler.toml` 사본

## KV 전체 백업

```bash
node scripts/backup-kv.mjs "$HOME/Desktop/groupware-backups/YYYYMMDD-HHMMSS"
```

`kv/values/`에 키별 값을 저장하고, `kv/bulk-put.json`도 생성한다.

## KV 복구

```bash
node scripts/restore-kv.mjs "$HOME/Desktop/groupware-backups/YYYYMMDD-HHMMSS"
```

`kv/bulk-put.json`을 `MAIL_KV`에 복구한다.

## R2 파일 백업

```bash
node scripts/backup-r2.mjs "$HOME/Desktop/groupware-backups/YYYYMMDD-HHMMSS"
```

`r2/object-keys.json`을 기준으로 `autone-groupware-files` 객체를 내려받는다.

### 백업 검증

```bash
node scripts/verify-backup.mjs "$HOME/Desktop/groupware-backups/YYYYMMDD-HHMMSS"
```

`d1/groupware-db.sql`, `kv/kv-keys.json`, `r2/object-keys.json`, `meta/backup-manifest.json` 등 최소 복구 파일이 있는지 확인한다.

## 환경 변수

- `BACKUP_ROOT`: 백업 루트 폴더
- `BACKUP_DIR`: 정확한 백업 대상 폴더
- `D1_DATABASE`: D1 DB 이름, 기본 `autone-groupware-db`
- `SCHEMA_FILE`: D1 스키마 파일, 기본 `schema/groupware-schema.sql`
- `KV_BINDING`: KV 바인딩, 기본 `MAIL_KV`
- `R2_BUCKET`: R2 버킷, 기본 `autone-groupware-files`
- `RELEASE_BACKUP`: 릴리즈 전 기본 백업 실행, `1`이면 실행
- `RELEASE_BACKUP_KV`: KV 값 전체 백업 실행, `1`이면 실행
- `RELEASE_BACKUP_R2`: R2 파일 백업 실행, `1`이면 실행
- `RELEASE_DEPLOY`: Worker 배포 실행, `1`이면 실행
- `CONFIRM_DEPLOY`: 배포 확인 플래그, `YES`일 때만 배포
- `RELEASE_SMOKE`: 배포 후 스모크 테스트 실행, `1`이면 실행
