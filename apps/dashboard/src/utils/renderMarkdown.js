/**
 * Converts markdown text to sanitized HTML.
 * Used for rendering AI chat responses via dangerouslySetInnerHTML.
 * Pure string manipulation — no external dependencies.
 *
 * Processing order:
 * 1. Escape HTML entities (XSS protection)
 * 2. Fenced code blocks → placeholders
 * 3. Inline code → placeholders
 * 4. Images (restricted URLs)
 * 5. Links
 * 6. Bold
 * 7. Italic
 * 8. Headers (## → h4, ### → h5)
 * 9. Unordered lists
 * 10. Ordered lists
 * 11. Paragraphs and line breaks
 * 12. Restore placeholders
 */
export default function renderMarkdown(text) {
  if (!text) return '';

  const placeholders = [];

  function storePlaceholder(html) {
    const index = placeholders.length;
    placeholders.push(html);
    return `__PLACEHOLDER_${index}__`;
  }

  // 1. Escape HTML entities
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // 2. Fenced code blocks — triple backticks
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return storePlaceholder(
      `<pre><code${lang ? ` class="language-${lang}"` : ''}>${code.replace(/\n$/, '')}</code></pre>`
    );
  });

  // 3. Inline code — single backticks
  result = result.replace(/`([^`\n]+)`/g, (_, code) => {
    return storePlaceholder(`<code>${code}</code>`);
  });

  // 4. Images & PDF pages — only allow safe URLs
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    if (url.startsWith('/api/') || url.startsWith('http://') || url.startsWith('https://')) {
      if (url.toLowerCase().endsWith('.pdf')) {
        return storePlaceholder(
          `<div class="pdf-page-embed">` +
          `<embed src="${url}" type="application/pdf" />` +
          `<a href="${url}" target="_blank" rel="noopener noreferrer" class="pdf-page-link">${alt || 'Ver página PDF'}</a>` +
          `</div>`
        );
      }
      return `<img src="${url}" alt="${alt}" loading="lazy">`;
    }
    return match;
  });

  // 5. Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 6. Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 7. Italic (single *, but not **)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // 8. Headers (## → h4, ### → h5)
  result = result.replace(/^### +(.+)$/gm, '<h5>$1</h5>');
  result = result.replace(/^## +(.+)$/gm, '<h4>$1</h4>');

  // 9. Unordered lists — consecutive lines starting with "- "
  result = result.replace(/(^- .+(?:\n- .+)*)/gm, (block) => {
    const items = block.split('\n').map(line =>
      `<li>${line.replace(/^- /, '')}</li>`
    ).join('');
    return `<ul>${items}</ul>`;
  });

  // 10. Ordered lists — consecutive lines starting with "N. "
  result = result.replace(/(^\d+\. .+(?:\n\d+\. .+)*)/gm, (block) => {
    const items = block.split('\n').map(line =>
      `<li>${line.replace(/^\d+\. /, '')}</li>`
    ).join('');
    return `<ol>${items}</ol>`;
  });

  // 11. Paragraphs and line breaks
  // Split on double newlines for paragraphs
  const blocks = result.split(/\n\n+/);
  result = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // Don't wrap block-level elements in <p>
    if (/^<(h[1-6]|ul|ol|pre|blockquote)/.test(trimmed)) {
      return trimmed;
    }
    // Don't wrap placeholders that are code blocks
    if (/^__PLACEHOLDER_\d+__$/.test(trimmed)) {
      return trimmed;
    }
    // Single newlines within a paragraph become <br>
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).filter(Boolean).join('\n');

  // 12. Restore placeholders
  for (let i = placeholders.length - 1; i >= 0; i--) {
    result = result.replace(`__PLACEHOLDER_${i}__`, placeholders[i]);
  }

  return result;
}
