const UPSTREAM = 'https://vika.cn/fusion/v1';
const PREFIX = '/api/vika';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 非 API 请求 → 静态资源
    if (!url.pathname.startsWith(PREFIX)) {
      return env.ASSETS.fetch(request);
    }

    // 路径白名单：只允许 /datasheets/xxx/records
    const relPath = url.pathname.slice(PREFIX.length);
    if (!ALLOWED_PATH.test(relPath + url.search)) {
      return json({ error: 'Forbidden path' }, 403);
    }

    // 服务端注入 Token
    const token = env.VIKA_API_TOKEN;

    return fetch(UPSTREAM + relPath + url.search, {
      method: request.method,
      headers: { 'Authorization': `Bearer ${token}` },
      body: ...,
    });
  }
}
