import { ToolRequest, ToolResult } from '@shared/types';
export interface FileReadArgs {
    filePath: string;
}
export interface FileWriteArgs {
    filePath: string;
    content: string;
}
export interface FileListArgs {
    directoryPath: string;
}
export declare function executeFilesystemTool(request: ToolRequest): Promise<ToolResult>;
export declare function getToolDefinitions(): ({
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            filePath: {
                type: string;
                description: string;
            };
            content?: undefined;
            directoryPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            filePath: {
                type: string;
                description: string;
            };
            content: {
                type: string;
                description: string;
            };
            directoryPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            directoryPath: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            content?: undefined;
        };
        required: string[];
    };
})[];
//# sourceMappingURL=filesystem.d.ts.map