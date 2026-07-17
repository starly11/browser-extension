import { ToolRequest, ToolResult } from '@shared/types';
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: any;
}
export type ToolHandler = (request: ToolRequest) => Promise<ToolResult>;
declare class ToolEngine {
    private tools;
    private definitions;
    constructor();
    private registerBuiltinTools;
    registerTool(name: string, handler: ToolHandler, definition?: any): void;
    unregisterTool(name: string): void;
    execute(request: ToolRequest): Promise<ToolResult>;
    getToolDefinitions(): ToolDefinition[];
    hasTool(name: string): boolean;
    listTools(): string[];
}
export declare const toolEngine: ToolEngine;
export {};
//# sourceMappingURL=index.d.ts.map