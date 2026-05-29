import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("groupwareDesktop", {
  appName: "오토원워크",
  isDesktopApp: true,
  showNotification(payload) {
    return ipcRenderer.invoke("groupware:show-notification", payload);
  },
  requestNotificationPermission() {
    return ipcRenderer.invoke("groupware:request-notification-permission");
  },
  printMailHtml(html) {
    return ipcRenderer.invoke("groupware:print-mail-html", { html: String(html || "") });
  },
  downloadFile(payload) {
    return ipcRenderer.invoke("groupware:download-file", payload || {});
  },
  onNotificationOpen(handler) {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("groupware:notification-open", listener);
    return () => {
      ipcRenderer.removeListener("groupware:notification-open", listener);
    };
  }
});
