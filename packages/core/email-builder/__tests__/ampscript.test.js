/**
 * packages/core/email-builder/__tests__/ampscript.test.js
 * Vitest tests for AMPscript parsing utilities.
 * Run: npx vitest run packages/core/email-builder/__tests__/ampscript.test.js
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  stripAmpscriptBlocks,
  replaceAmpscriptVars,
  splitBodyCopy,
  parseContentBlockRefs,
  parseDELookups,
  parseVariableDeclarations,
} from '../ampscript.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

// ---------------------------------------------------------------------------
// stripAmpscriptBlocks
// ---------------------------------------------------------------------------
describe('stripAmpscriptBlocks', () => {
  it('removes a simple %%[ ... ]%% block', () => {
    const input = 'Before %%[ SET @x = 1 ]%% After';
    expect(stripAmpscriptBlocks(input)).toBe('Before  After');
  });

  it('removes multiline %%[ ... ]%% blocks', () => {
    const input = 'A%%[\nIF @x == 1 THEN\n  SET @y = 2\nENDIF\n]%%B';
    expect(stripAmpscriptBlocks(input)).toBe('AB');
  });

  it('removes ContentBlockbyID references (case-insensitive)', () => {
    const input = '%%=ContentBlockbyID("12345")=%%\n%%=ContentBlockByID("99999")=%%';
    expect(stripAmpscriptBlocks(input)).toBe('\n');
  });

  it('removes BeginImpressionRegion and EndImpressionRegion', () => {
    const input =
      '%%=BeginImpressionRegion("region_a")=%%<div>content</div>%%=EndImpressionRegion()=%%';
    const result = stripAmpscriptBlocks(input);
    expect(result).toBe('<div>content</div>');
  });

  it('removes TreatAsContent(concat(...)) blocks', () => {
    const input = 'X%%=TreatAsContent(concat("%","%=BeginImpressionRegion(\'A\')=%","%"))=%%Y';
    const result = stripAmpscriptBlocks(input);
    expect(result).toBe('XY');
  });

  it('handles empty string', () => {
    expect(stripAmpscriptBlocks('')).toBe('');
  });

  it('returns unchanged HTML that has no AMPscript', () => {
    const html = '<p>Hello world</p>';
    expect(stripAmpscriptBlocks(html)).toBe(html);
  });

  it('removes AMPscript from real sample-block.html fixture', () => {
    const html = fixture('sample-block.html');
    const result = stripAmpscriptBlocks(html);
    expect(result).not.toMatch(/%%\[/);
    expect(result).not.toMatch(/ContentBlock(?:by|By)ID/i);
  });
});

// ---------------------------------------------------------------------------
// replaceAmpscriptVars
// ---------------------------------------------------------------------------
describe('replaceAmpscriptVars', () => {
  it('replaces %%=v(@var)=%% with the matching value', () => {
    const html = 'Hello %%=v(@first_name)=%%!';
    expect(replaceAmpscriptVars(html, { first_name: 'Ahmed' })).toBe('Hello Ahmed!');
  });

  it('returns empty string for undefined vars', () => {
    const html = '%%=v(@missing)=%%';
    expect(replaceAmpscriptVars(html, {})).toBe('');
  });

  it('replaces %%=RedirectTo(@url)=%%', () => {
    const html = '<a href="%%=RedirectTo(@booking_url)=%%">Book</a>';
    const result = replaceAmpscriptVars(html, { booking_url: 'https://emirates.com/book' });
    expect(result).toBe('<a href="https://emirates.com/book">Book</a>');
  });

  it('replaces %%=TreatAsContent(@html)=%%', () => {
    const html = '%%=TreatAsContent(@body_html)=%%';
    const result = replaceAmpscriptVars(html, { body_html: '<p>Content</p>' });
    expect(result).toBe('<p>Content</p>');
  });

  it('replaces %%view_email_url%% with default URL', () => {
    const html = '<a href="%%view_email_url%%">View online</a>';
    const result = replaceAmpscriptVars(html, {});
    expect(result).toContain('https://www.emirates.com/uk/english/home');
  });

  it('replaces %%view_email_url%% with custom URL', () => {
    const html = '%%view_email_url%%';
    const result = replaceAmpscriptVars(html, {}, 'https://example.com/view');
    expect(result).toBe('https://example.com/view');
  });

  it('strips alias="..." attributes', () => {
    const html = '<a href="https://emirates.com" alias="Track_Click">Link</a>';
    const result = replaceAmpscriptVars(html, {});
    expect(result).not.toMatch(/alias=/);
    expect(result).toContain('<a href="https://emirates.com">Link</a>');
  });

  it('strips alias with single quotes', () => {
    const html = `<a href="x" alias='myAlias'>Click</a>`;
    const result = replaceAmpscriptVars(html, {});
    expect(result).not.toMatch(/alias=/);
  });

  it('cleans remaining %%..%% patterns', () => {
    const html = 'some %%unknown_tag%% text';
    const result = replaceAmpscriptVars(html, {});
    expect(result).toBe('some  text');
  });

  it('handles multiple replacements in one string', () => {
    const html = '%%=v(@greeting)=%%, %%=v(@name)=%%!';
    const result = replaceAmpscriptVars(html, { greeting: 'Dear', name: 'Layla' });
    expect(result).toBe('Dear, Layla!');
  });
});

// ---------------------------------------------------------------------------
// splitBodyCopy
// ---------------------------------------------------------------------------
describe('splitBodyCopy', () => {
  const dc = {
    link1: 'https://emirates.com/1',
    link1_text: 'Fly Now',
    link2: 'https://emirates.com/2',
    link2_text: 'Book Hotel',
    link3: 'https://emirates.com/3',
    link3_text: 'Explore',
    link4: 'https://emirates.com/4',
    link4_text: 'Join Skywards',
  };

  it('splits body around four link markers', () => {
    const body = 'Intro {link1} middle1 {link2} middle2 {link3} middle3 {link4} outro';
    const r = splitBodyCopy(body, dc);
    expect(r.before_link1).toBe('Intro ');
    expect(r.between_link1_2).toBe(' middle1 ');
    expect(r.between_link2_3).toBe(' middle2 ');
    expect(r.between_link3_4).toBe(' middle3 ');
    expect(r.after_last_link).toBe(' outro');
  });

  it('builds correct Link HTML anchors', () => {
    const body = '{link1}';
    const r = splitBodyCopy(body, dc);
    expect(r.Link1_html).toBe(
      '<a href="https://emirates.com/1" style="color:#333333; text-decoration:none;" target="_blank">Fly Now</a>'
    );
  });

  it('returns empty link html when dc entry is missing', () => {
    const r = splitBodyCopy('{link1}', {});
    expect(r.Link1_html).toBe('');
  });

  it('handles body with no markers', () => {
    const r = splitBodyCopy('Plain text no links', dc);
    expect(r.before_link1).toBe('Plain text no links');
    expect(r.between_link1_2).toBe('');
    expect(r.after_last_link).toBe('');
  });

  it('adds glue space when following segment starts with alphanumeric', () => {
    const body = 'intro {link1}next sentence';
    const r = splitBodyCopy(body, dc);
    // between_link1_2 starts with 'n' — alphanumeric → glue12 = ' '
    expect(r.glue12).toBe(' ');
  });

  it('returns empty glue when following segment is empty', () => {
    const r = splitBodyCopy('text', dc);
    expect(r.glue12).toBe('');
    expect(r.glue4e).toBe('');
  });

  it('returns empty glue when following segment starts with non-alphanumeric', () => {
    const body = '{link1}, then more';
    const r = splitBodyCopy(body, dc);
    // between_link1_2 starts with ',' — not alphanumeric → glue12 = ''
    expect(r.glue12).toBe('');
  });

  it('handles body with only links 1 and 2', () => {
    const body = 'A{link1}B{link2}C';
    const r = splitBodyCopy(body, dc);
    expect(r.before_link1).toBe('A');
    expect(r.between_link1_2).toBe('B');
    expect(r.between_link2_3).toBe('C');
    expect(r.between_link3_4).toBe('');
    expect(r.after_last_link).toBe('');
  });
});

// ---------------------------------------------------------------------------
// parseContentBlockRefs
// ---------------------------------------------------------------------------
describe('parseContentBlockRefs', () => {
  it('extracts a single ID', () => {
    const amp = '%%=ContentBlockbyID("44158")=%%';
    expect(parseContentBlockRefs(amp)).toEqual(['44158']);
  });

  it('extracts multiple IDs', () => {
    const amp = '%%=ContentBlockbyID("111")=%%\n%%=ContentBlockByID("222")=%%';
    const ids = parseContentBlockRefs(amp);
    expect(ids).toContain('111');
    expect(ids).toContain('222');
    expect(ids.length).toBe(2);
  });

  it('deduplicates repeated IDs', () => {
    const amp = '%%=ContentBlockbyID("555")=%%\n%%=ContentBlockbyID("555")=%%';
    expect(parseContentBlockRefs(amp)).toEqual(['555']);
  });

  it('returns empty array for empty input', () => {
    expect(parseContentBlockRefs('')).toEqual([]);
  });

  it('works on the real churn-template.html fixture', () => {
    const html = fixture('churn-template.html');
    const ids = parseContentBlockRefs(html);
    expect(ids.length).toBeGreaterThan(0);
    // Known ID from fixture
    expect(ids).toContain('44158');
  });
});

// ---------------------------------------------------------------------------
// parseDELookups
// ---------------------------------------------------------------------------
describe('parseDELookups', () => {
  it('extracts DE name from LookupRows', () => {
    const amp = "SET @r = LookupRows('My_DE', 'key', @val)";
    expect(parseDELookups(amp)).toEqual(['My_DE']);
  });

  it('extracts DE name from LookupOrderedRows', () => {
    const amp = "SET @r = LookupOrderedRows('Churn_Audience_VAWP_v2', 1, 'Date DESC', 'id', @id)";
    expect(parseDELookups(amp)).toEqual(['Churn_Audience_VAWP_v2']);
  });

  it('deduplicates the same DE referenced multiple times', () => {
    const amp = "LookupRows('Same_DE','a',1)\nLookupRows('Same_DE','b',2)";
    expect(parseDELookups(amp)).toEqual(['Same_DE']);
  });

  it('extracts multiple distinct DE names', () => {
    const amp = "LookupRows('DE_One','k',1)\nLookupRows('DE_Two','k',2)";
    const names = parseDELookups(amp);
    expect(names).toContain('DE_One');
    expect(names).toContain('DE_Two');
    expect(names.length).toBe(2);
  });

  it('returns empty array for empty input', () => {
    expect(parseDELookups('')).toEqual([]);
  });

  it('works on the real churn-template.html fixture', () => {
    const html = fixture('churn-template.html');
    const names = parseDELookups(html);
    expect(names.length).toBeGreaterThan(0);
    // Known DE from fixture
    expect(names).toContain('REF_offline_markets');
  });
});

// ---------------------------------------------------------------------------
// parseVariableDeclarations
// ---------------------------------------------------------------------------
describe('parseVariableDeclarations', () => {
  it('extracts a single SET @var = Field(...) mapping', () => {
    const amp = "SET @first_name = Field(@Row, 'first_name')";
    expect(parseVariableDeclarations(amp)).toEqual([{ variable: 'first_name', field: 'first_name' }]);
  });

  it('extracts multiple mappings', () => {
    const amp =
      "SET @first = Field(@R, 'first_name')\nSET @last = Field(@R, 'last_name')";
    const result = parseVariableDeclarations(amp);
    expect(result).toContainEqual({ variable: 'first', field: 'first_name' });
    expect(result).toContainEqual({ variable: 'last', field: 'last_name' });
    expect(result.length).toBe(2);
  });

  it('deduplicates identical declarations', () => {
    const amp =
      "SET @seg = Field(@R, 'segment')\nSET @seg = Field(@R, 'segment')";
    expect(parseVariableDeclarations(amp)).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(parseVariableDeclarations('')).toEqual([]);
  });

  it('works on the real churn-template.html fixture', () => {
    const html = fixture('churn-template.html');
    const decls = parseVariableDeclarations(html);
    expect(decls.length).toBeGreaterThan(0);
    expect(decls).toContainEqual({ variable: 'segment', field: 'segment' });
  });
});
