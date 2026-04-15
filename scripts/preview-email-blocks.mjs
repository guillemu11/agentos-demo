#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOCKS_DIR = join(__dirname, '../email_blocks');
const TEMPLATE_FILE = join(BLOCKS_DIR, 'template_style.html');
const SLOT_MARKER = '<div data-type="slot" data-key="2v65jtcb5dc" data-label="Drop blocks or content here"></div>';

// ── Image pools ──────────────────────────────────────────────────────────────
const HERO_IMAGES = [
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/92987f49-5691-4760-8382-00196946414d.jpg',
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/1d6167e3-f566-4d6e-b7af-a7d657149c3d.jpg',
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/a6b760b2-110a-4998-97b1-203ff8e1d49a.jpg',
];
const CIRCULAR_IMAGES = [
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/e2ac675e-9e8f-49e9-a0dd-9ce29ba9304d.png',
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/cfa539d0-40a3-4f3b-a241-2703bd376fb6.png',
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/8/ece98de8-c4e9-402d-b758-816d17ec5f50.png',
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/5b301aef-4e32-4a93-89e4-ede6bf78b778.png',
];
const WIDE_IMAGES = [
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/7ae9a836-e965-4c8c-96ac-5788c8e5426c.jpg',
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/17cdcdda-2681-4679-a061-727958b7491c.png',
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/f0c65231-2825-4834-8260-a03177a8fac3.png',
];
const ICON_IMAGES = [
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/41ca483b-cffa-4a00-81f5-d2101ca3caef.png',
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/228f651b-9c30-4b7d-b0f3-b152eb4967e3.png',
];
const DOUBLE_STORY_IMAGES = [
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/11/d00c5d05-15a6-484f-9f87-35fa7afc69ff.jpeg',
  'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/953b405d-8705-4bfb-96d1-2d9fa33efca1.jpg',
];
const LOGO_HEADER = 'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/74d7865d-7ef1-4587-8c88-3b10a1e73178.png';
const LOGO_FOOTER = 'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/1/f888b332-ab2d-4dec-9080-87dfa922621e.png';
const ARTICLE_OFFER_IMAGE = 'https://image.e.emirates.email/lib/fe5615707c610d7a7310/m/11/96b9149e-383f-4cc1-ae2c-00a9962ab7d4.jpg';

const LOREM = {
  short: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  medium: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  long: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
};

// ── Clean AMPscript conditionals from the template (pick ELSE / LTR branch) ──
function cleanTemplate(html) {
  // %%[IF ... THEN]%%valueA%%[ELSE]%%valueB%%[ENDIF]%% → valueB (English/LTR)
  let r = html.replace(/%%\[IF[^\]]*\]%%(.*?)%%\[ELSE\]%%(.*?)%%\[ENDIF\]%%/gs, (_, _a, b) => b);
  // Block-level AMPscript comments: <!-- %%[ ... ]%% -->
  r = r.replace(/<!--\s*%%\[[^\]]*\]%%\s*-->/gs, '');
  // Tracking custom tag
  r = r.replace(/<custom[^>]*\/>/g, '');
  return r;
}

