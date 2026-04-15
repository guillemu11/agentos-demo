/**
 * Marketing Cloud Tool Executor
 *
 * Maps Claude tool_use calls to actual SFMC API operations.
 * Each handler validates input, calls the MC client, formats results,
 * and logs to the audit trail.
 */

import { translateMCError } from './errors.js';
import { analyzeTemplate, buildCampaignEmails } from '../email-builder/index.js';

/**
 * Execute a Marketing Cloud tool call.
 * @param {string} toolName - Tool name from Claude's tool_use block
 * @param {object} toolInput - Tool input from Claude
 * @param {object} mcClient - MC client instance from createMCClient()
 * @param {import('pg').Pool} pool - Database pool for audit logging
 * @returns {string} Human-readable result to feed back to Claude as tool_result
 */
export async function executeMCTool(toolName, toolInput, mcClient, pool) {
    const startTime = Date.now();
    try {
        const result = await dispatch(toolName, toolInput, mcClient);
        const elapsed = Date.now() - startTime;
        await logMCAudit(pool, toolName, toolInput, result, elapsed);
        return result;
    } catch (err) {
        const elapsed = Date.now() - startTime;
        const friendlyError = translateMCError(err);
        await logMCAudit(pool, toolName, toolInput, `ERROR: ${friendlyError}`, elapsed);
        return `Error: ${friendlyError}`;
    }
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

async function dispatch(toolName, input, mc) {
    switch (toolName) {
        // Data Extensions
        case 'mc_list_data_extensions':     return listDataExtensions(mc, input);
        case 'mc_query_data_extension':     return queryDataExtension(mc, input);
        case 'mc_create_data_extension':    return createDataExtension(mc, input);
        case 'mc_upsert_data_extension_rows': return upsertDERows(mc, input);
        // Subscribers
        case 'mc_get_subscriber':           return getSubscriber(mc, input);
        // Content & Emails
        case 'mc_list_assets':              return listAssets(mc, input);
        case 'mc_get_email_html':           return getEmailHtml(mc, input);
        case 'mc_list_emails':              return listEmails(mc, input);
        // Sends
        case 'mc_get_send_summary':         return getSendSummary(mc, input);
        case 'mc_send_test_email':          return sendTestEmail(mc, input);
        // Journeys
        case 'mc_list_journeys':            return listJourneys(mc, input);
        case 'mc_get_journey':              return getJourney(mc, input);
        // Automations
        case 'mc_list_automations':         return listAutomations(mc, input);
        // Email Builder
        case 'mc_analyze_email_template':   return analyzeEmailTemplate(mc, input);
        case 'mc_build_email_variants':     return buildEmailVariants(mc, input);
        default:
            return `Unknown tool: ${toolName}. Available tools: mc_list_data_extensions, mc_query_data_extension, mc_create_data_extension, mc_upsert_data_extension_rows, mc_get_subscriber, mc_list_assets, mc_get_email_html, mc_list_emails, mc_get_send_summary, mc_send_test_email, mc_list_journeys, mc_get_journey, mc_list_automations`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Data Extension handlers
// ═══════════════════════════════════════════════════════════════════════════════

async function listDataExtensions(mc, { nameFilter, pageSize = 25 }) {
    const size = Math.min(pageSize || 25, 50);

    // DE listing requires SOAP — REST /hub/v1/dataevents returns 404 on this account
    const filterXml = nameFilter
        ? `<Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <Property>Name</Property>
            <SimpleOperator>like</SimpleOperator>
            <Value>%${nameFilter.replace(/&/g, '&amp;').replace(/</g, '&lt;')}%</Value>
          </Filter>`
        : '';

    const soapXml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <RetrieveRequest>
        <ObjectType>DataExtension</ObjectType>
        <Properties>Name</Properties>
        <Properties>CustomerKey</Properties>
        <Properties>IsSendable</Properties>
        <Properties>CreatedDate</Properties>
        ${filterXml}
        <QueryAllAccounts>false</QueryAllAccounts>
      </RetrieveRequest>
    </RetrieveRequestMsg>`;

    const soapResult = await mc.soap('Retrieve', soapXml);

    // Parse XML results
    const results = soapResult.match(/<Results[^>]*>[\s\S]*?<\/Results>/g) || [];
    if (results.length === 0) {
        return 'No Data Extensions found' + (nameFilter ? ` matching "${nameFilter}"` : '') + '.';
    }

    // Limit to pageSize
    const limited = results.slice(0, size);
    const lines = limited.map(r => {
        const name = r.match(/<Name>([^<]+)/)?.[1] || '?';
        const key = r.match(/<CustomerKey>([^<]+)/)?.[1] || '?';
        const sendable = r.match(/<IsSendable>([^<]+)/)?.[1] === 'true';
        const created = r.match(/<CreatedDate>([^<]+)/)?.[1]?.split('T')[0] || 'N/A';
        return `- **${name}** (key: \`${key}\`) — sendable: ${sendable ? 'Yes' : 'No'}, created ${created}`;
    });

    return `Found ${results.length} Data Extension(s)${results.length > size ? ` (showing first ${size})` : ''}:\n${lines.join('\n')}`;
}

async function queryDataExtension(mc, { dataExtensionKey, filter, fields, top = 25, orderBy }) {
    const size = Math.min(top || 25, 100);
    let path = `/data/v1/customobjectdata/key/${encodeURIComponent(dataExtensionKey)}/rowset?$pageSize=${size}`;
    if (filter) path += `&$filter=${encodeURIComponent(filter)}`;
    if (orderBy) path += `&$orderBy=${encodeURIComponent(orderBy)}`;

    const result = await mc.rest('GET', path);
    const items = result.items || [];

    if (items.length === 0) {
        return `No rows found in DE "${dataExtensionKey}"` + (filter ? ` with filter: ${filter}` : '') + '.';
    }

    // Build markdown table
    const allKeys = fields && fields.length > 0
        ? fields
        : [...new Set(items.flatMap(row => Object.keys(row.values || row)))];

    const header = `| ${allKeys.join(' | ')} |`;
    const separator = `| ${allKeys.map(() => '---').join(' | ')} |`;
    const rows = items.map(row => {
        const vals = row.values || row;
        return `| ${allKeys.map(k => vals[k] ?? '').join(' | ')} |`;
    });

    return `${items.length} row(s) from DE "${dataExtensionKey}":\n\n${header}\n${separator}\n${rows.join('\n')}`;
}

async function createDataExtension(mc, { name, customerKey, description, fields, isSendable, sendableField }) {
    const body = {
        name,
        customerKey,
        fields: fields.map(f => ({
            name: f.name,
            fieldType: f.fieldType,
            maxLength: f.fieldType === 'Text' ? (f.maxLength || 100) : undefined,
            isPrimaryKey: f.isPrimaryKey || false,
            isRequired: f.isRequired || false,
            defaultValue: f.defaultValue || undefined,
        })),
    };
    if (description) body.description = description;
    if (isSendable) {
        body.isSendable = true;
        body.sendableDataExtensionField = { name: sendableField || 'EmailAddress', fieldType: 'EmailAddress' };
        body.sendableSubscriberField = { name: 'Subscriber Key' };
    }

    const result = await mc.rest('POST', '/hub/v1/dataevents', body);

    return `Data Extension created successfully!\n- Name: **${name}**\n- External Key: \`${customerKey}\`\n- Fields: ${fields.map(f => `${f.name} (${f.fieldType})`).join(', ')}\n- Sendable: ${isSendable ? 'Yes' : 'No'}`;
}

async function upsertDERows(mc, { dataExtensionKey, rows }) {
    if (!rows || rows.length === 0) return 'No rows provided to upsert.';
    if (rows.length > 50) return 'Error: Maximum 50 rows per upsert call. Please split into smaller batches.';

    const items = rows.map(row => ({ keys: row, values: row }));
    await mc.rest('POST', `/hub/v1/dataevents/key:${encodeURIComponent(dataExtensionKey)}/rowset`, items);

    return `Successfully upserted ${rows.length} row(s) into DE "${dataExtensionKey}".`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Subscriber handlers
// ═══════════════════════════════════════════════════════════════════════════════

async function getSubscriber(mc, { email, subscriberKey }) {
    const key = subscriberKey || email;
    if (!key) return 'Error: Provide either email or subscriberKey to look up a subscriber.';

    // Use SOAP — REST contacts/v1 may not be enabled
    const filterProp = email ? 'EmailAddress' : 'SubscriberKey';
    const filterVal = (email || subscriberKey).replace(/&/g, '&amp;').replace(/</g, '&lt;');

    const soapXml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <RetrieveRequest>
        <ObjectType>Subscriber</ObjectType>
        <Properties>SubscriberKey</Properties>
        <Properties>EmailAddress</Properties>
        <Properties>Status</Properties>
        <Properties>CreatedDate</Properties>
        <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <Property>${filterProp}</Property>
          <SimpleOperator>equals</SimpleOperator>
          <Value>${filterVal}</Value>
        </Filter>
      </RetrieveRequest>
    </RetrieveRequestMsg>`;

    const soapResult = await mc.soap('Retrieve', soapXml);
    const results = soapResult.match(/<Results[^>]*>[\s\S]*?<\/Results>/g) || [];

    if (results.length === 0) {
        return `No subscriber found for ${email ? `email "${email}"` : `key "${subscriberKey}"`}.`;
    }

    const r = results[0];
    const subKey = r.match(/<SubscriberKey>([^<]+)/)?.[1] || 'N/A';
    const subEmail = r.match(/<EmailAddress>([^<]+)/)?.[1] || 'N/A';
    const status = r.match(/<Status>([^<]+)/)?.[1] || 'N/A';
    const created = r.match(/<CreatedDate>([^<]+)/)?.[1]?.split('T')[0] || 'N/A';

    return `Subscriber found:\n- Key: \`${subKey}\`\n- Email: ${subEmail}\n- Status: ${status}\n- Created: ${created}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Content & Email handlers
// ═══════════════════════════════════════════════════════════════════════════════

async function listAssets(mc, { assetType, searchTerm, folderId, pageSize = 25 }) {
    const size = Math.min(pageSize || 25, 50);
    let path = `/asset/v1/content/assets?$pageSize=${size}`;

    const filters = [];
    if (assetType) {
        const typeMap = { htmlemail: 208, templatebasedemail: 209, textonlyemail: 210, template: 4, webpage: 205, contentblock: 220, image: 28, jsonmessage: 230 };
        const typeId = typeMap[assetType];
        if (typeId) filters.push(`assetType.id eq ${typeId}`);
    }
    if (searchTerm) filters.push(`name like '%${searchTerm.replace(/'/g, "''")}%'`);
    if (folderId) filters.push(`category.id eq ${folderId}`);
    if (filters.length) path += `&$filter=${encodeURIComponent(filters.join(' and '))}`;

    const result = await mc.rest('GET', path);
    const items = result.items || [];

    if (items.length === 0) {
        return 'No assets found' + (searchTerm ? ` matching "${searchTerm}"` : '') + '.';
    }

    const lines = items.map(a =>
        `- **${a.name}** (ID: ${a.id}, type: ${a.assetType?.name || '?'}) — modified ${a.modifiedDate?.split('T')[0] || 'N/A'}`
    );
    return `Found ${result.count || items.length} asset(s):\n${lines.join('\n')}`;
}

async function getEmailHtml(mc, { assetId }) {
    const asset = await mc.rest('GET', `/asset/v1/content/assets/${assetId}`);

    const html = asset.views?.html?.content
        || asset.content
        || null;

    if (!html) {
        return `Asset ${assetId} (${asset.name || 'unknown'}) has no HTML content. It may be a different asset type.`;
    }

    // Return structured so the executor can pass html to frontend via SSE
    return JSON.stringify({
        _type: 'email_html',
        assetId,
        name: asset.name,
        subject: asset.views?.subjectline?.content || asset.subject || '',
        html,
        modifiedDate: asset.modifiedDate,
    });
}

async function listEmails(mc, { searchTerm, folderId, pageSize = 25, page = 1 }) {
    const size = Math.min(pageSize || 25, 50);
    let path = `/asset/v1/content/assets?$pageSize=${size}&$page=${page}`;

    const filters = ['assetType.id eq 208']; // htmlemail
    if (searchTerm) filters.push(`name like '%${searchTerm.replace(/'/g, "''")}%'`);
    if (folderId) filters.push(`category.id eq ${folderId}`);
    path += `&$filter=${encodeURIComponent(filters.join(' and '))}`;
    path += '&$orderBy=modifiedDate%20desc';

    const result = await mc.rest('GET', path);
    const items = result.items || [];

    if (items.length === 0) {
        return 'No emails found' + (searchTerm ? ` matching "${searchTerm}"` : '') + '.';
    }

    const lines = items.map((a, i) =>
        `${i + 1}. **${a.name}** (ID: ${a.id}) — status: ${a.status?.name || '?'}, modified: ${a.modifiedDate?.split('T')[0] || 'N/A'}`
    );
    return `Found ${result.count || items.length} email(s):\n${lines.join('\n')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Send handlers
// ═══════════════════════════════════════════════════════════════════════════════

async function getSendSummary(mc, { sendId, sinceDaysAgo = 7 }) {
    // Use SOAP to retrieve send tracking data — REST messaging/v1 requires specific send definition type
    const days = Math.min(sinceDaysAgo || 7, 30);
    const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

    const filterXml = sendId
        ? `<Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <Property>ID</Property>
            <SimpleOperator>equals</SimpleOperator>
            <Value>${sendId}</Value>
          </Filter>`
        : `<Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <Property>SendDate</Property>
            <SimpleOperator>greaterThan</SimpleOperator>
            <Value>${sinceDate}</Value>
          </Filter>`;

    const soapXml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <RetrieveRequest>
        <ObjectType>Send</ObjectType>
        <Properties>ID</Properties>
        <Properties>EmailName</Properties>
        <Properties>Status</Properties>
        <Properties>SendDate</Properties>
        <Properties>NumberSent</Properties>
        <Properties>NumberDelivered</Properties>
        <Properties>UniqueOpens</Properties>
        <Properties>UniqueClicks</Properties>
        <Properties>HardBounces</Properties>
        <Properties>SoftBounces</Properties>
        <Properties>Unsubscribes</Properties>
        ${filterXml}
        <QueryAllAccounts>false</QueryAllAccounts>
      </RetrieveRequest>
    </RetrieveRequestMsg>`;

    const soapResult = await mc.soap('Retrieve', soapXml);
    const results = soapResult.match(/<Results[^>]*>[\s\S]*?<\/Results>/g) || [];

    if (results.length === 0) {
        return sendId
            ? `No send found with ID ${sendId}.`
            : `No email sends found in the last ${days} days.`;
    }

    const sends = results.slice(0, 25).map(r => {
        const name = r.match(/<EmailName>([^<]+)/)?.[1] || 'Unknown';
        const status = r.match(/<Status>([^<]+)/)?.[1] || '?';
        const date = r.match(/<SendDate>([^<]+)/)?.[1]?.split('T')[0] || 'N/A';
        const sent = r.match(/<NumberSent>([^<]+)/)?.[1] || '?';
        const delivered = r.match(/<NumberDelivered>([^<]+)/)?.[1] || '?';
        const opens = r.match(/<UniqueOpens>([^<]+)/)?.[1] || '0';
        const clicks = r.match(/<UniqueClicks>([^<]+)/)?.[1] || '0';
        const bounces = parseInt(r.match(/<HardBounces>([^<]+)/)?.[1] || '0') + parseInt(r.match(/<SoftBounces>([^<]+)/)?.[1] || '0');
        const unsubs = r.match(/<Unsubscribes>([^<]+)/)?.[1] || '0';
        const openRate = sent !== '?' && parseInt(sent) > 0 ? ((parseInt(opens) / parseInt(sent)) * 100).toFixed(1) : '?';
        const clickRate = sent !== '?' && parseInt(sent) > 0 ? ((parseInt(clicks) / parseInt(sent)) * 100).toFixed(1) : '?';
        return { name, status, date, sent, delivered, opens, clicks, bounces, unsubs, openRate, clickRate };
    });

    if (sendId && sends.length === 1) {
        const s = sends[0];
        return `Send details:\n- Email: **${s.name}**\n- Status: ${s.status}\n- Date: ${s.date}\n- Sent: ${s.sent}\n- Delivered: ${s.delivered}\n- Opens: ${s.opens} (${s.openRate}%)\n- Clicks: ${s.clicks} (${s.clickRate}%)\n- Bounces: ${s.bounces}\n- Unsubscribes: ${s.unsubs}`;
    }

    const header = '| Email | Date | Sent | Open Rate | Click Rate | Bounces | Unsubs |';
    const sep = '| --- | --- | --- | --- | --- | --- | --- |';
    const rows = sends.map(s =>
        `| ${s.name.substring(0, 40)} | ${s.date} | ${s.sent} | ${s.openRate}% | ${s.clickRate}% | ${s.bounces} | ${s.unsubs} |`
    );

    return `${sends.length} send(s) in the last ${days} days:\n\n${header}\n${sep}\n${rows.join('\n')}`;
}

function formatSendResult(s) {
    const stats = s.tracking || {};
    return `Send details:\n- Name: **${s.name || s.definitionKey || 'N/A'}**\n- Status: ${s.status?.name || s.status || 'N/A'}\n- Date: ${s.createdDate?.split('T')[0] || 'N/A'}\n- Opens: ${stats.opens ?? '?'}\n- Clicks: ${stats.clicks ?? '?'}\n- Bounces: ${stats.bounces ?? '?'}\n- Unsubscribes: ${stats.unsubscribes ?? '?'}`;
}

async function sendTestEmail(mc, { to, emailAssetId, html, subject }) {
    if (!to || to.length === 0) return 'Error: Provide at least one email address in the "to" array.';
    if (to.length > 5) return 'Error: Maximum 5 recipients for test sends.';
    if (!emailAssetId && !html) return 'Error: Provide either emailAssetId or html content to send.';

    let emailHtml = html;
    let emailSubject = subject || '[TEST] Preview';
    let emailName = 'Custom HTML';

    // If asset ID provided, fetch the HTML from Content Builder
    if (emailAssetId && !html) {
        const asset = await mc.rest('GET', `/asset/v1/content/assets/${emailAssetId}`);
        emailHtml = asset.views?.html?.content || asset.content;
        emailSubject = subject || `[TEST] ${asset.views?.subjectline?.content || asset.name || 'Preview'}`;
        emailName = asset.name || `Asset ${emailAssetId}`;
        if (!emailHtml) return `Error: Asset ${emailAssetId} has no HTML content.`;
    }

    // Return structured result — the server.js handler will use nodemailer
    // to actually send (we don't import nodemailer here to keep the module clean)
    return JSON.stringify({
        _type: 'test_send',
        to,
        subject: emailSubject,
        html: emailHtml,
        emailName,
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Journey handlers (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════════

async function listJourneys(mc, { status, nameFilter, pageSize = 25 }) {
    const size = Math.min(pageSize || 25, 50);
    let path = `/interaction/v1/interactions?$pageSize=${size}&$orderBy=modifiedDate%20desc`;

    if (status) path += `&status=${encodeURIComponent(status)}`;
    if (nameFilter) path += `&nameSearch=${encodeURIComponent(nameFilter)}`;

    const result = await mc.rest('GET', path);
    const items = result.items || [];

    if (items.length === 0) {
        return 'No journeys found' + (status ? ` with status "${status}"` : '') + '.';
    }

    const lines = items.map(j =>
        `- **${j.name}** (ID: \`${j.id}\`) — status: ${j.status || '?'}, modified: ${j.modifiedDate?.split('T')[0] || 'N/A'}`
    );
    return `Found ${result.count || items.length} journey(s):\n${lines.join('\n')}`;
}

async function getJourney(mc, { journeyId }) {
    const j = await mc.rest('GET', `/interaction/v1/interactions/${journeyId}`);

    const activities = (j.activities || []).map(a => `  - ${a.name} (${a.type})`).join('\n');

    return `Journey: **${j.name}**\n- ID: \`${j.id}\`\n- Status: ${j.status || 'N/A'}\n- Version: ${j.version || 'N/A'}\n- Created: ${j.createdDate?.split('T')[0] || 'N/A'}\n- Modified: ${j.modifiedDate?.split('T')[0] || 'N/A'}\n- Activities:\n${activities || '  (none)'}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Automation handlers (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════════

async function listAutomations(mc, { status, nameFilter }) {
    let path = '/automation/v1/automations/?$pageSize=25';

    const result = await mc.rest('GET', path);
    const items = result.items || [];

    if (items.length === 0) {
        return 'No automations found.';
    }

    // Filter client-side if nameFilter provided (API doesn't support name filter well)
    let filtered = items;
    if (nameFilter) {
        const lower = nameFilter.toLowerCase();
        filtered = items.filter(a => (a.name || '').toLowerCase().includes(lower));
    }
    if (status) {
        filtered = filtered.filter(a => (a.status || '').toLowerCase() === status.toLowerCase());
    }

    if (filtered.length === 0) {
        return 'No automations found matching your criteria.';
    }

    const lines = filtered.slice(0, 25).map(a =>
        `- **${a.name}** (status: ${a.status || '?'}, type: ${a.type || '?'}) — last run: ${a.lastRunTime?.split('T')[0] || 'never'}`
    );
    return `Found ${result.count || items.length} automation(s) total${filtered.length < items.length ? ` (${filtered.length} matching filter)` : ''}:\n${lines.join('\n')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Email Builder handlers
// ═══════════════════════════════════════════════════════════════════════════════

async function analyzeEmailTemplate(mc, { assetId }) {
    const asset = await mc.rest('GET', `/asset/v1/content/assets/${assetId}`);
    const html = asset.views?.html?.content || asset.content;
    if (!html) return `Asset ${assetId} has no HTML content.`;

    const manifest = analyzeTemplate(html);

    return `Template analyzed: **${asset.name}**\n` +
        `- Content blocks: ${manifest.contentBlockIds.length} (IDs: ${manifest.contentBlockIds.join(', ')})\n` +
        `- Data Extensions: ${manifest.dataExtensions.map(d => d.name).join(', ')}\n` +
        `- Variables: ${manifest.variables.length} field mappings\n` +
        `- Segments: ${manifest.variants.segments.join(', ') || 'none detected'}\n` +
        `- Header types: ${manifest.variants.headerTypes.join(', ') || 'single'}\n` +
        `- Block order: ${manifest.blockOrder.allBlocks.length} blocks in render section`;
}

async function buildEmailVariants(mc, { assetId, language, market, subscriberName, subscriberTier }) {
    // 1. Fetch the template
    const asset = await mc.rest('GET', `/asset/v1/content/assets/${assetId}`);
    const templateHtml = asset.views?.html?.content || asset.content;
    if (!templateHtml) return `Asset ${assetId} has no HTML content.`;

    // 2. Get the template shell (template_style.html from email_blocks)
    // For now, use a minimal shell — the full shell will be loaded from the KB
    const templateShell = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>{{CONTENT}}</body></html>';

    // 3. Run the full pipeline
    const progressLog = [];
    const { manifest, variants } = await buildCampaignEmails({
        templateHtml,
        mcClient: mc,
        templateShell,
        subscriber: {
            first_name: subscriberName || 'Valued Member',
            TierName: subscriberTier || 'Blue',
            miles_balance: '0',
        },
        options: {
            language: language || 'en',
            market: market || 'uk/english',
            onProgress: (phase, detail) => progressLog.push(`[${phase}] ${detail}`),
        },
    });

    const filenames = Object.keys(variants);

    return JSON.stringify({
        _type: 'email_build_result',
        emailName: asset.name,
        assetId,
        variantCount: filenames.length,
        variants: Object.fromEntries(
            filenames.map(f => [f, { sizeKb: (Buffer.byteLength(variants[f], 'utf8') / 1024).toFixed(1) }])
        ),
        manifest: {
            blocks: manifest.contentBlockIds.length,
            dataExtensions: manifest.dataExtensions.map(d => d.name),
            segments: manifest.variants.segments,
            headerTypes: manifest.variants.headerTypes,
        },
        progressLog,
        // Include full HTML for each variant (the server.js handler will decide what to do with it)
        htmlVariants: variants,
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit logging
// ═══════════════════════════════════════════════════════════════════════════════

async function logMCAudit(pool, toolName, input, result, elapsed) {
    try {
        const details = JSON.stringify({
            tool: toolName,
            input: sanitizeForLog(input),
            result: typeof result === 'string' ? result.substring(0, 500) : '(structured)',
            elapsed_ms: elapsed,
        });
        await pool.query(
            `INSERT INTO audit_log (event_type, department, agent_id, title, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['mc_operation', 'strategic', 'mc-architect', `MC: ${toolName}`, details.substring(0, 2000)]
        );
    } catch (err) {
        console.error('[MC Audit] Failed to log:', err.message);
    }
}

/** Remove sensitive data (emails, large HTML) from audit logs */
function sanitizeForLog(input) {
    if (!input || typeof input !== 'object') return input;
    const clean = { ...input };
    if (clean.html) clean.html = `(${clean.html.length} chars)`;
    if (clean.rows && Array.isArray(clean.rows)) clean.rows = `(${clean.rows.length} rows)`;
    return clean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Raw helpers (used by journey-builder — return response objects, not markdown)
// ═══════════════════════════════════════════════════════════════════════════════

export async function createDataExtensionRaw(mc, { name, customerKey, description, fields, folderId, isSendable, sendableField }) {
    // SFMC has no generic REST create-DE endpoint on most stacks — canonical path is SOAP Create
    // (same approach used by packages/core/campaign-builder duplicateDE).
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ck = customerKey || `de-${Date.now()}`;

    const fieldsXml = fields.map((f) => {
        const type = f.fieldType || f.type;
        let xml = `<Field><Name>${esc(f.name)}</Name><FieldType>${esc(type)}</FieldType>`;
        if ((type === 'Text' || type === 'Decimal') && f.maxLength) xml += `<MaxLength>${f.maxLength}</MaxLength>`;
        if (f.isPrimaryKey) xml += '<IsPrimaryKey>true</IsPrimaryKey>';
        if (f.isRequired) xml += '<IsRequired>true</IsRequired>';
        if (f.defaultValue) xml += `<DefaultValue>${esc(f.defaultValue)}</DefaultValue>`;
        xml += '</Field>';
        return xml;
    }).join('');

    let sendableXml = '';
    if (isSendable) {
        sendableXml = `<IsSendable>true</IsSendable><SendableDataExtensionField><Name>${esc(sendableField || 'EmailAddress')}</Name><FieldType>EmailAddress</FieldType></SendableDataExtensionField><SendableSubscriberField><Name>Subscriber Key</Name></SendableSubscriberField>`;
    }

    const inner = `<CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI"><Objects xsi:type="DataExtension" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Name>${esc(name)}</Name><CustomerKey>${esc(ck)}</CustomerKey>${folderId ? `<CategoryID>${folderId}</CategoryID>` : ''}${description ? `<Description>${esc(description)}</Description>` : ''}${sendableXml}<Fields>${fieldsXml}</Fields></Objects></CreateRequest>`;

    const soapResp = await mc.soap('Create', inner);
    const raw = typeof soapResp === 'string' ? soapResp : JSON.stringify(soapResp);
    const status = raw.match(/<StatusCode>([^<]+)/)?.[1];
    const statusMsg = raw.match(/<StatusMessage>([^<]+)/)?.[1] || '';
    if (status !== 'OK') {
        throw new Error(`SOAP Create DE failed for "${name}": status=${status || '?'} msg="${statusMsg}"`);
    }
    return { customerKey: ck, name };
}

// Cache folder lookups — these rarely change in an MC instance.
const folderRootCache = new Map();

/**
 * Find (or create) a named folder of a given contentType under the root.
 * Returns the folder's numeric ID. Caches results across calls.
 */
export async function ensureQueryFolder(mc, folderName = 'Journey Builder') {
    const cacheKey = `query:${folderName}`;
    if (folderRootCache.has(cacheKey)) return folderRootCache.get(cacheKey);

    // Step 1: find the root queryactivity folder (ParentFolder.ID = 0)
    const rootXml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
        <RetrieveRequest>
            <ObjectType>DataFolder</ObjectType>
            <Properties>ID</Properties><Properties>Name</Properties><Properties>ParentFolder.ID</Properties>
            <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                <Property>ContentType</Property><SimpleOperator>equals</SimpleOperator><Value>queryactivity</Value>
            </Filter>
        </RetrieveRequest>
    </RetrieveRequestMsg>`;
    const rootResp = await mc.soap('Retrieve', rootXml);
    const rootRaw = typeof rootResp === 'string' ? rootResp : JSON.stringify(rootResp);
    const blocks = rootRaw.split(/<Results[^>]*>/).slice(1).map((b) => b.split('</Results>')[0]);
    const folders = blocks.map((b) => ({
        id: b.match(/<ID>([^<]+)<\/ID>/)?.[1],
        name: b.match(/<Name>([^<]+)<\/Name>/)?.[1],
        parent: b.match(/<ParentFolder>[\s\S]*?<ID>([^<]+)<\/ID>/)?.[1] || '0',
    })).filter((f) => f.id);

    const root = folders.find((f) => f.parent === '0');
    if (!root) throw new Error('Could not locate queryactivity root folder');

    // Step 2: look for our named subfolder under root
    const existing = folders.find((f) => f.parent === root.id && f.name === folderName);
    if (existing) {
        folderRootCache.set(cacheKey, existing.id);
        return existing.id;
    }

    // Step 3: create it
    const createXml = `<CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
        <Objects xsi:type="DataFolder" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <Name>${folderName}</Name>
            <Description>Queries created by AgentOS Journey Builder</Description>
            <ContentType>queryactivity</ContentType>
            <IsActive>true</IsActive>
            <IsEditable>true</IsEditable>
            <AllowChildren>true</AllowChildren>
            <ParentFolder><ID>${root.id}</ID></ParentFolder>
        </Objects>
    </CreateRequest>`;
    const createResp = await mc.soap('Create', createXml);
    const createRaw = typeof createResp === 'string' ? createResp : JSON.stringify(createResp);
    const newId = createRaw.match(/<NewID>([^<]+)<\/NewID>/)?.[1];
    const status = createRaw.match(/<StatusCode>([^<]+)/)?.[1];
    if (status !== 'OK' || !newId) {
        const msg = createRaw.match(/<StatusMessage>([^<]+)/)?.[1] || 'unknown error';
        throw new Error(`Failed to create queryactivity folder "${folderName}": ${msg}`);
    }
    folderRootCache.set(cacheKey, newId);
    return newId;
}

/**
 * Create a DE-based audience event definition for a Journey entry source.
 * Returns the eventDefinitionKey (format: "DEAudience-{GUID}") needed by the
 * EmailAudience trigger so JB canvas can display the correct DE name.
 * On any error, returns null so the deploy can fallback to AutomationAudience.
 */
export async function createEventDefinition(mc, { name, dataExtensionKey }) {
    try {
        const body = {
            name,
            mode: 0,
            type: 'Audience',
            dataExtensionId: dataExtensionKey,
            isVisibleInPicker: false,
            isPlatformObject: false,
            category: { id: 3 },
        };
        const result = await mc.rest('POST', '/interaction/v1/eventDefinitions', body);
        return result.key || null; // "DEAudience-{GUID}"
    } catch (err) {
        console.warn('[journey deploy] eventDefinition creation failed (non-fatal):', err.message);
        return null;
    }
}

export async function createInteraction(mc, interactionJson) {
    // Dump the exact payload to /tmp for post-mortem debugging of 400 errors.
    try {
        const fs = await import('fs');
        const path = `/tmp/interaction-payload-${Date.now()}.json`;
        fs.writeFileSync(path, JSON.stringify(interactionJson, null, 2));
        console.log(`[journey deploy] interaction payload dumped to ${path}`);
    } catch {}
    return mc.rest('POST', '/interaction/v1/interactions', interactionJson);
}
