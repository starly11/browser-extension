import { BaseAdapter } from '../base/adapter.js';
import type { ChatHandle, Response, AdapterManifest } from '../../shared/types.js';

export class ChatGPTAdapter extends BaseAdapter {
  constructor() {
    super('chatgpt', '1.0.0');
  }

  async detect(): Promise<{ supported: boolean; providerId: string; version: string }> {
    try {
      // Check for ChatGPT-specific elements
      // These are the most stable selectors - using data attributes where possible
      const hasMessageInput = document.querySelector('[data-testid="chat-input"]') !== null ||
                              document.querySelector('textarea[placeholder*="Message"]') !== null ||
                              document.querySelector('#prompt-textarea') !== null;

      const hasSendButton = document.querySelector('[data-testid="send-button"]') !== null ||
                           document.querySelector('button[aria-label*="Send"]') !== null;

      if (hasMessageInput && hasSendButton) {
        return { supported: true, providerId: this.providerId, version: this.version };
      }

      return { supported: false, providerId: this.providerId, version: this.version };
    } catch (err) {
      return { supported: false, providerId: this.providerId, version: this.version };
    }
  }

  async newChat(): Promise<ChatHandle> {
    // Find the "New Chat" button
    const newChatButton = document.querySelector('[data-testid="new-chat-button"]') ||
                          document.querySelector('a[href*="/new"]') ||
                          document.querySelector('button[aria-label*="New Chat"]') ||
                          document.querySelector('button[aria-label*="New"]');

    if (newChatButton && newChatButton instanceof HTMLElement) {
      newChatButton.click();
    }

    // Wait for a new chat to initialize
    await this.waitForChatReady();

    return {
      tabId: this.getTabId(),
      chatId: this.generateChatId(),
      providerId: this.providerId,
    };
  }

  async sendPrompt(chatHandle: ChatHandle, text: string): Promise<void> {
    // Find the input
    const input = await this.findMessageInput();

    // Type the text
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Find and click send button
    const sendButton = await this.findSendButton();
    sendButton.click();

    // Wait for the message to appear
    await this.waitForMessageSent();
  }

  async attachFiles(chatHandle: ChatHandle, files: string[]): Promise<void> {
    // ChatGPT uses a file input for attachments
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (!fileInput) {
      throw new Error('File input not found - ChatGPT may have changed its UI');
    }

    // For Phase 1, we're attaching by file path
    // In reality, we'd need to read the file and create a File object
    // This is a placeholder
    console.log(`[ChatGPT Adapter] Attaching files: ${files.join(', ')}`);

    // We'll implement actual file attachment in Phase 2
  }

  async waitUntilFinished(chatHandle: ChatHandle): Promise<Response> {
    // Wait for the "Stop generating" button to disappear
    // or for the response to be complete
    return new Promise((resolve) => {
      const checkComplete = () => {
        const stopButton = document.querySelector('[data-testid="stop-generating"]') ||
                          document.querySelector('button[aria-label*="Stop generating"]');

        if (!stopButton) {
          // No stop button means generation is complete (or never started)
          const responseText = this.extractResponseText();
          resolve({
            text: responseText,
            attachments: [],
            status: 'complete',
          });
        } else {
          setTimeout(checkComplete, 500);
        }
      };

      // Start checking after a delay to let generation begin
      setTimeout(checkComplete, 1000);
    });
  }

  async readResponse(chatHandle: ChatHandle): Promise<Response> {
    return {
      text: this.extractResponseText(),
      attachments: [],
      status: 'complete',
    };
  }

  async stopGeneration(chatHandle: ChatHandle): Promise<void> {
    const stopButton = document.querySelector('[data-testid="stop-generating"]') ||
                       document.querySelector('button[aria-label*="Stop generating"]');

    if (stopButton && stopButton instanceof HTMLElement) {
      stopButton.click();
    }
  }

  async rotate(chatHandle: ChatHandle): Promise<ChatHandle> {
    // Create a new chat and return a new handle
    return this.newChat();
  }

  async healthCheck(): Promise<{ ok: boolean; reason?: string }> {
    try {
      const result = await this.detect();
      if (result.supported) {
        // Also check if we can find the input and send button
        const hasInput = await this.findMessageInput().then(() => true).catch(() => false);
        const hasSend = await this.findSendButton().then(() => true).catch(() => false);

        if (hasInput && hasSend) {
          return { ok: true };
        }

        return { ok: false, reason: 'Could not find message input or send button' };
      }
      return { ok: false, reason: 'ChatGPT not detected' };
    } catch (err: any) {
      return { ok: false, reason: err.message };
    }
  }

  // ==================== Private Helpers ====================

  private async findMessageInput(): Promise<HTMLInputElement | HTMLTextAreaElement> {
    const strategies = [
      () => document.querySelector('[data-testid="chat-input"]'),
      () => document.querySelector('textarea[placeholder*="Message"]'),
      () => document.querySelector('#prompt-textarea'),
      () => document.querySelector('div[contenteditable="true"][role="textbox"]'),
    ];

    const element = await this.findElementByStrategies(strategies);
    return element as HTMLInputElement | HTMLTextAreaElement;
  }

  private async findSendButton(): Promise<HTMLElement> {
    const strategies = [
      () => document.querySelector('[data-testid="send-button"]'),
      () => document.querySelector('button[aria-label*="Send"]'),
      () => document.querySelector('button[aria-label*="Send message"]'),
    ];

    const element = await this.findElementByStrategies(strategies);
    return element as HTMLElement;
  }

  private async waitForChatReady(): Promise<void> {
    // Wait for the chat input to be ready
    return new Promise((resolve) => {
      const checkInput = () => {
        const input = document.querySelector('textarea[placeholder*="Message"]') ||
                     document.querySelector('[data-testid="chat-input"]');
        if (input) {
          resolve();
        } else {
          setTimeout(checkInput, 200);
        }
      };
      setTimeout(checkInput, 500);
    });
  }

  private async waitForMessageSent(): Promise<void> {
    // Wait for the user's message to appear in the chat
    return new Promise((resolve) => {
      // Find the latest message
      const checkMessage = () => {
        const messages = document.querySelectorAll('[data-testid="message"]');
        if (messages.length > 0) {
          resolve();
        } else {
          setTimeout(checkMessage, 200);
        }
      };
      setTimeout(checkMessage, 500);
    });
  }

  private extractResponseText(): string {
    // Find the latest assistant message
    const messages = document.querySelectorAll('[data-message-role="assistant"]') ||
                     document.querySelectorAll('[data-testid="message"]');

    if (messages.length === 0) {
      return '';
    }

    const latestMessage = messages[messages.length - 1];
    return latestMessage.textContent || '';
  }

  private getTabId(): number {
    // In the content script, we can access the tab ID
    // This is a placeholder - will be injected
    return parseInt(window.location.search.match(/tab=(\d+)/)?.[1] || '0');
  }

  private generateChatId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
