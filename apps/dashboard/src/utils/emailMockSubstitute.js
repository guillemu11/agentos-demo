/**
 * emailMockSubstitute.js
 *
 * Replaces AMPscript variables (%%=v(@var)=%%, %%=TreatAsContent(@var)=%%,
 * %%=RedirectTo(@var)=%%) with Lorem Ipsum / mock images for UI preview.
 *
 * The source block.html is NEVER modified — call this only at render time
 * (iframe srcDoc). The variable names ARE the mapping keys for real content
 * population later via substituteWithReal().
 *
 * Variable → mock mapping reference:
 *   @hero_image              → full-width hero banner
 *   @story_double_image1/2   → double-column story images
 *   @story1/2/3_image        → circular (172px) in triple/circle blocks, wide otherwise
 *   @*circle*_image          → circular images
 *   @infographic_*_image     → wide 600x360
 *   @product[n]_image        → wide 600x360
 *   @offer_image             → icon
 *   @image                   → icon in info blocks, wide otherwise
 *   @header_logo             → Emirates header logo
 *   @logo_image              → Emirates footer logo
 *   @main_header             → hero headline
 *   @body_copy               → short lorem ipsum
 *   @body_cta / @cta         → "Book Now"
 *   @offer_block_header      → offer title
 *   @offer_block_cta_text    → offer CTA
 *   ... (see TEXT_MAP below for full list)
 */

// ── Image pools ───────────────────────────────────────────────────────────────
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

const LOREM_SHORT  = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
const LOREM_MEDIUM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.';

// ── Named text variable map ────────────────────────────────────────────────────
const TEXT_MAP = {
  '@main_header':               'Discover Unbeatable Deals Just for You',
  '@preheader':                 'Limited time offers tailored to your journey',
  '@hero_image_title':          'Emirates Special Offer',
  '@offer_block_header':        'Exclusive Member Offer',
  '@offer_block_cta_text':      'Book Now',
  '@offer_header':              'Special Fare: From AED 999',
  '@offer_body':                LOREM_SHORT,
  '@embedded_link_cta':         'Terms apply',
  '@sub_offer1_header':         'Economy from AED 899',
  '@sub_offer2_header':         'Business from AED 2,499',
  '@sub_offer1_body':           'Per person, return',
  '@sub_offer2_body':           'Per person, return',
  '@cta':                       'Book Now',
  '@body_cta':                  'Book Now',
  '@main_cta':                  'Explore Offers',
  '@section_title':             'Featured Destinations',
  '@header_title':              'Your Next Adventure Awaits',
  '@title':                     'Plan Your Journey',
  '@story_left_circle_header':  'Discover Dubai',
  '@story_right_circle_header': 'Explore Maldives',
  '@story_double_header1':      'Discover Dubai',
  '@story_double_header2':      'Explore Maldives',
  '@story_double_cta1':         'Learn More',
  '@story_double_cta2':         'Learn More',
  '@article_header':            'The Art of Flying First Class',
  '@article_subheader':         'Unparalleled comfort at 40,000 feet',
  '@partner_header':            'Emirates Skywards Partner',
  '@partner_subheader':         'Earn miles with every purchase',
  '@infographic_left_header':   'Check-in Online',
  '@infographic_right_header':  'Priority Boarding',
  '@skw_header':                'Your Skywards Miles Await',
  '@ebase_header':              'Book your next flight',
  '@join_skw_text':             'Join Skywards',
  '@vawp_text':                 'View all offers',
  '@contactus_text':            'Contact Us',
  '@privacy_text':              'Privacy Policy',
  '@unsub_text':                'Unsubscribe',
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
  '@body_copy':                 LOREM_SHORT,
  '@copywrite':                 '© 2025 Emirates. All rights reserved.',
  '@header_v2':                 'Exclusive Offers for You',
  '@header_v3':                 'Explore Our Latest Deals',
};

