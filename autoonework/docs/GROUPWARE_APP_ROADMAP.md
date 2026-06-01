# 그룹웨어 앱화 로드맵

## 목표

현재 그룹웨어는 정적 HTML/CSS/JS 화면과 Cloudflare Worker API를 조합한 웹 기반 업무 도구다. 다음 단계의 목표는 이 구조를 유지하면서도 설치 가능한 앱처럼 쓰고, 운영/배포/데이터 관리가 가능한 제품형 그룹웨어로 발전시키는 것이다.

우선순위는 다음과 같다.

1. 일반 웹 자산과 데스크톱 래퍼 흐름을 유지하기
2. 공통 설정/API/권한 로직을 모듈화하기
3. Worker API와 데이터 저장소를 기능별로 정리하기
4. 백업, 배포, 운영 문서를 갖추기
5. 필요 시 Electron/Tauri 또는 모바일 앱으로 감싸기

## 현재 구조 요약

프론트엔드는 기능별 페이지로 구성되어 있다.

- `index.html`, `mainArea.js`: 메인 대시보드
- `chat.html`, `chat.js`, `chat.css`: 채팅
- `mail/`: 메일 목록, 읽기, 작성, 폴더
- `approval/`: 전자결재
- `calendar/`: 캘린더
- `board/`: 공지사항, 리소스센터, 클라우드, 팀 보드
- `attendance/`: 근태
- `admin/`: 구성원, 근태, 휴가 관리
- `layout/`: 공통 레이아웃, 인증, 메뉴, 알림, 조직도

백엔드는 `worker.js` 하나가 대부분의 API를 담당한다.

- Cloudflare Worker: API 라우팅
- D1 `GROUPWARE_DB`: 직원, 부서, 클라우드 파일 메타 등
- R2 `GROUPWARE_FILES`: 첨부파일/클라우드 파일
- KV `MAIL_KV`: 메일, 전자결재, 게시판, 채팅 일부 데이터
- Durable Object `CHAT_ROOMS`: 채팅 WebSocket

## 1단계: 웹앱 정리 완료

PWA 형태의 설치용 웹앱은 사용하지 않는다. 현재 화면은 일반 웹 자산과 데스크톱 래퍼 기준으로 유지한다.

주의할 점:

- 메일/채팅/결재 데이터는 실시간성이 중요하므로 API 응답을 무리하게 캐싱하지 않는다.
- HTML/CSS/JS는 브라우저 기본 캐시와 일반 배포 버전 관리만 사용한다.
- Worker API는 네트워크 우선 전략을 사용한다.

## 1.5단계: 데스크톱 앱 래핑

macOS 알림 설정에 `오토원워크`를 독립 앱으로 보이게 하려면 일반 웹앱만으로는 부족하다. 브라우저 탭이나 웹 기반 실행은 시스템이 대개 `Chrome` 또는 브라우저 기반 웹앱으로 인식하기 때문이다.

따라서 별도 데스크톱 번들을 추가한다.

권장 방향:

- 1차 선택: Electron
- 2차 선택: Tauri

현재 저장소에는 Electron 스캐폴딩을 추가해 두고, 기존 웹 화면을 그대로 감싸는 구조를 쓴다.

작업 항목:

- `desktop/` 프로젝트 생성
- 앱 이름을 `오토원워크`로 고정
- 로컬 정적 서버를 앱 내부에서 띄워서 기존 HTML/CSS/JS를 그대로 사용
- `BrowserWindow`로 `/index.html`을 열기
- macOS Dock 및 알림 설정에 앱 이름과 아이콘이 보이도록 패키징 준비
- 웹 설치 안내 UI는 데스크톱 앱에서는 숨김 처리

주의할 점:

- 이 단계는 UI를 바꾸지 않고 실행 컨테이너만 바꾸는 단계다.
- 실제로 시스템 설정 > 알림에 `오토원워크`가 독립 항목으로 뜨려면 최종적으로 `.app` 패키징이 필요하다.
- 패키징 전에는 개발용 Electron 실행으로 동작을 먼저 검증한다.

## 2단계: 공통 설정 분리

현재 여러 파일에 API 주소가 직접 들어가 있다. 운영 환경을 바꾸거나 테스트 서버를 만들 때 부담이 커지므로 공통 설정으로 분리한다.

권장 구조:

```text
config/
  appConfig.js
shared/
  apiClient.js
  authSession.js
  permissions.js
  ui.js
```

우선 분리할 대상:

