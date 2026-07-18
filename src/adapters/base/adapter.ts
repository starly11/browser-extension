import type { BrowserAdapter, ChatHandle, Response, AdapterManifest } from '../../shared/types.js';

export abstract class BaseAdapter implements BrowserAdapter {
  protected providerId: string;
  protected version: string;

  constructor(providerId: string, version: string) {
    this.providerId = providerId;
    this.version = version;
  }

  abstract detect(): Promise<{ supported: boolean; providerId: string; version: string }>;
  abstract newChat(): Promise<ChatHandle>;
  abstract sendPrompt(chatHandle: ChatHandle, text: string): Promise<void>;
  abstract attachFiles(chatHandle: ChatHandle, files: string[]): Promise<void>;
  abstract waitUntilFinished(chatHandle: ChatHandle): Promise<Response>;
  abstract readResponse(chatHandle: ChatHandle): Promise<Response>;
  abstract stopGeneration(chatHandle: ChatHandle): Promise<void>;
  abstract rotate(chatHandle: ChatHandle): Promise<ChatHandle>;
  abstract healthCheck(): Promise<{ ok: boolean; reason?: string }>;

  getManifest(): AdapterManifest {
    return {
      providerId: this.providerId,
      version: this.version,
      supportedCapabilities: ['sendPrompt', 'attachFiles', 'readResponse'],
      unsupportedCapabilities: [],
    };
  }

  // Helper: Run strategy chain for element finding
  protected async findElementByStrategies(strategies: (() => Element | null)[]): Promise<Element> {
    for (const strategy of strategies) {
      const element = strategy();
      if (element) {
        return element;
      }
    }
    throw new Error('No strategy found the element');
  }

  // Helper: Debounce
  protected debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
}