// ── Substitute AMPscript variables in a block ─────────────────────────────────
function substituteBlock(html, filename) {
  const isCircleFile = /circle|3column|3Column|triple|partner|multiIcon/i.test(filename);
  const isInfoFile   = /info_block|info_multi|InfoGraphic/i.test(filename);

  let hi = 0, ci = 0, wi = 0, ii = 0;
  const hero   = () => HERO_IMAGES[hi++ % HERO_IMAGES.length];
  const circle = () => CIRCULAR_IMAGES[ci++ % CIRCULAR_IMAGES.length];
  const wide   = () => WIDE_IMAGES[wi++ % WIDE_IMAGES.length];
  const icon   = () => ICON_IMAGES[ii++ % ICON_IMAGES.length];

  let r = html;

  // Links → "#"
  r = r.replace(/%%=RedirectTo\(@[^)]+\)=%%/g, '#');
  r = r.replace(/%%view_email_url%%/g, '#');

  // Images — order matters (most specific first)
  r = r.replace(/%%=v\(@hero_image\)=%%/g, hero);
  // Double story images
  r = r.replace(/%%=v\(@story_double_image1\)=%%/g, DOUBLE_STORY_IMAGES[0]);
  r = r.replace(/%%=v\(@story_double_image2\)=%%/g, DOUBLE_STORY_IMAGES[1]);
  // Logos
  r = r.replace(/%%=v\(@header_logo\)=%%/g, LOGO_HEADER);
  r = r.replace(/%%=v\(@logo_image\)=%%/g, LOGO_FOOTER);
  r = r.replace(/%%=v\(@flight_route_arrv\)=%%/g, 'Arrival');
  r = r.replace(/%%=v\(@flight_route_dept\)=%%/g, 'Departure');
  r = r.replace(/%%=v\(@article_image\)=%%/g, ARTICLE_OFFER_IMAGE);
  r = r.replace(/%%=v\(@offer_area_main_image\)=%%/g, ARTICLE_OFFER_IMAGE);
  // offer_area_sub_image: substitute + fix style in one pass
  r = r.replace(
    /src="%%=v\(@offer_area_sub_image\)=%%" style="width: 339px; max-width: 339px; height: ?37px;"/g,
    `src="${ICON_IMAGES[0]}" style="width: auto; height: 24px; opacity: 0.7;"`
  );
  r = r.replace(/%%=v\(@offer_area_sub_image\)=%%/g, ICON_IMAGES[0]);

  // offer_image: substitute + fix style in one pass
  r = r.replace(
    /src="%%=v\(@offer_image\)=%%" style="width: 339px; max-width: 339px; height: ?37px;"/g,
    `src="${ARTICLE_OFFER_IMAGE}" style="width: 100%; max-width: 100%; height: auto; border-radius: 3px 3px 0 0;"`
  );
  r = r.replace(/%%=v\(@offer_image\)=%%/g, ARTICLE_OFFER_IMAGE);
  // Circular
  r = r.replace(/%%=v\(@[^)]*circle[^)]*_image\)=%%/gi, circle);
  r = r.replace(/%%=v\(@[^)]*_image[^)]*circle[^)]*\)=%%/gi, circle);
  r = r.replace(/%%=v\(@story\d+_image\)=%%/g, () => isCircleFile ? circle() : wide());
  // Infographic, product → wide
  r = r.replace(/%%=v\(@infographic_[^)]*image\)=%%/g, wide);
  r = r.replace(/%%=v\(@product\d+_image\)=%%/g, wide);
  // Generic @image — icon in info blocks, wide otherwise
  r = r.replace(/%%=v\(@image\)=%%/g, () => isInfoFile ? icon() : wide());
  // Any remaining *_image → wide
  r = r.replace(/%%=v\(@[^)]+_image\)=%%/g, wide);

  // Named text vars
  const TEXT_MAP = {
    '@main_header':               'Discover Unbeatable Deals Just for You',
    '@preheader':                 'Limited time offers tailored to your journey',
    '@hero_image_title':          'Emirates Special Offer',
    '@offer_block_header':        'Exclusive Member Offer',
    '@offer_block_cta_text':      'Book Now',
    '@offer_header':              'Special Fare: From AED 999',
    '@offer_body':                LOREM.short,
    '@embedded_link_cta':         'Terms & conditions apply',
    '@sub_offer1_header':         'Economy from AED 899',
    '@sub_offer2_header':         'Business from AED 2,499',
    '@sub_offer1_body':           'Per person, return',
    '@sub_offer2_body':           'Per person, return',
    '@cta':                       'Book Now',
    '@main_cta':                  'Explore Offers',
    '@section_title':             'Featured Destinations',
    '@header_title':              'Your Next Adventure Awaits',
    '@title':                     'Plan Your Journey',
    '@story_left_circle_header':  'Discover Dubai',
    '@story_right_circle_header': 'Explore Maldives',
    '@article_header':            'The Art of Flying First Class',
    '@article_subheader':         'Unparalleled comfort at 40,000 feet',
    '@partner_header':            'Emirates Skywards Partner',
    '@partner_subheader':         'Earn miles with every purchase',
    '@infographic_left_header':   'Check-in Online',
    '@infographic_right_header':  'Priority Boarding',
    '@skw_header':                'Your Skywards Miles Await',
    '@ebase_header':              'Book your next flight',
    '@origin':                    'DXB',
    '@destination':               'LHR',
    '@flight_date':               '15 May 2025',
    '@price':                     'From AED 1,299',
    '@flight_cta':                'Book this flight',
    '@origin_iata':               'DXB',
    '@destination_iata':          'COK',
    '@origin_airport_name':       'Dubai',
    '@destination_airport_name':  'Kochi',
    '@departure_day':             'Wednesday',
    '@departure_date':            '11 Mar 26',
    '@departure_time':            '02:45',
    '@arrival_day':               'Wednesday',
    '@arrival_date':              '11 Mar 26',
    '@arrival_time':              '08:05',
    '@duration':                  '3h 20m',
    '@body_copy':                 LOREM.short,
    '@body_cta':                  'Book Now',
    '@story_double_header1':      'Discover Dubai',
    '@story_double_header2':      'Explore Maldives',
    '@story_double_cta1':         'Learn More',
    '@story_double_cta2':         'Learn More',
    '@join_skw_text':             'Join Skywards',
    '@vawp_text':                 'View all offers',
    '@contactus_text':            'Contact Us',
    '@privacy_text':              'Privacy Policy',
    '@unsub_text':                'Unsubscribe',
    '@copywrite':                 '© 2025 Emirates. All rights reserved.',
    '@header_v2':                 'Exclusive Offers for You',
    '@header_v3':                 'Explore Our Latest Deals',
  };

  for (const [v, val] of Object.entries(TEXT_MAP)) {
    r = r.replace(new RegExp(`%%=v\\(\\${v}\\)=%%`, 'g'), val);
  }

  r = r.replace(/%%=v\(@story(\d+)_header\)=%%/g,   (_, n) => `Experience Destination ${n}`);
  r = r.replace(/%%=v\(@product(\d+)_header\)=%%/g, (_, n) => `Premium Destination ${n}`);

  // TreatAsContent
  r = r.replace(/%%=TreatAsContent\(@body_copy\)=%%/g,               `<p style="margin:0">${LOREM.short}</p>`);
  r = r.replace(/%%=TreatAsContent\(@offer_block_body\)=%%/g,        `<p style="margin:0">${LOREM.medium}</p>`);
  r = r.replace(/%%=TreatAsContent\(@story_left_circle_body\)=%%/g,  `<p style="margin:0">${LOREM.medium}</p>`);
  r = r.replace(/%%=TreatAsContent\(@story_right_circle_body\)=%%/g, `<p style="margin:0">${LOREM.medium}</p>`);
  r = r.replace(/%%=TreatAsContent\(@story_left_circle_header\)=%%/g, 'Discover Dubai');
  r = r.replace(/%%=TreatAsContent\(@story_right_circle_header\)=%%/g, 'Explore Maldives');
  r = r.replace(/%%=TreatAsContent\(@story\d+_body\)=%%/g,           `<p style="margin:0">${LOREM.short}</p>`);
  r = r.replace(/%%=TreatAsContent\(@offer_header\)=%%/g,            'Special Fare: From AED 999');
  r = r.replace(/%%=TreatAsContent\(@offer_body\)=%%/g,              `<p style="margin:0">${LOREM.medium}</p>`);
  r = r.replace(/%%=TreatAsContent\(@embedded_link_cta\)=%%/g,       'Terms apply');
  r = r.replace(/%%=TreatAsContent\(@article_body\)=%%/g,            `<p style="margin:0">${LOREM.medium}</p>`);
  r = r.replace(/%%=TreatAsContent\(@copywrite\)=%%/g,               '© 2025 Emirates. All rights reserved.');

  r = r.replace(/%%=TreatAsContent\(@([^)]+)\)=%%/g, (_, v) => {
    if (/header|title/i.test(v))   return 'Discover More';
    if (/body|copy|text/i.test(v)) return `<p style="margin:0">${LOREM.short}</p>`;
    if (/cta|link_text/i.test(v))  return 'Learn More';
    return LOREM.short;
  });

  r = r.replace(/%%=v\(@([^)]+)\)=%%/g, (_, v) => {
    if (/header|title/i.test(v))      return 'Explore Emirates';
    if (/body|copy/i.test(v))         return LOREM.short;
    if (/cta|btn/i.test(v))           return 'Book Now';
    if (/alias/i.test(v))             return '';
    if (/date/i.test(v))              return '15 May 2025';
    if (/price|fare|amount/i.test(v)) return 'AED 1,299';
    if (/link/i.test(v))              return '#';
    return 'Emirates';
  });

  // Wipe any remaining %% tags
  r = r.replace(/%%[^%]*%%/g, '');

  return r;
}