- API 기본 URL
- 현재 사용자 세션 처리
- 권한 판별: 관리자, 대표, work 계정, 일반 구성원
- fetch JSON 처리
- 에러 메시지 처리
- 날짜/시간 포맷
- 파일 업로드/다운로드 유틸

이 단계가 끝나면 기능 파일들은 화면 로직에 더 집중할 수 있다.

## 3단계: Worker API 모듈화

`worker.js`가 커졌기 때문에 기능별로 나누는 것이 좋다.

현재 라우트 인벤토리는 `docs/GROUPWARE_API_ROUTES.md`에서 확인한다. 라우트 문서는 아래 명령으로 다시 만들 수 있다.

```bash
node scripts/generate-api-routes.mjs
```

현재 `worker.js`는 `fetch()`에서 CORS와 URL 생성만 처리하고, 실제 라우팅은 `routeWorkerRequest()`로 분리되어 있다. `auth`, `attendance`, `approval`, `board`, `calendar`, `chat`, `cloud`, `mail`, `notifications` 라우트는 `worker/routes/` 아래로 파일 분리되었다. 공통 응답 유틸 및 문자열 처리 유틸, 저장소 바인딩 검증, KV JSON 목록 입출력, 클라우드 파일 메타 저장소, D1 직원/부서 저장소, 레거시 KV 직원/부서 저장소, 임시 비밀번호 플래그 저장소, 메일/임시저장 본문 및 목록 저장소, 근태 기록 저장소, 결재 문서 처리 및 저장소, 공유 캘린더 일정 저장소, 게시판/자료실/팀보드 저장소/시드 저장소, 알림 목록 저장소, 채팅 방/메시지 저장소도 `worker/shared/`, `worker/storage/`로 분리되기 시작했다. D1 우선/레거시 KV fallback을 선택하는 직원 조회/응답 정규화/생성/시드 서비스, 인증 비밀번호 서비스, 첨부파일 응답 서비스, 공유 캘린더 일정 조회/저장/삭제 서비스, 휴가 결재의 공유 캘린더 일정 동기화 서비스, 채팅 연락처/방/메시지/첨부 조회, WebSocket 입장 검증, 방 생성/수정/초대/퇴장/메시지 저장/삭제/읽음 처리/응답 요약/초기 메시지 서비스, 업무 알림 생성 서비스, 메일 수신 파싱 서비스, 받은메일함 샘플 시드 서비스도 `worker/services/`로 분리되었다. 다음 작업은 기타 남은 서비스/데이터 접근 계층을 기능별로 정리하는 것이다.

권장 구조:

```text
worker/
  index.js
  routes/
    auth.js
    attendance.js
    approval.js
    chat.js
    mail.js
    board.js
    calendar.js
    cloud.js
    notifications.js
  services/
    attachments.js
    auth.js
    chatRooms.js
    employees.js
    inboundMail.js
    mailSeed.js
    files.js
    permissions.js
    notifications.js
  shared/
    http.js
    utils.js
  storage/
    approvalDocuments.js
    attendance.js
    bindings.js
    boardPosts.js
    calendarEvents.js
    chat.js
    cloudFiles.js
    employeeTempPasswords.js
    employees.js
    legacyDepartments.js
    legacyEmployees.js
    mail.js
    mailLists.js
    notifications.js
    d1.js
    kv.js
    r2.js
```

1차 목표는 동작을 바꾸지 않고 파일만 분리하는 것이다. 기능 개선은 분리 후에 진행한다.

## 4단계: 데이터 모델 정리

현재 데이터는 D1, KV, R2에 나뉘어 있다. 제품화하려면 “무엇이 정식 데이터인지”를 명확히 해야 한다.

권장 기준:

- D1: 검색/목록/권한/상태 관리가 필요한 업무 데이터
- R2: 첨부파일, 이미지, 클라우드 파일 본문
- KV: 임시 캐시, 레거시 호환, 빠른 설정값
- Durable Object: 실시간 채팅 연결 상태

우선 D1로 옮기면 좋은 데이터:

- 전자결재 문서 목록/상태
- 게시판 글 목록
- 채팅방/메시지 메타
- 알림 읽음 상태
- 메일 목록 메타

KV에 남겨도 되는 데이터:

- 임시 비밀번호 플래그
- 마이그레이션 중 레거시 백업
- 자주 읽지만 정합성이 덜 중요한 캐시

## 데이터 모델 초안

### users

- `id`
- `employee_id`
- `login_id`
- `password_hash`
- `name`
- `email`
- `department_id`
- `position`
- `role`
- `status`
- `birth_date`
- `hire_date`
- `work_hours`
- `extra_vacation_days`
- `created_at`
- `updated_at`

