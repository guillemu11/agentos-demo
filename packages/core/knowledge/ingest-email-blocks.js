/**
 * ingest-email-blocks.js
 *
 * One-time (idempotent) ingestion of Emirates email design blocks into
 * Pinecone namespace 'email-blocks'.
 *
 * Called by: POST /api/knowledge/ingest-email-blocks
 * Reuses:    ingestDocument() from ingestion.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ingestDocument } from './ingestion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOCKS_DIR = path.resolve(__dirname, '../../../apps/dashboard/public/email-blocks');

const EMAIL_BLOCKS = [
  {
    blockId: 'emirates-preheader-v1',
    title: 'Emirates Preheader v1',
    type: 'preheader',
    file: 'emirates-preheader-v1.html',
    description: 'Visually hidden preheader text block for Emirates emails. Controls the preview text shown in email client inbox before opening. Uses display:none with max-height:0 technique. Supports {{PREHEADER_TEXT}} placeholder.',
  },
  {
    blockId: 'emirates-header-v1',
    title: 'Emirates Header v1',
    type: 'header',
    file: 'emirates-header-v1.html',
    description: 'Emirates email header block. Two-row structure: top grey bar with "View online" link, below dark (#333333) nav bar with Emirates red logo on left and member tier + Skywards Miles balance on right. Supports: {{VIEW_ONLINE_URL}}, {{LOGO_URL}}, {{ACCOUNT_URL}}, {{MEMBER_TIER}}, {{MEMBER_MILES}} placeholders.',
  },
  {
    blockId: 'emirates-body-copy-v1',
    title: 'Emirates Body Copy v1',
    type: 'body-copy',
    file: 'emirates-body-copy-v1.html',
    description: 'Emirates email main body copy block. Centered paragraph text in HelveticaNeue-Light 14px, color #151515, max-width 642px. Used for personalized greeting and introductory promotional message. Supports {{BODY_COPY_TEXT}} placeholder.',
  },
  {
    blockId: 'emirates-product-cards-v1',
    title: 'Emirates Product Cards v1',
    type: 'product-cards',
    file: 'emirates-product-cards-v1.html',
    description: 'Emirates 3-column product cards grid (spend Miles theme). Each card has: circular image 172x172px, bold title, description text. Cards in original email: Save more with Cash+Miles, Turn Miles into memories, Let Miles take you places. Responsive: stacks on mobile. Supports: {{CARD1_TITLE}}, {{CARD1_IMAGE}}, {{CARD1_URL}}, {{CARD1_DESCRIPTION}} (and CARD2, CARD3 variants).',
  },
  {
    blockId: 'emirates-product-cards-v2',
    title: 'Emirates Product Cards v2',
    type: 'product-cards',
    file: 'emirates-product-cards-v2.html',
    description: 'Emirates 3-column product cards grid (earn Miles theme). Second variant of the product cards block. Cards in original email: Drive and earn, Travel beyond our network, Shop and earn. Same structure as v1, different content focus. Responsive: stacks on mobile. Supports: {{CARD1_TITLE}}, {{CARD1_IMAGE}}, {{CARD1_URL}}, {{CARD1_DESCRIPTION}} (and CARD2, CARD3 variants).',
  },
  {
    blockId: 'emirates-footer-v1',
    title: 'Emirates Footer v1',
    type: 'footer',
    file: 'emirates-footer-v1.html',
    description: 'Emirates email footer block. Dark background (#333333). Left column: Unsubscribe, Contact us, Privacy policy links in grey (#a9a9a9) + copyright notice in white. Right column: Emirates logo bug in red (#d10911) box. Supports: {{UNSUBSCRIBE_URL}}, {{CONTACT_URL}}, {{PRIVACY_URL}}, {{LOGO_URL}}, {{YEAR}} placeholders.',
  },
  {
    blockId: 'emirates-terms-v1',
    title: 'Emirates Terms & Conditions v1',
    type: 'terms',
    file: 'emirates-terms-v1.html',
    description: 'Emirates email legal disclaimers block. Two sections: 1) Skywards account security notice with links to manage account on emirates.com and abuse reporting email. 2) Corporate sender identity disclosure (Emirates Group, Dubai, UAE). Small grey text (#666666) 12px. Supports {{YEAR}} placeholder.',
  },

  // ── From email #2: Upgrade Offer ──────────────────────────────────────────

  {
    blockId: 'emirates-section-heading-v1',
    title: 'Emirates Section Heading v1',
    type: 'section-heading',
    file: 'emirates-section-heading-v1.html',
    description: 'Emirates email section heading block. Two rows: 1) Small uppercase label (10px, letter-spacing 4px, HelveticaNeue-Bold) — e.g. "UPGRADE YOUR JOURNEY". 2) Large headline (36px Emirates-Bold) — e.g. "Enjoy a new level of service". Centered, max-width 642px. Used above hero images or content sections. Supports: {{SECTION_LABEL}}, {{SECTION_HEADLINE}} placeholders.',
  },
  {
    blockId: 'emirates-hero-banner-v1',
    title: 'Emirates Hero Banner v1',
    type: 'hero',
    file: 'emirates-hero-banner-v1.html',
    description: 'Emirates email hero/masthead image block. Full-width clickable image (max 642px) with border-radius 3px, box-shadow, and responsive width. Used as the main visual after the section heading to establish the campaign theme. Supports: {{HERO_URL}}, {{HERO_IMAGE}}, {{HERO_ALT}} placeholders.',
  },
  {
    blockId: 'emirates-cta-button-v1',
    title: 'Emirates CTA Button v1',
    type: 'cta',
    file: 'emirates-cta-button-v1.html',
    description: 'Emirates email primary CTA button block. Single full-width red button (#c60c30) centered in the email. HelveticaNeue-Bold 16px white text, 10px 20px padding, border-radius 3px, subtle box-shadow. Used as the main call-to-action after body copy. Supports: {{CTA_URL}}, {{CTA_TEXT}} placeholders.',
  },
  {
    blockId: 'emirates-partner-module-v1',
    title: 'Emirates Partner Module v1',
    type: 'partner-module',
    file: 'emirates-partner-module-v1.html',
    description: 'Emirates email 2-column partner/product showcase card. Left column (185px): product image. Right column (395px): bold title (24px Emirates-Bold), red separator line (#c60c30), description text (14px), and an outlined "Learn more" button with dark border. Card has border, shadow and rounded corners. Used to highlight a service, product or partnership. Supports: {{IMAGE_URL}}, {{IMAGE_SRC}}, {{IMAGE_ALT}}, {{TITLE}}, {{TITLE_URL}}, {{DESCRIPTION}}, {{BUTTON_URL}}, {{BUTTON_TEXT}} placeholders.',
  },
  {
    blockId: 'emirates-icon-text-card-v1',
    title: 'Emirates Icon Text Card v1',
    type: 'info-card',
    file: 'emirates-icon-text-card-v1.html',
    description: 'Emirates email informational card with icon + text layout. Left column (12%, ~55px): small square icon image. Right column (88%): bold title followed by description text and a "Learn more" inline link. Card has border, shadow and rounded corners. Used for secondary information, travel updates, bonus offers, or notices. Supports: {{ICON_URL}}, {{ICON_SRC}}, {{TITLE}}, {{DESCRIPTION}}, {{LINK_URL}}, {{LINK_TEXT}} placeholders.',
  },
];

/**
 * Ingest all Emirates email blocks into the knowledge base.
 * Idempotent: skips blocks already indexed (checks by title in knowledge_documents).
 *
 * @param {import('pg').Pool} pool
 * @returns {{ ingested: number, skipped: number, errors: string[] }}
 */
