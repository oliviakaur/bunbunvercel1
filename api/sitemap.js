/**
 * Vercel Serverless Function: /api/sitemap.js (Routed from GET /sitemap.xml via vercel.json)
 *
 * Behavior:
 *   1. Detects the receiving Vercel subdomain / custom domain origin from request headers
 *      (`x-forwarded-proto` + `x-forwarded-host` or `host`).
 *   2. Fetches the XML sitemap from the backend endpoint (`https://bunbunserver.my.id/sitemap.xml`).
 *   3. Rewrites all `<loc>` URL origins in the XML sitemap to match the receiving Vercel
 *      subdomain address while keeping the response strictly in Sitemap 0.9 XML (`application/xml`).
 */

const BACKEND_API_BASE = (
  process.env.BUNBUN_API_BASE || 'https://bunbunserver.my.id'
).replace(/\/+$/, '');

/**
 * Resolves the public origin (protocol + host) of the Vercel deployment receiving the request
 * (e.g., "https://my-app.vercel.app" or "https://sub.customdomain.com").
 */
function resolveRequestOrigin(req) {
  const headers = (req && req.headers) || {};

  const rawProto =
    headers['x-forwarded-proto'] ||
    headers['x-vercel-forwarded-for-proto'] ||
    'https';
  const proto = String(rawProto).split(',')[0].trim().toLowerCase() || 'https';

  const rawHost =
    headers['x-forwarded-host'] ||
    headers['host'] ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    'localhost:3000';
  const host = String(rawHost).split(',')[0].trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  return `${proto}://${host}`;
}

/**
 * Rewrites every <loc>...</loc> URL origin from the backend XML sitemap to `vercelOrigin`.
 * Preserves all query strings (?category=<cat>&amp;slug=<slug>), paths, and XML structure.
 */
function rewriteSitemapXmlOrigins(rawXml, vercelOrigin, backendOrigin) {
  const cleanVercelOrigin = String(vercelOrigin || '').replace(/\/+$/, '');
  const cleanBackendOrigin = String(backendOrigin || '').replace(/\/+$/, '');

  // 1. Rewrite any origin inside <loc>https://any-domain.tld/...</loc> to the receiving Vercel origin
  let rewritten = String(rawXml || '').replace(
    /(<loc>\s*)https?:\/\/[^\/<\s]+/gi,
    `$1${cleanVercelOrigin}`
  );

  // 2. Also replace any direct references to the backend origin if present outside <loc>
  if (cleanBackendOrigin) {
    rewritten = rewritten.split(cleanBackendOrigin).join(cleanVercelOrigin);
  }

  return rewritten;
}

export default async function handler(req, res) {
  const vercelOrigin = resolveRequestOrigin(req);

  // Forward optional ?db= / ?category= and ?limit= query parameters to the backend XML endpoint
  const query = (req && req.query) || {};
  const dbParam = String(query.db || query.category || 'all').trim();
  const limitParam = String(query.limit || '500').trim();

  const backendUrl = new URL(`${BACKEND_API_BASE}/sitemap.xml`);
  backendUrl.searchParams.set('domain', 'bunbunserver.my.id');
  backendUrl.searchParams.set('db', dbParam);
  backendUrl.searchParams.set('limit', limitParam);

  try {
    let upstreamRes = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/xml, text/xml;q=0.9, */*;q=0.8',
        'User-Agent': 'BunBun-Vercel-Sitemap-Proxy/1.0',
      },
    });

    // If domain=bunbunserver.my.id is not matched, fall back to domain=all
    if (!upstreamRes.ok && upstreamRes.status === 403) {
      backendUrl.searchParams.set('domain', 'all');
      upstreamRes = await fetch(backendUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/xml, text/xml;q=0.9, */*;q=0.8',
          'User-Agent': 'BunBun-Vercel-Sitemap-Proxy/1.0',
        },
      });
    }

    const rawXml = await upstreamRes.text();
    const adjustedXml = rewriteSitemapXmlOrigins(
      rawXml,
      vercelOrigin,
      BACKEND_API_BASE
    );

    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=86400'
    );
    res.setHeader('X-Sitemap-Vercel-Origin', vercelOrigin);
    res.status(upstreamRes.status || 200).send(adjustedXml);
  } catch (err) {
    const fallbackXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '  <url>',
      `    <loc>${vercelOrigin}/</loc>`,
      '  </url>',
      '</urlset>',
    ].join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.status(200).send(fallbackXml);
  }
}
