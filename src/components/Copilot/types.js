/**
 * ============================================================================
 *  MAHAMERU COPILOT — Rich Response Protocol Type Definitions
 *  These are the TypeScript/JS type definitions for the Mahameru Rich
 *  Response Protocol used to communicate structured data between the
 *  LLM Gateway (Port 8500) and the SolidJS frontend.
 *
 *  All components have a "type" discriminator that the frontend renderer
 *  switch-case uses to decide how to render each component.
 * ============================================================================
 */

/**
 * @typedef {Object} RichResponseComponent
 * @property {"markdown"|"chart"|"map"|"table"|"sse_stream"|"card"|"cards"} type
 * @property {Object} data - Component-specific payload
 */

/**
 * Response from /api/copilot/chat
 * @typedef {Object} CopilotChatResponse
 * @property {string} response_id - UUID for this response
 * @property {string} message - Main text response from LLM
 * @property {Array<RichResponseComponent>} components - Array of renderable components
 * @property {number} latency_ms - Request processing time in milliseconds
 * @property {string} model - Model used (e.g. "gpt-4o", "echo-router")
 * @property {Array<string>} tool_calls_made - Names of tools called
 */

/**
 * @typedef {Object} MarkdownComponent
 * @property {"markdown"} type
 * @property {string} data - Markdown text content (can include KaTeX math)
 */

/**
 * @typedef {Object} EChartsComponent
 * @property {"chart"} type
 * @property {"echarts"} engine
 * @property {Object} options - Full ECharts configuration object
 * @property {string} [options.title.text] - Chart title
 * @property {Array} [options.xAxis.data] - X-axis labels
 * @property {Array} [options.series] - ECharts series array
 * @property {boolean} [options.darkMode] - Dark mode flag
 * @property {string} [options.backgroundColor] - Background color
 */

/**
 * @typedef {Object} LeafletMapComponent
 * @property {"map"} type
 * @property {"leaflet"} engine
 * @property {Object} geojson - GeoJSON FeatureCollection
 * @property {Array<number>} center - [lat, lng] center coordinates
 * @property {number} zoom - Zoom level (1-18)
 * @property {Object} [options] - Leaflet map options
 */

/**
 * @typedef {Object} TableComponent
 * @property {"table"} type
 * @property {Array<string>} headers - Column headers
 * @property {Array<Array<string>>} rows - Table data rows
 * @property {string} [title] - Optional table title
 */

/**
 * @typedef {Object} SSEStreamComponent
 * @property {"sse_stream"} type
 * @property {string} endpoint - SSE endpoint URL
 * @property {string} [research_id] - Research pipeline ID
 */

/**
 * @typedef {Object} CardComponent
 * @property {"card"} type
 * @property {string} title - Card title
 * @property {string} [subtitle] - Card subtitle
 * @property {Array<{label: string, value: string}>} fields - Key-value fields
 * @property {string} [color] - Accent color
 */

/**
 * @typedef {Object} CardsComponent
 * @property {"cards"} type
 * @property {Array<CardComponent>} cards - Array of card definitions
 */

/**
 * Slash command definition
 * @typedef {Object} SlashCommand
 * @property {string} command - Command name with slash (e.g. "/ta")
 * @property {string} description - Human-readable description
 * @property {string} usage - Usage syntax
 * @property {string} example - Example usage
 */

/**
 * Response from /api/copilot/slash
 * @typedef {Object} SlashCommandResponse
 * @property {string} response_id - UUID
 * @property {string} command - Command that was executed
 * @property {string} message - Status message
 * @property {Array<RichResponseComponent>} components - Response components
 */

/**
 * SSE event types for research pipeline streaming
 * @readonly
 * @enum {string}
 */
export const SSEEventType = Object.freeze({
    META: 'meta',
    STAGE_START: 'stage_start',
    CHUNK: 'chunk',
    STAGE_COMPLETE: 'stage_complete',
    COMPLETE: 'complete',
    ERROR: 'error',
    DONE: 'done',
    THINKING: 'thinking',
    TOOLS_COMPLETE: 'tools_complete',
});

/**
 * SSE stage event payload
 * @typedef {Object} SSEStageEvent
 * @property {string} stage - Stage identifier (e.g. "Stage 1/7")
 * @property {string} name - Stage name
 * @property {string} description - Stage description
 * @property {number} progress - Progress percentage (0-100)
 */

/**
 * SSE chunk event payload
 * @typedef {Object} SSEMarkdownChunk
 * @property {string} stage - Current stage
 * @property {string} content - Markdown content chunk
 * @property {number} progress - Progress percentage
 */

/**
 * SSE complete event payload
 * @typedef {Object} SSEPipelineComplete
 * @property {string} research_id - Research ID
 * @property {string} symbols - Analyzed symbols
 * @property {string} report - Final markdown report
 * @property {number} progress - 100
 */

/**
 * SSE error event payload
 * @typedef {Object} SSEError
 * @property {string} error - Error message
 */

export default {
    CopilotChatResponse: {},
    RichResponseComponent: {},
    SlashCommand: {},
    SSEEventType,
};
