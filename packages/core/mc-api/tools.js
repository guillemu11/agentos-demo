/**
 * Marketing Cloud Tool Definitions
 *
 * Each tool follows the Anthropic tool_use schema format:
 *   { name, description, input_schema: { type: 'object', properties, required } }
 *
 * Grouped by domain. Phase 1 = MVP tools, Phase 2 = full coverage.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 1 — MVP Tools
// ═══════════════════════════════════════════════════════════════════════════════

const DATA_EXTENSION_TOOLS = [
    {
        name: 'mc_list_data_extensions',
        description: 'List Data Extensions in the Marketing Cloud account. Optionally filter by name or folder.',
        input_schema: {
            type: 'object',
            properties: {
                nameFilter: { type: 'string', description: 'Filter DEs whose name contains this text (case-insensitive)' },
                pageSize: { type: 'integer', description: 'Max results to return (default 25, max 50)' },
            },
        },
    },
    {
        name: 'mc_query_data_extension',
        description: 'Query rows from a Data Extension by its external key. Supports simple equality filters and field selection.',
        input_schema: {
            type: 'object',
            properties: {
                dataExtensionKey: { type: 'string', description: 'External key of the Data Extension' },
                filter: { type: 'string', description: 'Simple filter like "EmailAddress eq \'user@test.com\'" (OData $filter syntax)' },
                fields: { type: 'array', items: { type: 'string' }, description: 'Specific fields to return (omit for all)' },
                top: { type: 'integer', description: 'Max rows to return (default 25, max 100)' },
                orderBy: { type: 'string', description: 'Field to sort by (e.g. "CreatedDate desc")' },
            },
            required: ['dataExtensionKey'],
        },
    },
    {
        name: 'mc_create_data_extension',
        description: 'Create a new Data Extension with typed fields. Returns the external key on success.',
        input_schema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Display name of the DE' },
                customerKey: { type: 'string', description: 'Unique external key (no spaces, use underscores)' },
                description: { type: 'string', description: 'Optional description' },
                fields: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            fieldType: { type: 'string', enum: ['Text', 'Number', 'Date', 'Boolean', 'EmailAddress', 'Phone', 'Decimal', 'Locale'] },
                            maxLength: { type: 'integer', description: 'Max length for Text fields (default 100)' },
                            isPrimaryKey: { type: 'boolean' },
                            isRequired: { type: 'boolean' },
                            defaultValue: { type: 'string' },
                        },
                        required: ['name', 'fieldType'],
                    },
                    description: 'Array of field definitions',
                },
                isSendable: { type: 'boolean', description: 'Whether this DE can be used as a sendable audience' },
                sendableField: { type: 'string', description: 'Field name for sendable relationship (usually EmailAddress)' },
            },
            required: ['name', 'customerKey', 'fields'],
        },
    },
    {
        name: 'mc_upsert_data_extension_rows',
        description: 'Insert or update rows in a Data Extension. Upserts on primary key match.',
        input_schema: {
            type: 'object',
            properties: {
                dataExtensionKey: { type: 'string', description: 'External key of the DE' },
                rows: {
                    type: 'array',
                    items: { type: 'object', description: 'Row object with field name/value pairs' },
                    description: 'Array of row objects to upsert (max 50 per call)',
                },
            },
            required: ['dataExtensionKey', 'rows'],
        },
    },
];

const SUBSCRIBER_TOOLS = [
    {
        name: 'mc_get_subscriber',
        description: 'Look up a subscriber by email address or subscriber key. Returns profile info and subscription status.',
        input_schema: {
            type: 'object',
            properties: {
                email: { type: 'string', description: 'Email address to search for' },
                subscriberKey: { type: 'string', description: 'Subscriber key (if different from email)' },
            },
        },
    },
];

const CONTENT_TOOLS = [
    {
        name: 'mc_list_assets',
        description: 'List Content Builder assets filtered by type and/or search term. Returns asset names, IDs, and metadata.',
        input_schema: {
            type: 'object',
            properties: {
                assetType: {
                    type: 'string',
                    description: 'Asset type to filter by',
                    enum: ['htmlemail', 'templatebasedemail', 'textonlyemail', 'template', 'webpage', 'contentblock', 'image', 'jsonmessage'],
                },
                searchTerm: { type: 'string', description: 'Search term to match in asset name or description' },
                folderId: { type: 'integer', description: 'Restrict to a specific Content Builder folder' },
                pageSize: { type: 'integer', description: 'Results per page (default 25, max 50)' },
            },
        },
    },
    {
        name: 'mc_get_email_html',
        description: 'Retrieve the full HTML content of an email asset from Content Builder by its ID. Use this to preview or inspect emails from Marketing Cloud.',
        input_schema: {
            type: 'object',
            properties: {
                assetId: { type: 'integer', description: 'The Content Builder asset ID of the email' },
            },
            required: ['assetId'],
        },
    },
    {
        name: 'mc_list_emails',
        description: 'List HTML email assets in Content Builder. Returns name, ID, status, dates. Use to browse emails before opening one.',
        input_schema: {
            type: 'object',
            properties: {
                searchTerm: { type: 'string', description: 'Filter emails by name' },
                folderId: { type: 'integer', description: 'Restrict to a Content Builder folder' },
                pageSize: { type: 'integer', description: 'Results per page (default 25, max 50)' },
                page: { type: 'integer', description: 'Page number (default 1)' },
            },
        },
    },
];

const SEND_TOOLS = [
    {
        name: 'mc_get_send_summary',
        description: 'Get email send performance metrics (opens, clicks, bounces, unsubs) for recent sends or a specific send ID.',
        input_schema: {
            type: 'object',
            properties: {
                sendId: { type: 'integer', description: 'Specific send ID to get metrics for' },
                sinceDaysAgo: { type: 'integer', description: 'Get sends from the last N days (default 7, max 30)' },
            },
        },
    },
    {
        name: 'mc_send_test_email',
        description: 'Send a test email to one or more addresses. Can send an existing MC email by ID or custom HTML. ALWAYS confirm with the user before sending.',
        input_schema: {
            type: 'object',
            properties: {
                to: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of email addresses to send the test to (max 5)',
                },
                emailAssetId: { type: 'integer', description: 'Content Builder asset ID of the email to send (alternative to html)' },
                html: { type: 'string', description: 'Raw HTML to send (alternative to emailAssetId)' },
                subject: { type: 'string', description: 'Email subject line (default: "[TEST] Preview")' },
            },
            required: ['to'],
        },
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 2 — Journey & Automation Tools (added later)
// ═══════════════════════════════════════════════════════════════════════════════

const JOURNEY_TOOLS = [
    {
        name: 'mc_list_journeys',
        description: 'List Journey Builder journeys with their status, entry counts, and last modified date.',
        input_schema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['Draft', 'Running', 'Stopped', 'Scheduled'], description: 'Filter by journey status' },
                nameFilter: { type: 'string', description: 'Filter by name (contains match)' },
                pageSize: { type: 'integer', description: 'Results per page (default 25, max 50)' },
            },
        },
    },
    {
        name: 'mc_get_journey',
        description: 'Get full details of a specific journey including activities, entry criteria, and performance metrics.',
        input_schema: {
            type: 'object',
            properties: {
                journeyId: { type: 'string', description: 'Journey ID (GUID)' },
            },
            required: ['journeyId'],
        },
    },
];

const AUTOMATION_TOOLS = [
    {
        name: 'mc_list_automations',
        description: 'List Automation Studio automations with status and schedule info.',
        input_schema: {
            type: 'object',
            properties: {
                status: { type: 'string', description: 'Filter by status' },
                nameFilter: { type: 'string', description: 'Filter by name' },
            },
        },
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Email Builder Tools
// ═══════════════════════════════════════════════════════════════════════════════

const EMAIL_BUILDER_TOOLS = [
    {
        name: 'mc_analyze_email_template',
        description: 'Analyze an AMPscript email template to extract its structure: content block IDs, data extensions, variables, segments, and block order. This is Phase 1 of the email builder pipeline. Returns a campaign manifest.',
        input_schema: {
            type: 'object',
            properties: {
                assetId: { type: 'integer', description: 'Content Builder asset ID of the email template to analyze' },
            },
            required: ['assetId'],
        },
    },
    {
        name: 'mc_build_email_variants',
        description: 'Build all renderable HTML email variants from an AMPscript template. Runs the full 3-phase pipeline: analyze template → fetch MC data (blocks, DEs, images) → render static HTML per segment/header variant. Returns file paths of generated variants.',
        input_schema: {
            type: 'object',
            properties: {
                assetId: { type: 'integer', description: 'Content Builder asset ID of the email template' },
                language: { type: 'string', description: 'Language code for content (default: en)' },
                market: { type: 'string', description: 'Market for URL replacement (default: uk/english)' },
                subscriberName: { type: 'string', description: 'Preview subscriber first name (default: Valued Member)' },
                subscriberTier: { type: 'string', description: 'Preview subscriber tier (default: Blue)' },
            },
            required: ['assetId'],
        },
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

/** All MVP tools (Phase 1) */
export const MC_MVP_TOOLS = [
    ...DATA_EXTENSION_TOOLS,
    ...SUBSCRIBER_TOOLS,
    ...CONTENT_TOOLS,
    ...SEND_TOOLS,
];

/** Journey + Automation tools (Phase 2) */
export const MC_JOURNEY_TOOLS = [
    ...JOURNEY_TOOLS,
    ...AUTOMATION_TOOLS,
];

/** Email Builder tools */
export const MC_EMAIL_BUILDER_TOOLS = EMAIL_BUILDER_TOOLS;

/** All MC tools combined */
export const MC_ALL_TOOLS = [
    ...MC_MVP_TOOLS,
    ...MC_JOURNEY_TOOLS,
    ...EMAIL_BUILDER_TOOLS,
];

/** Get tool names as a flat array (useful for profile registration) */
export function getMCToolNames() {
    return MC_ALL_TOOLS.map(t => t.name);
}