// ── Main substitution function ────────────────────────────────────────────────
/**
 * Replaces AMPscript variables with mock content for preview rendering.
 * @param {string} html - Raw block HTML containing AMPscript variables
 * @param {string} [blockName=''] - Block filename/name hint for image type detection
 * @returns {string} HTML safe for iframe display
 */
export function substituteForPreview(html, blockName = '') {
  if (!html) return html;

  const isCircleBlock = /circle|3column|3Column|triple|partner|multiIcon/i.test(blockName);
  const isInfoBlock   = /info_block|info_multi|InfoGraphic/i.test(blockName);

  // Per-call counters for image rotation across repeated variables in one block
  let hi = 0, ci = 0, wi = 0, ii = 0;
  const hero   = () => HERO_IMAGES[hi++ % HERO_IMAGES.length];
  const circle = () => CIRCULAR_IMAGES[ci++ % CIRCULAR_IMAGES.length];
  const wide   = () => WIDE_IMAGES[wi++ % WIDE_IMAGES.length];
  const icon   = () => ICON_IMAGES[ii++ % ICON_IMAGES.length];

  let r = html;

  // 1. Links → "#"
  r = r.replace(/%%=RedirectTo\(@[^)]+\)=%%/g, '#');
  r = r.replace(/%%view_email_url%%/g, '#');

  // 2. Images (most specific first to avoid partial matches)
  r = r.replace(/%%=v\(@hero_image\)=%%/g, hero);
  r = r.replace(/%%=v\(@story_double_image1\)=%%/g, DOUBLE_STORY_IMAGES[0]);
  r = r.replace(/%%=v\(@story_double_image2\)=%%/g, DOUBLE_STORY_IMAGES[1]);
  r = r.replace(/%%=v\(@header_logo\)=%%/g, LOGO_HEADER);
  r = r.replace(/%%=v\(@logo_image\)=%%/g, LOGO_FOOTER);
  r = r.replace(/%%=v\(@flight_route_arrv\)=%%/g, 'Arrival');
  r = r.replace(/%%=v\(@flight_route_dept\)=%%/g, 'Departure');
  r = r.replace(/%%=v\(@article_image\)=%%/g, ARTICLE_OFFER_IMAGE);
  r = r.replace(/%%=v\(@offer_area_main_image\)=%%/g, ARTICLE_OFFER_IMAGE);
  // offer_area_sub_image: substitute var + fix its 37px container in one pass (no blockName needed)
  r = r.replace(
    /src="%%=v\(@offer_area_sub_image\)=%%" style="width: 339px; max-width: 339px; height: ?37px;"/g,
    `src="${ICON_IMAGES[0]}" style="width: auto; height: 24px; opacity: 0.7;"`
  );
  r = r.replace(/%%=v\(@offer_area_sub_image\)=%%/g, ICON_IMAGES[0]); // fallback if style differs

  // offer_image (offers_card_double): substitute var + fix 37px container in one pass
  r = r.replace(
    /src="%%=v\(@offer_image\)=%%" style="width: 339px; max-width: 339px; height: ?37px;"/g,
    `src="${ARTICLE_OFFER_IMAGE}" style="width: 100%; max-width: 100%; height: auto; border-radius: 3px 3px 0 0;"`
  );
  r = r.replace(/%%=v\(@offer_image\)=%%/g, ARTICLE_OFFER_IMAGE); // fallback if style differs
  r = r.replace(/%%=v\(@[^)]*circle[^)]*_image\)=%%/gi, circle);
  r = r.replace(/%%=v\(@[^)]*_image[^)]*circle[^)]*\)=%%/gi, circle);
  r = r.replace(/%%=v\(@story\d+_image\)=%%/g, () => isCircleBlock ? circle() : wide());
  r = r.replace(/%%=v\(@infographic_[^)]*image\)=%%/g, wide);
  r = r.replace(/%%=v\(@product\d+_image\)=%%/g, wide);
  r = r.replace(/%%=v\(@image\)=%%/g, () => isInfoBlock ? icon() : wide());
  r = r.replace(/%%=v\(@[^)]+_image\)=%%/g, wide);

  // 3. Named text variables
  for (const [varName, value] of Object.entries(TEXT_MAP)) {
    r = r.replace(new RegExp(`%%=v\\(\\${varName}\\)=%%`, 'g'), value);
  }

  // 4. Numbered story/product headers
  r = r.replace(/%%=v\(@story(\d+)_header\)=%%/g,   (_, n) => `Destination ${n}`);
  r = r.replace(/%%=v\(@product(\d+)_header\)=%%/g, (_, n) => `Premium Offer ${n}`);

  // 5. TreatAsContent (rich text)
  r = r.replace(/%%=TreatAsContent\(@body_copy\)=%%/g,               `<p style="margin:0">${LOREM_SHORT}</p>`);
  r = r.replace(/%%=TreatAsContent\(@offer_block_body\)=%%/g,        `<p style="margin:0">${LOREM_SHORT}</p>`);
  r = r.replace(/%%=TreatAsContent\(@story_left_circle_body\)=%%/g,  `<p style="margin:0">${LOREM_MEDIUM}</p>`);
  r = r.replace(/%%=TreatAsContent\(@story_right_circle_body\)=%%/g, `<p style="margin:0">${LOREM_MEDIUM}</p>`);
  r = r.replace(/%%=TreatAsContent\(@story_left_circle_header\)=%%/g,  'Discover Dubai');
  r = r.replace(/%%=TreatAsContent\(@story_right_circle_header\)=%%/g, 'Explore Maldives');
  r = r.replace(/%%=TreatAsContent\(@story\d+_body\)=%%/g,           `<p style="margin:0">${LOREM_SHORT}</p>`);
  r = r.replace(/%%=TreatAsContent\(@offer_header\)=%%/g,            'Special Fare: From AED 999');
  r = r.replace(/%%=TreatAsContent\(@offer_body\)=%%/g,              `<p style="margin:0">${LOREM_SHORT}</p>`);
  r = r.replace(/%%=TreatAsContent\(@embedded_link_cta\)=%%/g,       'Terms apply');
  r = r.replace(/%%=TreatAsContent\(@article_body\)=%%/g,            `<p style="margin:0">${LOREM_MEDIUM}</p>`);
  r = r.replace(/%%=TreatAsContent\(@copywrite\)=%%/g,               '© 2025 Emirates. All rights reserved.');

  // Catchall TreatAsContent
  r = r.replace(/%%=TreatAsContent\(@([^)]+)\)=%%/g, (_, v) => {
    if (/header|title/i.test(v))   return 'Discover More';
    if (/body|copy|text/i.test(v)) return `<p style="margin:0">${LOREM_SHORT}</p>`;
    if (/cta|link_text/i.test(v))  return 'Learn More';
    return LOREM_SHORT;
  });

  // Catchall v() for any remaining variables
  r = r.replace(/%%=v\(@([^)]+)\)=%%/g, (_, v) => {
    if (/header|title/i.test(v))      return 'Explore Emirates';
    if (/body|copy/i.test(v))         return LOREM_SHORT;
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

/**
 * Replaces AMPscript variables with real content values.
 * Use this when populating blocks with actual campaign content.
 *
 * @param {string} html - Raw block HTML with AMPscript variables
 * @param {Object} values - Map of variable name to real value
 *   e.g. { '@hero_image': 'https://...', '@main_header': 'Summer Sale' }
 * @returns {string} HTML with real values substituted
 */
export function substituteWithReal(html, values = {}) {
  if (!html) return html;
  let r = html;
  for (const [varName, value] of Object.entries(values)) {
    const key = varName.startsWith('@') ? varName : `@${varName}`;
    r = r.replace(new RegExp(`%%=v\\(\\${key}\\)=%%`, 'g'), value ?? '');
    r = r.replace(new RegExp(`%%=TreatAsContent\\(\\${key}\\)=%%`, 'g'), value ?? '');
  }
  return r;
}
