import express from 'express';
import cors from 'cors';

const app = express();
// Render uses process.env.PORT dynamically
const PORT = process.env.PORT || 3001;

// Allow all origins so the Firebase frontend can access it without Mixed Content/CORS issues
app.use(cors());

/**
 * Rewrites all absolute URLs inside an HLS manifest (.m3u8) to go through this proxy.
 * This is critical: when HLS.js parses the manifest and fetches segments, those
 * segment requests must also be proxied — otherwise they hit CORS/404 on alph.info.
 *
 * Also handles relative segment URLs by resolving them against the original manifest URL.
 */
function rewriteM3u8(body, originalUrl, base) {
  const origin = new URL(originalUrl);
  const originBase = `${origin.protocol}//${origin.host}`;
  const pathBase = originalUrl.substring(0, originalUrl.lastIndexOf('/') + 1);

  return body
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return line;

      let absoluteUrl;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        absoluteUrl = trimmed;
      } else if (trimmed.startsWith('/')) {
        absoluteUrl = `${originBase}${trimmed}`;
      } else {
        absoluteUrl = `${pathBase}${trimmed}`;
      }

      return `${base}/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
    })
    .join('\n');
}

app.get('/proxy/stream', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).json({ error: 'Missing ?url= parameter' });
    return;
  }

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(String(targetUrl));
  } catch {
    res.status(400).json({ error: 'Invalid URL encoding' });
    return;
  }

  console.log(`[Proxy] → ${decodedUrl.substring(0, 100)}`);

  try {
    const upstream = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive',
      },
    });

    const ct = upstream.headers.get('content-type') || '';
    const isM3u8 =
      ct.includes('mpegurl') ||
      ct.includes('x-mpegurl') ||
      decodedUrl.toLowerCase().includes('.m3u8');

    res.status(upstream.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (!upstream.body) { res.end(); return; }

    if (isM3u8) {
      // Read the manifest fully, rewrite all segment URLs, then send
      const body = await upstream.text();
      // Dynamically get the proxy server's own public URL (handles Render.com HTTPS automatically)
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const base = `${protocol}://${req.get('host')}`;
      const rewritten = rewriteM3u8(body, decodedUrl, base);
      res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
      res.send(rewritten);
    } else {
      // Binary stream (TS segments, MP4, etc.) — pipe directly
      if (ct) res.setHeader('Content-Type', ct);
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    }
  } catch (err) {
    console.error('[Proxy] Error fetching stream:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Upstream fetch failed', details: String(err) });
    }
  }
});

/**
 * M3U Playlist Proxy  —  GET /proxy/m3u?url=<encoded_m3u_url>
 *
 * Fetches the M3U playlist server-side, then rewrites every stream URL
 * inside it to pass through /proxy/stream so HLS.js segment requests
 * also benefit from this proxy.
 */
app.get('/proxy/m3u', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing ?url= parameter' });
    return;
  }

  try {
    const upstream = await fetch(decodeURIComponent(String(targetUrl)), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
      return;
    }

    const body = await upstream.text();
    const base = `http://localhost:${PORT}`;

    // Rewrite every http(s) URL line in the playlist:
    //  1. Convert Xtream .ts live stream URLs → .m3u8 (HLS manifest)
    //     so HLS.js gets a parseable manifest instead of raw MPEG-TS bytes.
    //  2. Route all URLs through this proxy to bypass CORS.
    const rewritten = body.replace(
      /^(https?:\/\/.+)$/gm,
      (match) => {
        // Normalise Xtream live stream: /user/pass/ID.ts  →  /user/pass/ID.m3u8
        const normalized = /\/[^/]+\/[^/]+\/\d+\.ts(\?.*)?$/i.test(match)
          ? match.replace(/\.ts(\?.*)?$/i, '.m3u8')
          : match;
        return `${base}/proxy/stream?url=${encodeURIComponent(normalized)}`;
      }
    );

    res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (err) {
    console.error('[Proxy M3U] Error:', err.message);
    res.status(502).json({ error: 'Failed to fetch M3U', details: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════╗
  ║  IPTV CORS Proxy  — port ${PORT}   ║
  ║  http://localhost:${PORT}            ║
  ╚═══════════════════════════════════╝
  Streams are being proxied server-side.
  Keep this terminal open while using the IPTV player.
  `);
});
