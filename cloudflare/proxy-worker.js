/**
 * Cloudflare Worker - API Proxy
 * 
 * 功能：把 boardgamematch.com.tw/tables/* 的請求
 *       轉發到 zvetfxkm.gensparkspace.com/tables/*
 * 
 * 部署步驟：
 * 1. 登入 Cloudflare Dashboard
 * 2. 左側 Workers & Pages → Create Worker
 * 3. 貼上此程式碼 → Deploy
 * 4. 設定 Route：boardgamematch.com.tw/tables/* → 此 Worker
 */

const GENSPARK_API = 'https://zvetfxkm.gensparkspace.com';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 只處理 /tables/ 路徑
    if (!url.pathname.startsWith('/tables/')) {
      return new Response('Not Found', { status: 404 });
    }

    // OPTIONS preflight（CORS）
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // 轉發到 Genspark
    const targetUrl = GENSPARK_API + url.pathname + url.search;

    // 複製 request，轉發到 Genspark
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        // 把原始的 Cookie 也帶過去（如果 Genspark 需要驗證）
        ...(request.headers.get('Cookie') ? { 'Cookie': request.headers.get('Cookie') } : {})
      },
      body: ['GET', 'HEAD', 'DELETE'].includes(request.method) ? undefined : request.body,
    });

    try {
      const response = await fetch(proxyRequest);
      
      // 回傳時加上 CORS headers
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: '轉發失敗: ' + err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
