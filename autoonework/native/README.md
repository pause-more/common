# 오토원워크 네이티브 앱

이 폴더는 macOS에서 더블클릭으로 여는 `오토원워크` 네이티브 앱 빌드용이다.

## 동작 방식

- 앱이 내부에서 로컬 정적 서버를 띄운다.
- `WKWebView`가 `http://127.0.0.1:8765/index.html`을 직접 연다.
- 브라우저가 따로 뜨지 않는다.
- 알림은 macOS `UNUserNotificationCenter`로 띄운다.

## 빌드

```bash
cd native
node build.mjs
```

## 결과

- `native/dist/오토원워크.app`
- `native/dist/오토원워크-mac-local.zip`

## 참고

- 앱 번들 안의 `Resources/webapp`에 기존 웹 자산이 복사된다.
- 알림 허용은 앱이 시작될 때 macOS 시스템 권한창으로 요청한다.
