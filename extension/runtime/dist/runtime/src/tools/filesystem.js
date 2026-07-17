"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeFilesystemTool = executeFilesystemTool;
exports.getToolDefinitions = getToolDefinitions;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Security: Sandbox to a specific directory to prevent arbitrary file access
const SANDBOX_ROOT = process.env.FILESYSTEM_SANDBOX || path.join(process.cwd(), 'sandbox');
/**
 * Resolves a user-provided path against the sandbox root.
 * Prevents directory traversal attacks (e.g., ../../../etc/passwd).
 */
function resolveSandboxPath(userPath) {
    const normalizedUserPath = path.normalize(userPath);
    const resolvedPath = path.resolve(SANDBOX_ROOT, normalizedUserPath);
    // Ensure the resolved path is within the sandbox
    if (!resolvedPath.startsWith(SANDBOX_ROOT)) {
        throw new Error(`Access denied: Path "${userPath}" resolves outside the sandbox.`);
    }
    return resolvedPath;
}
async function executeFilesystemTool(request) {
    const params = request.params;
    try {
        switch (request.tool) {
            case 'filesystem.read': {
                const { filePath } = params;
                if (!filePath) {
                    return { status: 'error', error: 'Missing required argument: filePath' };
                }
                const fullPath = resolveSandboxPath(filePath);
                if (!fs.existsSync(fullPath)) {
                    return { status: 'error', error: `File not found: ${filePath}` };
                }
                const content = fs.readFileSync(fullPath, 'utf-8');
                return {
                    status: 'success',
                    data: { content, filePath, size: content.length }
                };
            }
            case 'filesystem.write': {
                const { filePath, content } = params;
                if (!filePath || content === undefined) {
                    return { status: 'error', error: 'Missing required arguments: filePath or content' };
                }
                const fullPath = resolveSandboxPath(filePath);
                // Ensure parent directory exists
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(fullPath, content, 'utf-8');
                return {
                    status: 'success',
                    data: { filePath, written: true, size: content.length }
                };
            }
            case 'filesystem.list': {
                const { directoryPath } = params;
                if (!directoryPath) {
                    return { status: 'error', error: 'Missing required argument: directoryPath' };
                }
                const fullPath = resolveSandboxPath(directoryPath);
                if (!fs.existsSync(fullPath)) {
                    return { status: 'error', error: `Directory not found: ${directoryPath}` };
                }
                if (!fs.statSync(fullPath).isDirectory()) {
                    return { status: 'error', error: `Not a directory: ${directoryPath}` };
                }
                const entries = fs.readdirSync(fullPath, { withFileTypes: true });
                const files = entries
                    .filter(e => e.isFile())
                    .map(e => e.name);
                const directories = entries
                    .filter(e => e.isDirectory())
                    .map(e => e.name);
                return {
                    status: 'success',
                    data: { directoryPath, files, directories }
                };
            }
            default:
                return { status: 'error', error: `Unknown filesystem tool: ${request.tool}` };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return { status: 'error', error: errorMessage };
    }
}
function getToolDefinitions() {
    return [
        {
            name: 'filesystem.read',
            description: 'Read the contents of a file within the sandbox.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Relative path to the file within the sandbox.'
                    }
                },
                required: ['filePath']
            }
        },
        {
            name: 'filesystem.write',
            description: 'Write content to a file within the sandbox.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Relative path to the file within the sandbox.'
                    },
                    content: {
                        type: 'string',
                        description: 'Content to write to the file.'
                    }
                },
                required: ['filePath', 'content']
            }
        },
        {
            name: 'filesystem.list',
            description: 'List files and directories within a sandbox directory.',
            parameters: {
                type: 'object',
                properties: {
                    directoryPath: {
                        type: 'string',
                        description: 'Relative path to the directory within the sandbox.'
                    }
                },
                required: ['directoryPath']
            }
        }
    ];
}
//# sourceMappingURL=filesystem.js.map