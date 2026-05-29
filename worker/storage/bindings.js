export function requireKv(env) {
  if (!env || !env.MAIL_KV) throw new Error("MAIL_KV binding is missing");
}

export function requireGroupwareDb(env) {
  if (!env || !env.GROUPWARE_DB) throw new Error("GROUPWARE_DB binding is missing");
}

export function requireCloudStorage(env) {
  if (!env || !env.GROUPWARE_FILES) throw new Error("GROUPWARE_FILES binding is missing");
}
