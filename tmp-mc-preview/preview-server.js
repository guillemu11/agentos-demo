/**
 * Email Preview Server
 * Generates all variants from an MC email asset and serves a preview UI
 * with arrow navigation between variants, similar to Marketing Cloud.
 *
 * Usage: node tmp-mc-preview/preview-server.js <assetId> [--port=3333] [--lang=en]
 */
import dotenv from 'dotenv';
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCampaignEmails, resolveEmailTemplate, cleanTemplateShell } from '../packages/core/email-builder/index.js';
import { analyzeTemplate } from '../packages/core/email-builder/analyzer.js';
import { fetchCampaignData } from '../packages/core/email-builder/fetcher.js';
import { generatePreviewVariants } from '../packages/core/email-builder/renderer.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── MC Client ─────────────────────────────────────────────────────────────────
function createMC() {
  let _token = null;
  async function auth() {
    if (_token && Date.now() < _token.expiresAt) return _token;
    const authUrl = process.env.MC_AUTH_URL.replace(/\/+$/, '');
    const resp = await fetch(`${authUrl}/v2/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: process.env.MC_CLIENT_ID, client_secret: process.env.MC_CLIENT_SECRET }),
    });
    if (!resp.ok) throw new Error(`MC auth failed: ${resp.status}`);
    const data = await resp.json();
    _token = {
      accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      restUrl: (data.rest_instance_url || process.env.MC_REST_URL).replace(/\/+$/, ''),
      soapUrl: (data.soap_instance_url || '').replace(/\/+$/, ''),
    };
    return _token;
  }
  return {
    async rest(method, reqPath, body) {
      const t = await auth();
      const url = `${t.restUrl}${reqPath.startsWith('/') ? '' : '/'}${reqPath}`;
      const opts = { method, headers: { Authorization: `Bearer ${t.accessToken}`, 'Content-Type': 'application/json' } };
      if (body && method !== 'GET') opts.body = JSON.stringify(body);
      const resp = await fetch(url, opts);
      if (resp.status === 401) { _token = null; return this.rest(method, reqPath, body); }
      const text = await resp.text();
      let result; try { result = JSON.parse(text); } catch { result = text; }
      if (!resp.ok) throw new Error(`MC REST ${resp.status}: ${typeof result === 'object' ? JSON.stringify(result).substring(0, 200) : text.substring(0, 200)}`);
      return result;
    },
    async soap(action, innerXml) {
      const t = await auth();
      const envelope = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">${action}</a:Action><a:To s:mustUnderstand="1">${t.soapUrl}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${t.accessToken}</fueloauth></s:Header><s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${innerXml}</s:Body></s:Envelope>`;
      const resp = await fetch(`${t.soapUrl}/Service.asmx`, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': action }, body: envelope });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`MC SOAP ${resp.status}`);
      return text;
    },
  };
}

// ─── Preview HTML ──────────────────────────────────────────────────────────────
function buildPreviewHTML(emailName, previews) {
  const metaJson = JSON.stringify(previews.map(p => p.meta));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Preview: ${emailName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }

    .topbar { background: #16213e; border-bottom: 1px solid #0f3460; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .topbar h1 { font-size: 14px; font-weight: 500; color: #a0a0a0; }
    .topbar h1 span { color: #fff; font-weight: 600; }
    .topbar .subject { font-size: 13px; color: #e94560; margin-left: 16px; }

    .main { display: flex; flex: 1; overflow: hidden; }

    .sidebar { width: 280px; background: #16213e; border-right: 1px solid #0f3460; overflow-y: auto; flex-shrink: 0; }
    .sidebar h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; padding: 16px 16px 8px; }
    .variant-item { padding: 10px 16px; cursor: pointer; border-left: 3px solid transparent; transition: all 0.15s; font-size: 13px; }
    .variant-item:hover { background: #1a1a3e; }
    .variant-item.active { background: #0f3460; border-left-color: #e94560; }
    .variant-item .name { font-weight: 500; color: #fff; margin-bottom: 2px; }
    .variant-item .detail { font-size: 11px; color: #888; }
    .variant-item .subscriber { font-size: 11px; color: #e94560; margin-top: 2px; }

    .preview-area { flex: 1; display: flex; flex-direction: column; }

    .preview-toolbar { background: #16213e; border-bottom: 1px solid #0f3460; padding: 8px 24px; display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
    .nav-btn { background: #0f3460; border: 1px solid #1a3a6e; color: #fff; width: 36px; height: 36px; border-radius: 6px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .nav-btn:hover { background: #e94560; border-color: #e94560; }
    .nav-btn:disabled { opacity: 0.3; cursor: default; }
    .nav-btn:disabled:hover { background: #0f3460; border-color: #1a3a6e; }
    .counter { font-size: 13px; color: #a0a0a0; min-width: 80px; text-align: center; }
    .counter strong { color: #fff; }
    .meta-info { font-size: 12px; color: #888; margin-left: auto; }
    .meta-info span { color: #a0a0a0; margin-left: 12px; }

    .iframe-wrapper { flex: 1; background: #ccc; display: flex; justify-content: center; padding: 20px; overflow: auto; }
    iframe { width: 842px; max-width: 100%; height: 100%; border: none; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,0.3); }

    @media (max-width: 900px) {
      .sidebar { display: none; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Email Preview — <span id="emailName">${emailName}</span></h1>
    <div class="subject" id="subjectLine"></div>
  </div>

  <div class="main">
    <div class="sidebar">
      <h2>Variants (${previews.length})</h2>
      <div id="variantList"></div>
    </div>

    <div class="preview-area">
      <div class="preview-toolbar">
        <button class="nav-btn" id="prevBtn" onclick="navigate(-1)">&#8249;</button>
        <div class="counter"><strong id="currentIdx">1</strong> / <span id="totalCount">${previews.length}</span></div>
        <button class="nav-btn" id="nextBtn" onclick="navigate(1)">&#8250;</button>
        <div class="meta-info">
          <span id="metaLang"></span>
          <span id="metaCountry"></span>
          <span id="metaSize"></span>
        </div>
      </div>
      <div class="iframe-wrapper">
        <iframe id="previewFrame"></iframe>
      </div>
    </div>
  </div>

  <script>
    const meta = ${metaJson};
    let current = 0;

    function renderVariant(idx) {
      current = idx;
      const frame = document.getElementById('previewFrame');
      frame.srcdoc = '';
      fetch('/variant/' + idx).then(r => r.text()).then(html => {
        frame.srcdoc = html;
      });

      // Update UI
      document.getElementById('currentIdx').textContent = idx + 1;
      document.getElementById('prevBtn').disabled = idx === 0;
      document.getElementById('nextBtn').disabled = idx === meta.length - 1;

      const m = meta[idx];
      document.getElementById('subjectLine').textContent = m.subject || '';
      document.getElementById('metaLang').textContent = 'Lang: ' + (m.language || '-');
      document.getElementById('metaCountry').textContent = 'Country: ' + (m.subscriber?.country || '-');
      document.getElementById('metaSize').textContent = m.sizeKb + ' KB';

      // Highlight sidebar
      document.querySelectorAll('.variant-item').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
      });
    }

    function navigate(dir) {
      const next = current + dir;
      if (next >= 0 && next < meta.length) renderVariant(next);
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    });

    // Build sidebar
    const list = document.getElementById('variantList');
    meta.forEach((m, i) => {
      const div = document.createElement('div');
      div.className = 'variant-item';
      div.onclick = () => renderVariant(i);
      const parts = [];
      if (m.segment) parts.push(m.segment);
      if (m.headerType) parts.push(m.headerType);
      div.innerHTML =
        '<div class="name">' + (parts.join(' / ') || 'Default') + '</div>' +
        '<div class="detail">' + (m.language || '') + ' (' + (m.subscriber?.culture || '') + ')</div>' +
        '<div class="subscriber">' + (m.subscriber?.name || '') + ' — ' + (m.subscriber?.country || '') + '</div>';
      list.appendChild(div);
    });

    // Load first variant
    renderVariant(0);
  </script>
</body>
</html>`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const assetId = args.find(a => /^\d+$/.test(a));
  const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3333');
  const lang = args.find(a => a.startsWith('--lang='))?.split('=')[1] || 'en';

  if (!assetId) {
    console.error('Usage: node preview-server.js <assetId> [--port=3333] [--lang=en]');
    process.exit(1);
  }

  console.log(`\nEmail Preview Server`);
  console.log(`Asset ID: ${assetId}`);
  console.log(`Language: ${lang}`);
  console.log(`Port: ${port}\n`);

  const mc = createMC();

  // Phase 0: Resolve template
  console.log('Resolving email template...');
  const { templateHtml, emailName } = await resolveEmailTemplate(mc, assetId, {
    onProgress: (_, d) => console.log(`  ${d}`),
  });
  console.log(`Template: ${emailName} (${(templateHtml.length / 1024).toFixed(1)}KB)\n`);

  // Phase 1: Analyze
  console.log('Analyzing...');
  const manifest = analyzeTemplate(templateHtml);
  console.log(`  Blocks: ${manifest.contentBlockIds.length}, DEs: ${manifest.dataExtensions.length}, Segments: ${manifest.variants.segments.length}\n`);

  // Phase 2: Fetch
  console.log('Fetching MC data...');
  const data = await fetchCampaignData(manifest, mc, {
    language: lang,
    onProgress: (_, d) => console.log(`  ${d}`),
  });
  console.log();

  // Load template shell
  let templateShell = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>{{CONTENT}}</body></html>';
  const shellPath = path.join(__dirname, '..', 'email_blocks', 'template_style.html');
  if (existsSync(shellPath)) {
    const shell = cleanTemplateShell(readFileSync(shellPath, 'utf8'));
    const slotMarker = '<div data-type="slot" data-key="2v65jtcb5dc" data-label="Drop blocks or content here"></div>';
    if (shell.includes(slotMarker)) {
      templateShell = shell.replace(slotMarker, '{{CONTENT}}');
    }
  }

  // Phase 3: Generate all preview variants
  console.log('Generating preview variants...');
  const previews = generatePreviewVariants({
    manifest, data, templateShell,
    options: { market: 'uk/english', language: lang },
  });
  console.log(`Generated ${previews.length} variant(s)\n`);

  previews.forEach((p, i) => {
    const sub = p.meta.subscriber;
    console.log(`  ${i + 1}. ${p.filename} — ${sub.name} (${sub.culture}, ${sub.country}) [${p.meta.sizeKb}KB]`);
  });

  // ─── Serve ──────────────────────────────────────────────────────────────────
  const previewHTML = buildPreviewHTML(emailName, previews);

  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(previewHTML);
    } else if (req.url?.startsWith('/variant/')) {
      const idx = parseInt(req.url.split('/')[2]);
      if (idx >= 0 && idx < previews.length) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(previews[idx].html);
      } else {
        res.writeHead(404);
        res.end('Variant not found');
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(`\n  Preview: http://localhost:${port}\n`);
  });
}

main().catch(e => { console.error('Fatal:', e.message); console.error(e.stack); process.exit(1); });
