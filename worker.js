/**
 * Cloudflare Worker：维格云 API 代理
 *
 * 作用：把 API Token 从浏览器移到服务端，前端不再接触密钥。
 *
 * 前端请求：  /api/vika/datasheets/xxx/records?viewId=yyy
 * Worker 转发：https://vika.cn/fusion/v1/datasheets/xxx/records?viewId=yyy
 *              并注入 Authorization: Bearer <env.VIKA_API_TOKEN>
 */

const UPSTREAM = 'https://vika.cn/fusion/v1';
const PREFIX = '/api/vika';
const ALLOWED_METHODS = ['GET', 'POST', 'PATCH'];
const MAX_BODY_BYTES = 1024 * 1024; // 1MB

// 允许转发的路径白名单：仅 /datasheets/{id}/records
const ALLOWED_PATH = /^\/datasheets\/[A-Za-z0-9]+\/records(\?.*)?$/;

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 非 API 请求 → 交给静态资源
    if (!url.pathname.startsWith(PREFIX)) {
      return env.ASSETS.fetch(request);
    }

    // 2. 方法白名单
    if (!ALLOWED_METHODS.includes(request.method)) {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    // 3. 取出相对路径
    const relPath = url.pathname.slice(PREFIX.length) || '/';

    // 4. 路径白名单校验
    if (!ALLOWED_PATH.test(relPath + (url.search || ''))) {
      return jsonResponse({ error: 'Forbidden path' }, 403);
    }

    // 5. 读取服务端 Token
    const token = env.VIKA_API_TOKEN;
    if (!token) {
      return jsonResponse({ error: 'Server misconfigured: VIKA_API_TOKEN missing' }, 500);
    }

    // 6. 构造上游请求（客户端传来的 Authorization 一律丢弃）
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');

    const accept = request.headers.get('Accept');
    if (accept) {
      headers.set('Accept', accept);
    }

    const init = {
      method: request.method,
      headers: headers,
    };

    // 7. 有请求体时透传，并限制大小
    if (request.method === 'POST' || request.method === 'PATCH') {
      const bodyBuffer = await request.arrayBuffer();
      if (bodyBuffer.byteLength > MAX_BODY_BYTES) {
        return jsonResponse({ error: 'Payload too large' }, 413);
      }
      init.body = bodyBuffer;
    }

    // 8. 转发
    let upstreamResponse;
    try {
      upstreamResponse = await fetch(UPSTREAM + relPath + (url.search || ''), init);
    } catch (err) {
      return jsonResponse({ error: 'Upstream unreachable', detail: String(err) }, 502);
    }

    // 9. 回传响应
    const respHeaders = new Headers();
    respHeaders.set(
      'Content-Type',
      upstreamResponse.headers.get('Content-Type') || 'application/json; charset=utf-8'
    );
    respHeaders.set('Cache-Control', 'no-store');
    respHeaders.set('X-Proxy', 'vika');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: respHeaders,
    });
  },
};
