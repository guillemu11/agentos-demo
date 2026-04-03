const API_URL = import.meta.env.VITE_API_URL || '/api';

// The exact slot marker in template_style.html (line 962)
const SLOT_MARKER = '<div data-type="slot" data-key="2v65jtcb5dc" data-label="Drop blocks or content here"></div>';

/**
 * Injects blocksHtml into the Emirates template slot.
 * Uses String.replace() intentionally — DOMParser strips MSO conditional
 * comments (<!--[if mso]>...<![endif]-->) which break Outlook rendering.
 */
export function injectIntoSlot(templateHtml, blocksHtml) {
    if (!templateHtml) return blocksHtml;
    if (!templateHtml.includes(SLOT_MARKER)) {
        // Fallback if template structure changes
        return templateHtml.replace('</body>', `${blocksHtml}</body>`);
    }
    return templateHtml.replace(
        SLOT_MARKER,
        `<div data-type="slot" data-key="2v65jtcb5dc" data-label="Drop blocks or content here">${blocksHtml}</div>`
    );
}

/**
 * Merges AI-generated HTML into the Emirates template.
 * If the AI already produced Emirates-wrapped HTML, uses it as-is.
 * Otherwise extracts the <body> content and injects into the slot.
 */
export function mergeAiHtmlIntoTemplate(templateHtml, aiHtml) {
    if (!templateHtml || !aiHtml) return aiHtml || templateHtml;
    // Already wrapped with the Emirates template
    if (aiHtml.includes('data-key="2v65jtcb5dc"') || aiHtml.includes('Emirates-Bold')) {
        return aiHtml;
    }
    // Extract body content from AI-generated document
    const bodyMatch = aiHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : aiHtml;
    return injectIntoSlot(templateHtml, bodyContent);
}

// Module-level cache — avoids duplicate fetches across components
let _templateCache = null;

/**
 * Fetches the Emirates master template from the backend.
 * Cached after first successful fetch — subsequent calls return immediately.
 */
export function fetchEmailTemplate() {
    if (_templateCache) return _templateCache;
    _templateCache = fetch(`${API_URL}/email-template`, { credentials: 'include' })
        .then(r => r.ok ? r.text() : Promise.reject('Template not found'))
        .catch(() => { _templateCache = null; return ''; });
    return _templateCache;
}

/**
 * Splits a full Emirates email HTML into individual block objects.
 * Uses string-based parsing (not DOMParser) to preserve MSO conditional
 * comments (<!--[if mso]>...<![endif]-->) required for Outlook rendering.
 *
 * Finds the <div data-type="slot"> content, then extracts each top-level
 * <table> using depth-tracking. Injects data-block-name into each table's
 * opening tag so applyPatch() can target them later.
 *
 * @param {string} html - Full email HTML (with Emirates template wrapper)
 * @returns {{ id: string, name: string, html: string }[]}
 */
export function splitIntoBlocks(html) {
  if (!html) return [];

  // 1. Extract slot content
  const slotMarker = 'data-type="slot"';
  const slotIdx = html.indexOf(slotMarker);
  let content;
  if (slotIdx !== -1) {
    const openEnd = html.indexOf('>', slotIdx) + 1;
    const closeTag = html.indexOf('</div>', openEnd);
    content = closeTag !== -1 ? html.slice(openEnd, closeTag).trim() : '';
  } else {
    // Fallback: use body content
    const bodyStart = html.indexOf('<body');
    if (bodyStart !== -1) {
      const bodyOpen = html.indexOf('>', bodyStart) + 1;
      const bodyEnd = html.indexOf('</body>', bodyOpen);
      content = bodyEnd !== -1 ? html.slice(bodyOpen, bodyEnd).trim() : html;
    } else {
      content = html;
    }
  }

  if (!content) return [];

  // 2. Depth-tracking to find top-level <table> elements
  const blocks = [];
  let depth = 0;
  let blockStart = -1;
  let i = 0;
  const lower = content.toLowerCase();

  while (i < content.length) {
    if (lower.slice(i, i + 6) === '<table') {
      if (depth === 0) blockStart = i;
      depth++;
      i += 6;
    } else if (lower.slice(i, i + 8) === '</table>') {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        const rawHtml = content.slice(blockStart, i + 8);
        const id = `block-${Date.now()}-${blocks.length}`;
        const name = `Block ${blocks.length + 1}`;
        // Inject data-block-name into the opening <table> tag
        const tagEnd = rawHtml.indexOf('>');
        const blockHtml = rawHtml.slice(0, tagEnd) +
          ` data-block-name="${name}"` +
          rawHtml.slice(tagEnd);
        blocks.push({ id, name, html: blockHtml });
        blockStart = -1;
      }
      i += 8;
    } else {
      i++;
    }
  }

  return blocks;
}
