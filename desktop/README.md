# 오토원워크 데스크톱 앱

이 폴더는 오토원워크를 macOS와 Windows에서 각각 별도 앱처럼 실행하게 하는 Electron 래퍼의 시작점이다.

## 목적

- System Settings > Notifications 에서 앱이 `Chrome`이 아니라 독립 앱으로 보이게 하기
- 브라우저 탭이 아니라 `오토원워크` 앱 아이콘과 이름으로 실행되게 하기
- 기존 웹 화면과 Worker API를 그대로 재사용하기
- Windows에서는 웹앱을 감싼 독립 실행 프로그램으로 배포하기

## 현재 방식

- 앱 실행 시 로컬 정적 서버를 띄운다.
- 그 서버가 이 저장소의 정적 파일을 그대로 서빙한다.
- 화면은 `/index.html`을 연다.
- API는 기존 Worker 주소를 계속 사용한다.

## 실행

```bash
cd desktop
npm install
npm start
```

## 패키징

macOS용 디렉터리 패키지:

```bash
cd desktop
npm run pack
```

Windows용 디렉터리 패키지:

```bash
cd desktop
npm run pack:win
```

## 주의

- 이건 아직 스캐폴딩이다.
- 실제 배포용 패키지는 추가로 서명/배포 절차가 필요할 수 있다.
- Windows 쪽은 우선 `win32` 디렉터리 패키지로 만든 다음, 필요하면 설치 관리자나 ZIP 배포를 붙이면 된다.
