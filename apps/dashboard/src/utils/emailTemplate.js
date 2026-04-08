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
        // Depth-tracking to find the matching </div> of the slot
        let divDepth = 1;
        let j = openEnd;
        const htmlLower = html.toLowerCase();
        while (j < html.length && divDepth > 0) {
            if (htmlLower.slice(j, j + 4) === '<div') {
                divDepth++;
                j += 4;
            } else if (htmlLower.slice(j, j + 6) === '</div>') {
                divDepth--;
                if (divDepth === 0) break;
                j += 6;
            } else {
                j++;
            }
        }
        content = divDepth === 0 ? html.slice(openEnd, j).trim() : '';
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

    // 2. Find top-level <table> elements, recursively descending into single-wrapper
    //    structures so real-world emails with a .email-container <div> or outer
    //    "stylingblock-content-wrapper" table still decompose into meaningful blocks.
    let blocks = findTopLevelTables(content);

    // Fallback: if we got zero or just one giant wrapper block, try to descend one
    // level to find the real content blocks inside it. Real-world Emirates emails
    // wrap everything in <div class="email-container"> or a single outer table —
    // our slot-based parser was built for SFMC Content Builder templates and
    // doesn't see those wrappers.
    let descendGuard = 0;
    while (blocks.length < 2 && descendGuard < 3) {
        descendGuard++;
        const inner = blocks.length === 1
            ? extractInnerHtml(blocks[0].html)
            : extractFirstContainerInner(content);
        if (!inner) break;
        const deeper = findTopLevelTables(inner);
        if (deeper.length >= 2) {
            blocks = deeper;
            break;
        }
        if (deeper.length === 1 && deeper[0].html.length < (blocks[0]?.html.length || Infinity)) {
            // We descended but still only found 1 — keep descending with the smaller wrapper
            blocks = deeper;
            continue;
        }
        break;
    }

    return blocks;
}

/**
 * Finds top-level <table> elements in a string, ignoring <table> tags that
 * appear inside HTML comments (MSO conditionals like <!--[if mso]><table>...<![endif]-->).
 * MSO-conditional tables are "phantom" tables only visible to Outlook and
 * would desync the depth counter if treated as real.
 */
function findTopLevelTables(content) {
    const blocks = [];
    let depth = 0;
    let blockStart = -1;
    let i = 0;
    const lower = content.toLowerCase();

    while (i < content.length) {
        // Skip HTML comments entirely — tables inside MSO conditionals
        // (<!--[if mso]><table>...<![endif]-->) must NOT affect depth.
        if (lower.slice(i, i + 4) === '<!--') {
            const commentEnd = content.indexOf('-->', i + 4);
            if (commentEnd === -1) { i += 4; continue; }
            i = commentEnd + 3;
            continue;
        }

        const nextChar = lower[i + 6];
        if (
            lower.slice(i, i + 6) === '<table' &&
            (nextChar === '>' || nextChar === ' ' || nextChar === '\n' ||
             nextChar === '\t' || nextChar === '\r' || nextChar === undefined)
        ) {
            if (depth === 0) blockStart = i;
            depth++;
            i += 6;
        } else if (lower.slice(i, i + 8) === '</table>') {
            depth--;
            if (depth === 0 && blockStart !== -1) {
                const rawHtml = content.slice(blockStart, i + 8);
                const id = `block-${blocks.length}`;
                const name = `Block ${blocks.length + 1}`;
                // Inject data-block-name into the opening <table> tag
                // Parse tag end safely, skipping > inside quoted attribute values
                let tagEnd = 0;
                let inQuote = false;
                let quoteChar = '';
                for (let k = 0; k < rawHtml.length; k++) {
                    const ch = rawHtml[k];
                    if (!inQuote && (ch === '"' || ch === "'")) {
                        inQuote = true;
                        quoteChar = ch;
                    } else if (inQuote && ch === quoteChar) {
                        inQuote = false;
                    } else if (!inQuote && ch === '>') {
                        tagEnd = k;
                        break;
                    }
                }
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

/**
 * Extracts the inner HTML of a single wrapper — either by opening the first
 * <table> and returning its <td> contents, or by unwrapping a top-level <div>.
 * Used by splitIntoBlocks() to descend into wrapper structures that contain
 * the real content blocks.
 */
function extractInnerHtml(wrapperHtml) {
    if (!wrapperHtml) return '';
    // Strip the data-block-name attribute we injected so we re-parse clean
    const clean = wrapperHtml.replace(/\s+data-block-name="[^"]*"/, '');
    // Try to find a <td> inside the first <table> — that's usually where the
    // real blocks live in nested wrapper tables.
    const tdMatch = clean.match(/<td\b[^>]*>([\s\S]*)<\/td>/i);
    if (tdMatch) return tdMatch[1];
    // Fallback: strip outer <table>...</table>
    const tableMatch = clean.match(/<table\b[^>]*>([\s\S]*)<\/table>/i);
    if (tableMatch) return tableMatch[1];
    return '';
}

/**
 * When the body has no clear top-level tables (e.g. everything is wrapped in
 * a <div class="email-container">), find the first div and return its contents
 * so we can look for tables one level deeper.
 */
function extractFirstContainerInner(bodyContent) {
    if (!bodyContent) return '';
    // Look for a div that likely contains the email content
    const divMatch = bodyContent.match(/<div\b[^>]*(?:email-container|container)[^>]*>([\s\S]*)<\/div>/i);
    if (divMatch) return divMatch[1];
    // Any top-level div
    const anyDiv = bodyContent.match(/<div\b[^>]*>([\s\S]*)<\/div>/i);
    if (anyDiv) return anyDiv[1];
    return '';
}

/**
 * Applies a block patch to the full email HTML using string replacement.
 * Finds the block by data-block-name attribute and replaces it with patchHtml.
 * String-based (no DOMParser) to preserve MSO conditional comments for Outlook.
 *
 * @param {string} currentHtml - Full email HTML containing the block to patch
 * @param {string} blockName - Value of data-block-name attribute to find
 * @param {string} patchHtml - New HTML to replace the found block
 * @returns {string} Updated full email HTML
 */
export function applyPatch(currentHtml, blockName, patchHtml) {
    if (!currentHtml) return patchHtml;

    const marker = `data-block-name="${blockName}"`;
    const markerIdx = currentHtml.indexOf(marker);
    if (markerIdx === -1) return currentHtml;

    let tableStart = markerIdx;
    while (tableStart > 0 && currentHtml[tableStart] !== '<') {
        tableStart--;
    }

    const lower = currentHtml.toLowerCase();
    let depth = 0;
    let i = tableStart;
    let tableEnd = -1;

    while (i < currentHtml.length) {
        const nextChar = lower[i + 6];
        if (lower.slice(i, i + 6) === '<table' && (nextChar === '>' || nextChar === ' ' || nextChar === '\n' || nextChar === '\t' || nextChar === '\r' || nextChar === undefined)) {
            depth++;
            i += 6;
        } else if (lower.slice(i, i + 8) === '</table>') {
            depth--;
            if (depth === 0) {
                tableEnd = i + 8;
                break;
            }
            i += 8;
        } else {
            i++;
        }
    }

    if (tableEnd === -1) return currentHtml;
    return currentHtml.slice(0, tableStart) + patchHtml + currentHtml.slice(tableEnd);
}