// ── Build standalone block HTML (template + one block injected) ───────────────
function buildBlockPage(blockHtml, filename) {
  const templateRaw = readFileSync(TEMPLATE_FILE, 'utf8');
  const template    = cleanTemplate(templateRaw);
  const processed   = substituteBlock(blockHtml, filename);
  return template.replace(SLOT_MARKER, processed);
}

// ── Index page with iframes ───────────────────────────────────────────────────
function buildIndexPage(files) {
  const iframes = files.map(f => `
  <div class="block-wrapper">
    <div class="block-label">${f}</div>
    <iframe
      src="/block/${encodeURIComponent(f)}"
      class="block-iframe"
      scrolling="no"
      frameborder="0"
      onload="autoHeight(this)"
    ></iframe>
  </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Emirates Email Blocks Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #cccccc; font-family: Arial, sans-serif; padding: 30px 20px; }
    h1 { text-align: center; color: #c60c30; font-size: 22px; margin-bottom: 6px; }
    .subtitle { text-align: center; color: #555; font-size: 12px; margin-bottom: 36px; }
    .blocks-list { max-width: 860px; margin: 0 auto; }
    .block-wrapper { margin-bottom: 40px; }
    .block-label {
      background: #1a1a1a;
      color: #fff;
      padding: 5px 12px;
      font-size: 11px;
      font-family: 'Courier New', monospace;
      border-radius: 4px 4px 0 0;
      display: inline-block;
    }
    .block-iframe {
      display: block;
      width: 100%;
      border: none;
      min-height: 60px;
    }
  </style>
</head>
<body>
  <h1>✈ Emirates Email Blocks</h1>
  <p class="subtitle">${files.length} blocks &middot; mock preview &middot; localhost:4444</p>
  <div class="blocks-list">
${iframes}
  </div>
  <script>
    function autoHeight(iframe) {
      try {
        const h = iframe.contentDocument.body.scrollHeight;
        if (h > 0) iframe.style.height = h + 'px';
      } catch(e) {}
    }
  </script>
</body>
</html>`;
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const PORT = 4453;
const files = readdirSync(BLOCKS_DIR)
  .filter(f => f.endsWith('.html') && f !== 'template_style.html')
  .sort();

createServer((req, res) => {
  const url = decodeURIComponent(req.url);

  if (url.startsWith('/block/')) {
    const filename = url.slice('/block/'.length);
    if (!files.includes(filename)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const blockHtml = readFileSync(join(BLOCKS_DIR, filename), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildBlockPage(blockHtml, filename));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(buildIndexPage(files));

}).listen(PORT, () => {
  console.log(`\n✈  Emirates Blocks Preview`);
  console.log(`   → http://localhost:${PORT}\n`);
  console.log(`   ${files.length} blocks · each rendered inside template_style.html`);
  console.log(`   Ctrl+C to stop\n`);
});
