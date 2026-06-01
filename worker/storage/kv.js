export async function getList(env, key) {
  const raw = await env.MAIL_KV.get(key);
  return raw ? JSON.parse(raw) : [];
}

export async function setList(env, key, value) {
  await env.MAIL_KV.put(key, JSON.stringify(value));
}
