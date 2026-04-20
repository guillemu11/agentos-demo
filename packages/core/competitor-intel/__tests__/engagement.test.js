import { describe, it, expect } from 'vitest';
import {
  shouldOpen,
  extractTrackingPixels,
  extractClickableLinks,
  pickClickableLinks
} from '../engagement.js';

const SARAH = { profile: { engagement_pattern: { base_open_rate: 0.8, click_keywords: ['maldives','seychelles'] } } };
const TOM   = { profile: { engagement_pattern: { base_open_rate: 0.6, click_keywords: ['trek','adventure'] } } };

describe('engagement simulator', () => {
  it('always opens welcome/transactional/double_opt_in/preference_update', () => {
    expect(shouldOpen({ type: 'welcome' },            SARAH, () => 0.99)).toBe(true);
    expect(shouldOpen({ type: 'transactional' },      SARAH, () => 0.99)).toBe(true);
    expect(shouldOpen({ type: 'double_opt_in' },      SARAH, () => 0.99)).toBe(true);
    expect(shouldOpen({ type: 'preference_update' },  SARAH, () => 0.99)).toBe(true);
  });

  it('honors base open rate for nurture/promo', () => {
    expect(shouldOpen({ type: 'nurture' }, SARAH, () => 0.5)).toBe(true);
    expect(shouldOpen({ type: 'nurture' }, SARAH, () => 0.9)).toBe(false);
    expect(shouldOpen({ type: 'promo'   }, TOM,   () => 0.5)).toBe(true);
    expect(shouldOpen({ type: 'promo'   }, TOM,   () => 0.7)).toBe(false);
  });

  it('extracts tracking pixels', () => {
    const html = '<img src="https://track.carrier.co.uk/o/1" width="1" height="1"><img src="https://cdn.carrier.co.uk/hero.jpg">';
    const pixels = extractTrackingPixels(html);
    expect(pixels).toContain('https://track.carrier.co.uk/o/1');
  });

  it('extracts clickable http links with anchor text', () => {
    const html = '<a href="https://kuoni.co.uk/maldives">Maldives</a><a href="https://kuoni.co.uk/alps">Alps</a><a href="mailto:x@y">Contact</a>';
    const links = extractClickableLinks(html);
    expect(links.length).toBe(2);
    expect(links[0].href).toBe('https://kuoni.co.uk/maldives');
    expect(links[0].text).toBe('Maldives');
  });

  it('picks links matching click_keywords in href or anchor text', () => {
    const links = [
      { href: 'https://x/maldives', text: 'Discover Maldives' },
      { href: 'https://x/alps', text: 'Alpine escapes' }
    ];
    const chosen = pickClickableLinks(links, SARAH);
    expect(chosen.map(l => l.href)).toContain('https://x/maldives');
    expect(chosen.map(l => l.href)).not.toContain('https://x/alps');
  });

  it('limits picked links to max parameter', () => {
    const links = [
      { href: 'https://a/maldives', text: 'M' },
      { href: 'https://b/seychelles', text: 'S' },
      { href: 'https://c/maldives-2', text: 'M2' }
    ];
    expect(pickClickableLinks(links, SARAH, 2).length).toBe(2);
  });
});