export async function ingestEmailBlocks(pool) {
  const results = { ingested: 0, skipped: 0, errors: [] };

  for (const block of EMAIL_BLOCKS) {
    try {
      // Idempotency check: skip if already indexed
      const existing = await pool.query(
        `SELECT id FROM knowledge_documents WHERE title = $1 AND source_type = 'email-block' LIMIT 1`,
        [block.title]
      );
      if (existing.rows.length > 0) {
        console.log(`[email-blocks] Skipping "${block.title}" (already indexed)`);
        results.skipped++;
        continue;
      }

      // Read HTML file
      const filePath = path.join(BLOCKS_DIR, block.file);
      const htmlSource = fs.readFileSync(filePath, 'utf-8');

      // Content = semantic description + HTML source
      // This ensures the embedding captures both purpose and code structure
      const content = `${block.description}\n\n--- HTML SOURCE ---\n${htmlSource}`;

      await ingestDocument(pool, {
        title: block.title,
        content,
        namespace: 'email-blocks',
        sourceType: 'email-block',
        metadata: {
          block_id: block.blockId,
          type: block.type,
          brand: 'emirates',
          version: 'v1',
          responsive: true,
          industry: 'aviation',
          style: 'premium',
          description: block.description,
          file: block.file,
        },
      });

      console.log(`[email-blocks] Ingested "${block.title}"`);
      results.ingested++;
    } catch (err) {
      console.error(`[email-blocks] Error ingesting "${block.title}":`, err.message);
      results.errors.push(`${block.title}: ${err.message}`);
    }
  }

  return results;
}
