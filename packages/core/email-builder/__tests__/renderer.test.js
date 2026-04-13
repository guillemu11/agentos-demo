import { describe, it, expect } from 'vitest';
import { buildVariableMap, renderBlock, renderVariant, renderBodyCopyBlock, renderThreeColumnBlock } from '../renderer.js';

describe('buildVariableMap', () => {
  it('maps subscriber + header + segment data into flat key-value object', () => {
    const map = buildVariableMap({
      subscriber: { first_name: 'Sarah', TierName: 'Gold', miles_balance: '45,230' },
      headerContent: { header_logo: '42722', header_login_logo: '42723', skw_miles_text: 'Skywards Miles' },
      footerContent: { unsub_text: 'Unsubscribe', logo_image: '12345', copywrite: '© {current_year} Emirates' },
      segmentContent: { main_header: 'Where to go next', body_cta: 'Book now', body_link: 'https://emirates.com/xx/xx/book' },
      stories: [],
      imageMap: { '42722': 'https://cdn.emirates.com/logo.png', '42723': 'https://cdn.emirates.com/login.png' },
      market: 'uk/english',
    });

    expect(map.first_name).toBe('Sarah');
    expect(map.TierName).toBe('Gold');
    expect(map.header_logo).toBe('https://cdn.emirates.com/logo.png');
    expect(map.main_header).toBe('Where to go next');
    expect(map.unsub_text).toBe('Unsubscribe');
    // URL replacement
    expect(map.body_link).toBe('https://emirates.com/uk/english/book');
    // Copyright year
    expect(map.copywrite).toContain(String(new Date().getFullYear()));
  });

  it('handles body copy link splitting', () => {
    const map = buildVariableMap({
      subscriber: { first_name: 'Sarah' },
      segmentContent: {
        body_copy: 'Visit {link1} for deals. Book {link2} now.',
        link1: 'https://emirates.com/home', link1_text: 'emirates.com',
        link2: 'https://emirates.com/book', link2_text: 'your trip',
      },
      salutation: { salutation: 'Hi {first_name}, ' },
      stories: [],
      imageMap: {},
    });

    expect(map.body_copy_salutation).toBe('Hi Sarah, ');
    expect(map.Link1).toBe('https://emirates.com/home');
    expect(map.link1_text).toBe('emirates.com');
  });

  it('maps stories to indexed variables', () => {
    const map = buildVariableMap({
      subscriber: {},
      segmentContent: { story1: 'dubai_story', story2: 'london_story', story3: 'paris_story' },
      stories: [
        { story_name: 'dubai_story', story_header: 'Dubai', story_image_circle: '111', story_url: 'https://emirates.com/dubai' },
        { story_name: 'london_story', story_header: 'London', story_image_circle: '222', story_url: 'https://emirates.com/london' },
        { story_name: 'paris_story', story_header: 'Paris', story_image_circle: '333', story_url: 'https://emirates.com/paris' },
      ],
      imageMap: { '111': 'https://cdn/dubai.jpg', '222': 'https://cdn/london.jpg', '333': 'https://cdn/paris.jpg' },
    });

    expect(map.story1_header).toBe('Dubai');
    expect(map.story1_image).toBe('https://cdn/dubai.jpg');
    expect(map.story2_header).toBe('London');
    expect(map.story3_header).toBe('Paris');
  });
});

describe('renderBlock', () => {
  it('strips AMPscript and replaces variables', () => {
    const blockHtml = '%%[ SET @x = 1 ]%%<td>%%=v(@main_header)=%%</td>';
    const result = renderBlock(blockHtml, { main_header: 'Test Header' });
    expect(result).toContain('Test Header');
    expect(result).not.toContain('%%');
  });

  it('returns empty string for empty input', () => {
    expect(renderBlock('', {})).toBe('');
    expect(renderBlock(null, {})).toBe('');
  });
});

describe('renderBodyCopyBlock', () => {
  it('renders body text with inline links', () => {
    const vars = {
      before_link1: 'Visit ',
      Link1: 'https://emirates.com',
      link1_text: 'emirates.com',
      glue12: ' ',
      between_link1_2: 'for deals.',
      Link2: '', link2_text: '',
      glue23: '', between_link2_3: '',
      Link3: '', link3_text: '',
      glue34: '', between_link3_4: '',
      Link4: '', link4_text: '',
      glue4e: '',
      after_last_link: '',
    };
    const html = renderBodyCopyBlock(vars);
    expect(html).toContain('Visit ');
    expect(html).toContain('href="https://emirates.com"');
    expect(html).toContain('emirates.com');
    expect(html).toContain('for deals.');
    expect(html).toContain('<!-- START BODY COPY -->');
  });
});

describe('renderThreeColumnBlock', () => {
  it('renders with story set 1 vars directly', () => {
    const blockHtml = '<td>%%=v(@story1_header)=%%</td><td>%%=v(@story2_header)=%%</td>';
    const vars = { story1_header: 'Dubai', story2_header: 'London' };
    const result = renderThreeColumnBlock(blockHtml, vars, 1);
    expect(result).toContain('Dubai');
    expect(result).toContain('London');
  });

  it('remaps set2 vars for story set 2', () => {
    const blockHtml = '<td>%%=v(@story1_header)=%%</td>';
    const vars = {
      story1_header: 'Dubai',  // set 1
      story1_set2_header: 'Tokyo',  // set 2
    };
    const result = renderThreeColumnBlock(blockHtml, vars, 2);
    expect(result).toContain('Tokyo');
    expect(result).not.toContain('Dubai');
  });
});

describe('renderVariant', () => {
  it('produces complete HTML with no AMPscript remaining', () => {
    const blocks = {
      '100': { html: '<td>%%=v(@main_header)=%%</td>' },
      '200': { html: '<td>%%=v(@body_cta)=%%</td>' },
    };
    const vars = { main_header: 'Hello World', body_cta: 'Click here' };
    const blockOrder = ['100', '200'];
    const templateShell = '<html><body>{{CONTENT}}</body></html>';

    const result = renderVariant({ blocks, vars, blockOrder, templateShell });

    expect(result).toContain('Hello World');
    expect(result).toContain('Click here');
    expect(result).not.toContain('%%');
    expect(result).toContain('<html>');
    expect(result).toContain('</html>');
  });

  it('adds preheader as hidden div', () => {
    const result = renderVariant({
      blocks: { '1': { html: '<p>test</p>' } },
      vars: {},
      blockOrder: ['1'],
      templateShell: '{{CONTENT}}',
      preheader: 'Preview text here',
    });
    expect(result).toContain('Preview text here');
    expect(result).toContain('display:none');
  });

  it('skips missing blocks gracefully', () => {
    const result = renderVariant({
      blocks: { '1': { html: '<p>exists</p>' } },
      vars: {},
      blockOrder: ['1', '999'],
      templateShell: '{{CONTENT}}',
    });
    expect(result).toContain('exists');
  });
});
