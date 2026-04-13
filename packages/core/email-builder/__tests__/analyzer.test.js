import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeTemplate } from '../analyzer.js';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures');

describe('analyzeTemplate', () => {
  const template = readFileSync(join(FIXTURE_DIR, 'churn-template.html'), 'utf8');
  const manifest = analyzeTemplate(template);

  it('returns a valid manifest object', () => {
    expect(manifest).toHaveProperty('contentBlockIds');
    expect(manifest).toHaveProperty('dataExtensions');
    expect(manifest).toHaveProperty('variables');
    expect(manifest).toHaveProperty('variants');
    expect(manifest).toHaveProperty('blockOrder');
  });

  it('discovers all content block IDs referenced', () => {
    // The churn template references these blocks
    expect(manifest.contentBlockIds).toContain('42706');  // header skw
    expect(manifest.contentBlockIds).toContain('37247');  // spacer
    expect(manifest.contentBlockIds).toContain('37241');  // header title
    expect(manifest.contentBlockIds).toContain('44975');  // body copy
    expect(manifest.contentBlockIds).toContain('42617');  // red CTA
    expect(manifest.contentBlockIds).toContain('34287');  // 3-columns
    expect(manifest.contentBlockIds).toContain('39445');  // footer
    expect(manifest.contentBlockIds).toContain('35063');  // caveat
  });

  it('discovers data extensions used', () => {
    const deNames = manifest.dataExtensions.map(d => d.name);
    expect(deNames).toContain('Churn_DynamicContent_shortlinks');
    expect(deNames).toContain('Header_CentralizedContent');
    expect(deNames).toContain('Footer_CentralizedContent');
    expect(deNames).toContain('Stories_Ref_Table_shortlink');
  });

  it('extracts lookup fields for each DE', () => {
    const churnDE = manifest.dataExtensions.find(d => d.name === 'Churn_DynamicContent_shortlinks');
    expect(churnDE).toBeTruthy();
    expect(churnDE.lookupFields).toContain('language');
  });

  it('identifies segment-based variants', () => {
    expect(manifest.variants.segmentField).toBe('Segment');
    expect(manifest.variants.segments.length).toBeGreaterThan(0);
    // At least some of the known segments
    const hasPreventionOrReactivation = manifest.variants.segments.some(
      s => s.includes('prevention') || s.includes('reactivation')
    );
    expect(hasPreventionOrReactivation).toBe(true);
  });

  it('identifies header variants (skw vs ebase)', () => {
    expect(manifest.variants.headerTypes).toContain('skw');
    expect(manifest.variants.headerTypes).toContain('ebase');
  });

  it('extracts variable declarations', () => {
    expect(manifest.variables.length).toBeGreaterThan(0);
    // Should find common AMPscript field mappings
    const varNames = manifest.variables.map(v => v.variable);
    expect(varNames.length).toBeGreaterThan(5);
  });

  it('detects block order in render section', () => {
    expect(manifest.blockOrder).toHaveProperty('allBlocks');
    expect(manifest.blockOrder.allBlocks.length).toBeGreaterThan(0);
  });
});
