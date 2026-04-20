import { describe, it, expect } from 'vitest';
import { detectTechFromHtml, extractNewsletterForm } from '../recon.js';

describe('recon parsers', () => {
  it('detects SFMC from embedded tracker URL', () => {
    const html = '<img src="https://click.exacttarget.com/open.aspx?x=123"/>';
    const tech = detectTechFromHtml(html);
    expect(tech.esps).toContain('Salesforce Marketing Cloud');
  });

  it('detects Klaviyo from script tag', () => {
    const html = '<script src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>';
    const tech = detectTechFromHtml(html);
    expect(tech.esps).toContain('Klaviyo');
  });

  it('detects OneTrust cookie banner', () => {
    const html = '<div id="onetrust-banner-sdk"></div>';
    const tech = detectTechFromHtml(html);
    expect(tech.cdps).toContain('OneTrust');
  });

  it('extracts newsletter email input fields', () => {
    const html = `
      <form action="/subscribe" method="post">
        <input type="email" name="email_address" required />
        <input type="text" name="first_name" />
      </form>`;
    const form = extractNewsletterForm(html);
    expect(form.fields).toEqual(expect.arrayContaining(['email_address','first_name']));
    expect(form.action).toBe('/subscribe');
  });
});