### departments

- `id`
- `name`
- `sort_order`
- `created_at`
- `updated_at`

### chat_rooms

- `id`
- `type`
- `title`
- `owner_id`
- `last_message`
- `last_message_at`
- `created_at`
- `updated_at`

### chat_room_members

- `room_id`
- `user_id`
- `joined_at`
- `last_read_at`
- `is_hidden`

### chat_messages

- `id`
- `room_id`
- `sender_id`
- `text`
- `reply_to_id`
- `message_type`
- `created_at`
- `deleted_at`

### files

- `id`
- `owner_id`
- `scope`
- `name`
- `type`
- `size`
- `r2_key`
- `created_at`
- `updated_at`

### approvals

- `id`
- `doc_no`
- `title`
- `author_id`
- `status`
- `body_json`
- `created_at`
- `updated_at`
- `submitted_at`
- `completed_at`

### approval_lines

- `id`
- `approval_id`
- `approver_id`
- `step_order`
- `status`
- `decided_at`
- `comment`

### board_posts

- `id`
- `board_type`
- `title`
- `content`
- `author_id`
- `visibility`
- `created_at`
- `updated_at`
- `deleted_at`

### calendar_events

- `id`
- `calendar_type`
- `title`
- `description`
- `start_at`
- `end_at`
- `owner_id`
- `department_id`
- `created_at`
- `updated_at`

### attendance_records

- `id`
- `user_id`
- `work_date`
- `check_in_at`
- `check_out_at`
- `status`
- `memo`
- `created_at`
- `updated_at`

### notifications

- `id`
- `user_id`
- `type`
- `title`
- `body`
- `target_url`
- `read_at`
- `created_at`

## 5단계: 운영/배포 정리

배포와 운영은 코드만큼 중요하다.

필요한 문서:

- 배포 전 점검 체크리스트: `docs/GROUPWARE_RELEASE_CHECKLIST.md`
- 로컬 실행 방법
- Worker 배포 방법
- D1/R2/KV 백업 방법: `docs/GROUPWARE_BACKUP_RESTORE.md`
- 직원 추가/비밀번호 초기화 방법: `docs/GROUPWARE_EMPLOYEE_OPERATIONS.md`
- 장애 시 복구 절차: `docs/GROUPWARE_INCIDENT_RECOVERY.md`

필요한 스크립트:

- 로컬 정적 서버 실행: `scripts/start-local.sh`
- Worker 배포: `scripts/deploy-worker.sh`
- 릴리즈 흐름 실행: `scripts/release.sh`
- 배포 전 자동 점검: `scripts/preflight-check.mjs`
- 배포 후 스모크 테스트: `scripts/smoke-test.mjs`
- D1 schema 내보내기/적용: `scripts/export-d1-schema.sh`, `scripts/apply-d1-schema.sh`
- D1 백업: `scripts/backup-data.sh`
- KV 전체 백업/복구: `scripts/backup-kv.mjs`, `scripts/restore-kv.mjs`
- R2 파일 백업: `scripts/backup-r2.mjs`

## 6단계: 데스크톱/모바일 앱 선택

PWA가 충분하면 그대로 운영한다. 별도 앱이 필요하면 다음 선택지가 있다.

- 데스크톱 앱: Tauri 추천
- 빠른 데스크톱 래핑: Electron
- 모바일 앱: Expo/React Native
- 가장 단순한 모바일 앱: WebView 앱

현재 상태에서는 데스크톱 래퍼 또는 일반 웹 실행 흐름이 가장 현실적이다. 용량이 작고, 현재 웹 자산을 최대한 유지할 수 있다.

## 바로 다음 작업

다음 구현 순서는 이렇게 잡는다.

1. 기본 앱 아이콘 연결 완료
2. 주요 HTML 정리 완료
3. `layout/config.js`로 API URL 공통 설정 분리 완료
4. 로컬 서버와 운영 Worker 스모크 테스트 통과
5. 실제 브라우저에서 로그인/실행 확인
6. 공통 fetch 클라이언트와 권한 유틸 분리 시작

## 공통 API 설정

API 기본 주소는 `layout/config.js`에서 관리한다.

기본 운영 주소는 Cloudflare Worker URL이며, 필요하면 브라우저 콘솔에서 아래처럼 임시 API 서버를 지정할 수 있다.

```js
GroupwareConfig.setApiOrigin("https://example-worker.example.workers.dev");
location.reload();
```

되돌릴 때는 로컬 스토리지의 `groupwareApiOrigin` 값을 지우면 된다.
