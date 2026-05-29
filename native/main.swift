import AppKit
import Foundation
import UserNotifications
import WebKit

private let appDisplayName = "오토원워크"
private let appBundleIdentifier = "com.autone.work.native"
private let webAppHost = "127.0.0.1"
private let webAppPort = 8765
private let webAppURL = URL(string: "http://127.0.0.1:8765/index.html?v=20260522-main-cache2")!
private let bootstrapLogURL = URL(fileURLWithPath: "/private/tmp/native-bootstrap.log")
private let savedWindowXKey = "mainWindow.x"
private let savedWindowYKey = "mainWindow.y"
private let savedWindowWidthKey = "mainWindow.width"
private let savedWindowHeightKey = "mainWindow.height"
private let minimumWindowSize = NSSize(width: 960, height: 720)

private func bootstrapLog(_ message: String) {
    let line = "\(ISO8601DateFormatter().string(from: Date())) \(message)\n"
    if !FileManager.default.fileExists(atPath: bootstrapLogURL.path) {
        FileManager.default.createFile(atPath: bootstrapLogURL.path, contents: nil)
    }
    if let handle = try? FileHandle(forWritingTo: bootstrapLogURL) {
        defer { try? handle.close() }
        try? handle.seekToEnd()
        if let data = line.data(using: .utf8) {
            try? handle.write(contentsOf: data)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, UNUserNotificationCenterDelegate {
    private let logURL = URL(fileURLWithPath: "/private/tmp/native-autonework.log")
    private var serverProcess: Process?
    private var window: NSWindow?
    private var webView: WKWebView?
    private var activePrintJobs: [PrintJob] = []
    private var pendingNotificationPermissionCallback: ((String) -> Void)?

    func applicationDidFinishLaunching(_ notification: Notification) {
        UNUserNotificationCenter.current().delegate = self
        log("applicationDidFinishLaunching")
        configureMenus()
        startLocalServerIfNeeded()
        createWindow()
        loadApp()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { [weak self] in
            self?.log("requesting initial native notification permission")
            self?.requestNotificationPermission()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        log("applicationWillTerminate")
        saveWindowFrame()
        serverProcess?.terminate()
        serverProcess = nil
    }

    private func createWindow() {
        log("createWindow")
        let configuration = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(self, name: "groupwareDesktop")
        controller.addUserScript(WKUserScript(
            source: desktopBridgeScript(),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        ))
        configuration.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        self.webView = webView

        let restoredFrame = restoredWindowFrame()
        let restoredSize = restoredFrame?.size ?? defaultWindowSize()
        let contentRect = NSRect(x: 0, y: 0, width: restoredSize.width, height: restoredSize.height)
        let styleMask: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]
        let window = NSWindow(contentRect: contentRect, styleMask: styleMask, backing: .buffered, defer: false)
        window.title = appDisplayName
        window.titleVisibility = .visible
        window.titlebarAppearsTransparent = false
        window.isReleasedWhenClosed = false
        window.minSize = minimumWindowSize
        window.delegate = self
        if let restoredFrame = restoredFrame {
            window.setFrame(restoredFrame, display: false)
        } else {
            positionDefaultWindowOnScreen(window)
        }
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }

    func windowDidResize(_ notification: Notification) {
        saveWindowFrame()
    }

    func windowDidMove(_ notification: Notification) {
        saveWindowFrame()
    }

    func windowWillClose(_ notification: Notification) {
        saveWindowFrame()
    }

    private func defaultWindowSize() -> NSSize {
        guard let screen = NSScreen.main ?? NSScreen.screens.first else {
            return NSSize(width: 1280, height: 860)
        }
        let visibleFrame = screen.visibleFrame
        let width = min(max(minimumWindowSize.width, 1280), visibleFrame.width)
        return NSSize(width: width, height: max(minimumWindowSize.height, visibleFrame.height))
    }

    private func positionDefaultWindowOnScreen(_ window: NSWindow) {
        guard let screen = NSScreen.main ?? window.screen else {
            window.center()
            return
        }
        let visibleFrame = screen.visibleFrame
        let windowFrame = window.frame
        let x = visibleFrame.origin.x + (visibleFrame.size.width - windowFrame.size.width) / 2
        let y = visibleFrame.origin.y
        window.setFrameOrigin(NSPoint(x: x, y: y))
    }

    private func restoredWindowSize() -> NSSize {
        let defaults = UserDefaults.standard
        let width = defaults.double(forKey: savedWindowWidthKey)
        let height = defaults.double(forKey: savedWindowHeightKey)
        guard width >= Double(minimumWindowSize.width), height >= Double(minimumWindowSize.height) else {
            return defaultWindowSize()
        }
        return NSSize(width: width, height: height)
    }

    private func restoredWindowFrame() -> NSRect? {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: savedWindowXKey) != nil,
              defaults.object(forKey: savedWindowYKey) != nil else {
            return nil
        }
        let x = defaults.double(forKey: savedWindowXKey)
        let y = defaults.double(forKey: savedWindowYKey)
        let width = defaults.double(forKey: savedWindowWidthKey)
        let height = defaults.double(forKey: savedWindowHeightKey)
        guard width >= Double(minimumWindowSize.width), height >= Double(minimumWindowSize.height) else {
            return nil
        }
        let frame = NSRect(x: x, y: y, width: width, height: height)
        return isWindowFrameVisible(frame) ? frame : nil
    }

    private func isWindowFrameVisible(_ frame: NSRect) -> Bool {
        return NSScreen.screens.contains { screen in
            screen.visibleFrame.intersects(frame)
        }
    }

    private func saveWindowFrame() {
        guard let window = window else { return }
        let frame = window.frame
        guard frame.size.width >= minimumWindowSize.width, frame.size.height >= minimumWindowSize.height else { return }
        let defaults = UserDefaults.standard
        defaults.set(Double(frame.origin.x), forKey: savedWindowXKey)
        defaults.set(Double(frame.origin.y), forKey: savedWindowYKey)
        defaults.set(Double(frame.size.width), forKey: savedWindowWidthKey)
        defaults.set(Double(frame.size.height), forKey: savedWindowHeightKey)
    }

    private func centerWindowOnScreen(_ window: NSWindow) {
        guard let screen = NSScreen.main ?? window.screen else {
            window.center()
            return
        }
        let screenFrame = screen.frame
        let windowFrame = window.frame
        let x = screenFrame.origin.x + (screenFrame.size.width - windowFrame.size.width) / 2
        let y = screenFrame.origin.y + (screenFrame.size.height - windowFrame.size.height) / 2
        window.setFrameOrigin(NSPoint(x: x, y: y))
    }

    private func configureMenus() {
        let editMenu = NSMenu(title: "편집")
        editMenu.addItem(NSMenuItem(title: "실행 취소", action: #selector(UndoManager.undo), keyEquivalent: "z"))
        editMenu.addItem(NSMenuItem(title: "다시 실행", action: #selector(UndoManager.redo), keyEquivalent: "Z"))
        editMenu.addItem(.separator())
        editMenu.addItem(NSMenuItem(title: "잘라내기", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
        editMenu.addItem(NSMenuItem(title: "복사", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
        editMenu.addItem(NSMenuItem(title: "붙여넣기", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
        editMenu.addItem(NSMenuItem(title: "선택 모두", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))

        let appMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        appMenu.addItem(NSMenuItem(title: "테스트 알림 보내기", action: #selector(sendTestNotificationMenuAction), keyEquivalent: ""))
        appMenu.addItem(NSMenuItem(title: "알림 권한 요청", action: #selector(requestNotificationPermissionMenuAction), keyEquivalent: ""))
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(NSMenuItem(title: "종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        appMenuItem.submenu = appMenu

        let mainMenu = NSMenu(title: appDisplayName)
        let editMenuItem = NSMenuItem()
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)
        mainMenu.addItem(appMenuItem)
        NSApp.mainMenu = mainMenu
    }

    private func loadApp() {
        log("loadApp")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            guard let self = self else { return }
            self.log("loading URL")
            var request = URLRequest(url: webAppURL)
            request.cachePolicy = .reloadIgnoringLocalCacheData
            self.webView?.load(request)
        }
    }

    private func startLocalServerIfNeeded() {
        log("startLocalServerIfNeeded")
        guard let resourceURL = Bundle.main.resourceURL?.appendingPathComponent("webapp") else {
            log("missing webapp resource")
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        process.arguments = [
            "-m",
            "http.server",
            String(webAppPort),
            "--bind",
            webAppHost,
            "--directory",
            resourceURL.path
        ]
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        process.terminationHandler = { [weak self] process in
            self?.log("local server exited: status=\(process.terminationStatus) reason=\(process.terminationReason.rawValue)")
        }

        do {
            try process.run()
            serverProcess = process
            log("local server started")
        } catch {
            serverProcess = nil
            log("local server failed: \(error.localizedDescription)")
        }
    }

    private func desktopBridgeScript() -> String {
        """
        (function () {
          if (window.groupwareDesktop && window.groupwareDesktop.isDesktopApp) return;
          function send(message) {
            try {
              window.webkit.messageHandlers.groupwareDesktop.postMessage(message);
            } catch (error) {}
          }
          window.groupwareDesktop = {
            appName: \(jsonString(appDisplayName)),
            isDesktopApp: true,
            requestNotificationPermission: function () {
              return new Promise(function (resolve) {
                window.__groupwareDesktopNotificationPermissionResolve = resolve;
                send({ type: "requestNotificationPermission" });
              });
            },
            showNotification: function (payload) {
              send({ type: "showNotification", payload: payload || {} });
              return Promise.resolve(true);
            },
            printMailHtml: function (html) {
              send({ type: "printMailHtml", html: String(html || "") });
              return Promise.resolve(true);
            },
            downloadFile: function (payload) {
              send({ type: "downloadFile", payload: payload || {} });
              return Promise.resolve(true);
            },
            debugLog: function (message) {
              send({ type: "debugLog", message: String(message || "") });
            },
            onNotificationOpen: function (callback) {
              window.__groupwareDesktopNotificationOpen = callback;
            }
          };
          window.addEventListener("error", function (event) {
            send({ type: "debugLog", message: "window error: " + (event && event.message || "") });
          });
          window.addEventListener("unhandledrejection", function (event) {
            var reason = event && event.reason;
            send({ type: "debugLog", message: "unhandled rejection: " + (reason && (reason.stack || reason.message) || reason || "") });
          });
        })();
        """
    }

    private func handleBridgeMessage(_ body: Any) {
        guard let payload = body as? [String: Any] else { return }
        let type = String(payload["type"] as? String ?? "")
        switch type {
        case "requestNotificationPermission":
            requestNotificationPermission()
        case "showNotification":
            if let notificationPayload = payload["payload"] as? [String: Any] {
                showNotification(notificationPayload)
            }
        case "printMailHtml":
            let html = normalizedString(payload["html"], defaultValue: "")
            if !html.isEmpty {
                printMailHtml(html)
            }
        case "downloadFile":
            if let downloadPayload = payload["payload"] as? [String: Any] {
                downloadFile(downloadPayload)
            }
        case "debugLog":
            log("web debug: \(normalizedString(payload["message"], defaultValue: ""))")
        default:
            break
        }
    }

    private func requestNotificationPermission() {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { [weak self] settings in
            guard let self = self else { return }
            let status = settings.authorizationStatus
            self.log("notification authorizationStatus: \(status.rawValue)")
            guard status == .notDetermined else {
                let state = (status == .authorized || status == .provisional) ? "granted" : "denied"
                DispatchQueue.main.async {
                    self.resolveNotificationPermission(state)
                }
                return
            }

            center.requestAuthorization(options: [.alert, .badge, .sound]) { [weak self] granted, error in
                guard let self = self else { return }
                if let error = error {
                    self.log("notification permission error: \(error.localizedDescription)")
                }
                self.log("notification permission result: \(granted ? "granted" : "denied")")
                let state = granted ? "granted" : "denied"
                DispatchQueue.main.async {
                    self.resolveNotificationPermission(state)
                }
            }
        }
    }

    @objc private func requestNotificationPermissionMenuAction() {
        log("requestNotificationPermissionMenuAction")
        requestNotificationPermission()
    }

    @objc private func sendTestNotificationMenuAction() {
        log("sendTestNotificationMenuAction")
        showNotification([
            "title": "\(appDisplayName) 테스트",
            "body": "네이티브 알림 경로가 정상 동작합니다.",
            "url": "/chat.html",
            "tag": "native-test",
            "notificationId": "native-test-\(UUID().uuidString)"
        ])
    }

    private func resolveNotificationPermission(_ state: String) {
        pendingNotificationPermissionCallback = nil
        let script = """
        (function () {
          var callback = window.__groupwareDesktopNotificationPermissionResolve;
          window.__groupwareDesktopNotificationPermissionResolve = null;
          if (typeof callback === "function") callback(\(jsonString(state)));
        })();
        """
        evaluateJavaScript(script)
    }

    private func showNotification(_ payload: [String: Any]) {
        let title = normalizedString(payload["title"], defaultValue: "새 알림")
        let subtitle = payload.keys.contains("subtitle") ? normalizedString(payload["subtitle"], defaultValue: "") : ""
        let body = normalizedString(payload["body"], defaultValue: "")
        let titleOnly = (payload["titleOnly"] as? Bool) == true || normalizedString(payload["titleOnly"], defaultValue: "").lowercased() == "true"
        let url = resolvedNotificationURL(payload["url"], fallback: webAppURL)
        let tag = normalizedString(payload["tag"], defaultValue: UUID().uuidString)
        let identifier = normalizedString(payload["notificationId"], defaultValue: "\(tag)-\(UUID().uuidString)")
        log("showNotification requested: \(title) / \(identifier)")

        let content = UNMutableNotificationContent()
        content.title = title
        if !subtitle.isEmpty {
            content.subtitle = subtitle
        }
        content.body = titleOnly ? "" : (body.isEmpty ? "새 알림이 도착했습니다." : body)
        content.sound = .default
        content.threadIdentifier = tag
        content.userInfo = [
            "url": url.absoluteString,
            "tag": tag
        ]

        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { [weak self] error in
            if let error = error {
                self?.log("showNotification failed: \(error.localizedDescription)")
            } else {
                self?.log("showNotification delivered: \(identifier)")
            }
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = appDisplayName
        alert.informativeText = message
        alert.addButton(withTitle: "확인")
        alert.runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = appDisplayName
        alert.informativeText = message
        alert.addButton(withTitle: "확인")
        alert.addButton(withTitle: "취소")
        let response = alert.runModal()
        completionHandler(response == .alertFirstButtonReturn)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert()
        alert.messageText = appDisplayName
        alert.informativeText = prompt
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        input.stringValue = defaultText ?? ""
        alert.accessoryView = input
        alert.addButton(withTitle: "확인")
        alert.addButton(withTitle: "취소")
        let response = alert.runModal()
        completionHandler(response == .alertFirstButtonReturn ? input.stringValue : nil)
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        log("runOpenPanelWith")
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.begin { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    private func resolvedNotificationURL(_ value: Any?, fallback: URL) -> URL {
        let raw = normalizedString(value, defaultValue: "")
        if raw.isEmpty { return fallback }
        if let absolute = URL(string: raw), absolute.scheme != nil {
            return absolute
        }
        return URL(string: raw, relativeTo: fallback)?.absoluteURL ?? fallback
    }

    private func normalizedString(_ value: Any?, defaultValue: String) -> String {
        let text = String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? defaultValue : text
    }

    private func evaluateJavaScript(_ script: String) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    private func openURLInWebView(_ urlString: String) {
        let url: URL
        if let absolute = URL(string: urlString), absolute.scheme != nil {
            url = absolute
        } else {
            url = URL(string: urlString, relativeTo: webAppURL)?.absoluteURL ?? webAppURL
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.window?.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            self.webView?.load(URLRequest(url: url))
        }
    }

    private func printMailHtml(_ html: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let printJob = PrintJob(html: html, owner: self)
            self.activePrintJobs.append(printJob)
            printJob.start()
        }
    }

    private func downloadFile(_ payload: [String: Any]) {
        let name = normalizedString(payload["name"], defaultValue: "download")
        let dataUrl = normalizedString(payload["dataUrl"], defaultValue: "")
        guard let fileData = dataFromDataURL(dataUrl) else {
            log("downloadFile failed: invalid data URL")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let panel = NSSavePanel()
            panel.nameFieldStringValue = name.isEmpty ? "download" : name
            panel.canCreateDirectories = true
            panel.begin { response in
                guard response == .OK, let url = panel.url else { return }
                do {
                    try fileData.write(to: url, options: .atomic)
                    self.log("downloadFile saved: \(url.path)")
                } catch {
                    self.log("downloadFile write failed: \(error.localizedDescription)")
                }
            }
        }
    }

    private func dataFromDataURL(_ dataUrl: String) -> Data? {
        guard let commaIndex = dataUrl.firstIndex(of: ",") else { return nil }
        let header = String(dataUrl[..<commaIndex]).lowercased()
        let payload = String(dataUrl[dataUrl.index(after: commaIndex)...])
        if header.contains(";base64") {
            return Data(base64Encoded: payload)
        }
        return payload.removingPercentEncoding?.data(using: .utf8)
    }

    func removePrintJob(_ job: PrintJob) {
        activePrintJobs.removeAll { $0 === job }
    }

    private func log(_ message: String) {
        let line = "\(ISO8601DateFormatter().string(from: Date())) \(message)\n"
        if !FileManager.default.fileExists(atPath: logURL.path) {
            FileManager.default.createFile(atPath: logURL.path, contents: nil)
        }
        if let handle = try? FileHandle(forWritingTo: logURL) {
            defer { try? handle.close() }
            try? handle.seekToEnd()
            if let data = line.data(using: .utf8) {
                try? handle.write(contentsOf: data)
            }
        }
    }

    func logMessage(_ message: String) {
        log(message)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "groupwareDesktop" else { return }
        handleBridgeMessage(message.body)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let urlString = String(describing: response.notification.request.content.userInfo["url"] ?? "")
        if let callbackURL = response.notification.request.content.userInfo["url"] as? String {
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                let script = """
                (function () {
                  var callback = window.__groupwareDesktopNotificationOpen;
                  if (typeof callback === "function") {
                    callback(\(jsonString(callbackURL)));
                  } else {
                    window.location.href = \(jsonString(callbackURL));
                  }
                })();
                """
                self.window?.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
                self.evaluateJavaScript(script)
            }
        } else if !urlString.isEmpty {
            openURLInWebView(urlString)
        }
        completionHandler()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        log("webView didFinish")
        let script = """
        (function () {
          return {
            href: String(location.href || ""),
            isLogin: String(localStorage.getItem("isLogin") || ""),
            userId: String(localStorage.getItem("userId") || ""),
            hasBridge: !!(window.groupwareDesktop && typeof window.groupwareDesktop.showNotification === "function"),
            hasNotificationLayer: !!window.NotificationLayer,
            hasChatMenuUnread: !!window.ChatMenuUnread
          };
        })();
        """
        webView.evaluateJavaScript(script) { [weak self] value, error in
            if let error = error {
                self?.log("web state failed: \(error.localizedDescription)")
                return
            }
            self?.log("web state: \(String(describing: value ?? ""))")
        }
    }
}

final class PrintJob: NSObject, WKNavigationDelegate {
    private let html: String
    private weak var owner: AppDelegate?
    private var window: NSWindow?
    private var webView: WKWebView?
    private var didStartPrinting = false
    private var readyChecksRemaining = 50

    init(html: String, owner: AppDelegate) {
        self.html = html
        self.owner = owner
    }

    func start() {
        let configuration = WKWebViewConfiguration()
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 960, height: 820), configuration: configuration)
        webView.navigationDelegate = self
        self.webView = webView

        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 960, height: 820), styleMask: [], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.orderOut(nil)
        window.contentView = webView
        self.window = window

        webView.loadHTMLString(html, baseURL: webAppURL)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !didStartPrinting else { return }
        waitForImagesThenPrint()
    }

    private func waitForImagesThenPrint() {
        guard let webView = webView else {
            finish()
            return
        }

        let script = """
        (function () {
          var images = Array.prototype.slice.call(document.images || []);
          if (!images.length) return true;
          return images.every(function (img) {
            if (!img) return true;
            if (!img.getAttribute("src")) return true;
            return img.complete && img.naturalWidth > 0;
          });
        })();
        """

        webView.evaluateJavaScript(script) { [weak self] value, error in
            guard let self = self else { return }
            if let error = error {
                self.owner?.logMessage("print readiness check failed: \(error.localizedDescription)")
                self.printNow()
                return
            }

            let ready = (value as? Bool) ?? false
            if ready {
                self.printNow()
                return
            }

            self.readyChecksRemaining -= 1
            if self.readyChecksRemaining <= 0 {
                self.owner?.logMessage("print readiness timeout")
                self.printNow()
                return
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in
                self?.waitForImagesThenPrint()
            }
        }
    }

    private func printNow() {
        guard !didStartPrinting else { return }
        didStartPrinting = true
        guard let webView = webView else {
            finish()
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            let operation = webView.printOperation(with: NSPrintInfo.shared)
            operation.showsPrintPanel = true
            operation.showsProgressPanel = true
            operation.run()
            self.finish()
        }
    }

    private func finish() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.webView?.navigationDelegate = nil
            self.window?.contentView = nil
            self.window = nil
            self.webView = nil
            if let owner = self.owner {
                owner.removePrintJob(self)
            }
        }
    }
}

private func jsonString(_ value: String) -> String {
    let data = try? JSONEncoder().encode(value)
    guard let data, let json = String(data: data, encoding: .utf8) else {
        return "\"\""
    }
    return json
}

bootstrapLog("before NSApplication.shared")

let app = NSApplication.shared
let delegate = AppDelegate()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
