import { ToolRequest, ToolResult } from '@shared/types';
import { executeFilesystemTool, getToolDefinitions as getFilesystemDefinitions } from './filesystem';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

export type ToolHandler = (request: ToolRequest) => Promise<ToolResult>;

class ToolEngine {
  private tools: Map<string, ToolHandler> = new Map();
  private definitions: Map<string, any> = new Map();

  constructor() {
    this.registerBuiltinTools();
  }

  private registerBuiltinTools() {
    // Register filesystem tools
    const fsDefinitions = getFilesystemDefinitions();
    for (const def of fsDefinitions) {
      this.definitions.set(def.name, def);
    }
    
    // Register the filesystem handler multiplexer
    this.tools.set('filesystem.read', executeFilesystemTool);
    this.tools.set('filesystem.write', executeFilesystemTool);
    this.tools.set('filesystem.list', executeFilesystemTool);
  }

  public registerTool(name: string, handler: ToolHandler, definition?: any) {
    if (this.tools.has(name)) {
      console.warn(`Tool "${name}" is already registered. Overwriting.`);
    }
    this.tools.set(name, handler);
    if (definition) {
      this.definitions.set(name, definition);
    }
  }

  public unregisterTool(name: string) {
    this.tools.delete(name);
    this.definitions.delete(name);
  }

  public async execute(request: ToolRequest): Promise<ToolResult> {
    const handler = this.tools.get(request.tool);
    
    if (!handler) {
      return {
        status: 'error',
        error: `Unknown tool: ${request.tool}`
      };
    }

    try {
      return await handler(request);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during tool execution';
      console.error(`Tool execution error for ${request.tool}:`, error);
      return {
        status: 'error',
        error: errorMessage
      };
    }
  }

  public getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.definitions.values());
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  public listTools(): string[] {
    return Array.from(this.tools.keys());
  }
}

// Singleton instance
export const toolEngine = new ToolEngine();
