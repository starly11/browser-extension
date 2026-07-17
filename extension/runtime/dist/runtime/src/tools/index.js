"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolEngine = void 0;
const filesystem_1 = require("./filesystem");
class ToolEngine {
    tools = new Map();
    definitions = new Map();
    constructor() {
        this.registerBuiltinTools();
    }
    registerBuiltinTools() {
        // Register filesystem tools
        const fsDefinitions = (0, filesystem_1.getToolDefinitions)();
        for (const def of fsDefinitions) {
            this.definitions.set(def.name, def);
        }
        // Register the filesystem handler multiplexer
        this.tools.set('filesystem.read', filesystem_1.executeFilesystemTool);
        this.tools.set('filesystem.write', filesystem_1.executeFilesystemTool);
        this.tools.set('filesystem.list', filesystem_1.executeFilesystemTool);
    }
    registerTool(name, handler, definition) {
        if (this.tools.has(name)) {
            console.warn(`Tool "${name}" is already registered. Overwriting.`);
        }
        this.tools.set(name, handler);
        if (definition) {
            this.definitions.set(name, definition);
        }
    }
    unregisterTool(name) {
        this.tools.delete(name);
        this.definitions.delete(name);
    }
    async execute(request) {
        const handler = this.tools.get(request.tool);
        if (!handler) {
            return {
                status: 'error',
                error: `Unknown tool: ${request.tool}`
            };
        }
        try {
            return await handler(request);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during tool execution';
            console.error(`Tool execution error for ${request.tool}:`, error);
            return {
                status: 'error',
                error: errorMessage
            };
        }
    }
    getToolDefinitions() {
        return Array.from(this.definitions.values());
    }
    hasTool(name) {
        return this.tools.has(name);
    }
    listTools() {
        return Array.from(this.tools.keys());
    }
}
// Singleton instance
exports.toolEngine = new ToolEngine();
//# sourceMappingURL=index.js.map