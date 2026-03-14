/**
 * 入口 Worker：boardgamematch.com.tw
 * - /tables/* → 轉發到 mbti-boardgame-api，並帶上 X-Api-Key
 * - 其他路徑 → 從 boardgamematch.pages.dev 取回畫面後回傳
 *
 * 部署：在 cloudflare 目錄下執行
 *   npx wrangler deploy -c wrangler-entry.toml
 * 首次部署前請設定 API Key：
 *   npx wrangler secret put BOARDGAME_API_KEY -c wrangler-entry.toml
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. /tables/ → 轉發到 D1 API Worker
    if (url.pathname.startsWith('/tables/')) {
      const apiUrl = new URL(
        'https://mbti-boardgame-api.emailev01.workers.dev' +
          url.pathname +
          url.search
      );
      const apiHeaders = new Headers(request.headers);
      apiHeaders.set('X-Api-Key', env.BOARDGAME_API_KEY);

      const apiRequest = new Request(apiUrl.toString(), {
        method: request.method,
        headers: apiHeaders,
        body: request.body,
        redirect: 'follow',
      });

      const resp = await fetch(apiRequest);
      return resp;
    }

    // 2. 其他路徑 → 從 Pages 取回內容
    const pagesUrl = new URL(
      'https://boardgamematch.pages.dev' + url.pathname + url.search
    );
    const pagesHeaders = new Headers(request.headers);
    pagesHeaders.set('Host', 'boardgamematch.pages.dev');

    const pagesRequest = new Request(pagesUrl.toString(), {
      method: request.method,
      headers: pagesHeaders,
      body: request.body,
      redirect: 'follow',
    });

    const pagesResp = await fetch(pagesRequest);
    return pagesResp;
  },
};
