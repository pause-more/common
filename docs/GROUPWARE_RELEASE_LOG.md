# 오토원워크 릴리즈 기록

## 2026-05-15 11:57 KST

### 배포

- Worker: `autone-mail-api`
- URL: `https://autone-mail-api.autone1team.workers.dev`
- Version ID: `122fd81b-d083-45e6-8899-a320e4981bf9`
- 배포 명령: `RELEASE_DEPLOY=1 CONFIRM_DEPLOY=YES RELEASE_SMOKE=1 scripts/release.sh`

### 배포 전 백업

- 백업 경로: `/Users/jinzero/Desktop/groupware-backups/20260515-114912-release`
- D1 SQL: `d1/groupware-db.sql`
- KV 키 목록: 96개
- KV 값 백업: 96개
- KV bulk 복구 파일: `kv/bulk-put.json`
- R2 객체 키: 0개
- 검증 명령: `node scripts/verify-backup.mjs /Users/jinzero/Desktop/groupware-backups/20260515-114912-release`
- 검증 결과: `0 failure(s), 0 warning(s)`

### 배포 후 확인

- `node scripts/smoke-test.mjs`: 통과
- Worker health: 통과
- 테스트 계정 `test` 로그인: 통과
- 브라우저 주요 화면 순회: 홈, 채팅, 출퇴근, 메일, 전자결재, 캘린더, 클라우드, 공지사항, 리소스센터, 팀 보드 통과
- 브라우저 콘솔 오류: 없음

### 포함된 주요 변경

- Worker 라우트/서비스 일부 분리
- PWA manifest, 아이콘, service worker 캐시 정리
- PWA 설치 버튼 로직 추가
- 오프라인 안내 화면 및 service worker fallback 추가
- 백업 검증 스크립트 추가
- 팀보드 첨부 localStorage quota 방지
- 메일 전달 시 기존 첨부파일 포함
