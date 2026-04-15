import { Component, OnInit, OnDestroy, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../services/socket.service';

/**
 * Example component demonstrating Socket.IO service usage
 * 
 * Features demonstrated:
 * - Connecting to a Socket.IO server
 * - Sending events
 * - Listening to events
 * - Displaying connection status
 * - Sending and receiving messages
 */
@Component({
  selector: 'app-socket-example',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="socket-example-container">
      <div class="header">
        <h2>Socket.IO Client Example</h2>
        <div class="status" [class.connected]="socketService.getIsConnected()" [class.disconnected]="!socketService.getIsConnected()">
          <span class="indicator"></span>
          {{ socketService.getIsConnected() ? 'Connected' : 'Disconnected' }}
        </div>
      </div>

      <div class="connection-section">
        <h3>Connection</h3>
        <div class="input-group">
          <input 
            type="text" 
            placeholder="Server URL (e.g., http://localhost:3000)"
            [(ngModel)]="serverUrl"
            [disabled]="socketService.getIsConnected()"
            class="input"
          />
          <button 
            (click)="connectToServer()"
            [disabled]="socketService.getIsConnected()"
            class="btn btn-primary"
          >
            Connect
          </button>
          <button 
            (click)="disconnectFromServer()"
            [disabled]="!socketService.getIsConnected()"
            class="btn btn-danger"
          >
            Disconnect
          </button>
        </div>
        <div *ngIf="socketService.getConnectionError()" class="error">
          {{ socketService.getConnectionError() }}
        </div>
      </div>

      <div class="messaging-section" *ngIf="socketService.getIsConnected()">
        <h3>Send Message</h3>
        <div class="input-group">
          <input 
            type="text" 
            placeholder="Event name (e.g., 'message')"
            [(ngModel)]="eventName"
            class="input"
          />
          <input 
            type="text" 
            placeholder="Message data (e.g., Hello World)"
            [(ngModel)]="messageData"
            class="input"
          />
          <button (click)="sendMessage()" class="btn btn-success">
            Send
          </button>
        </div>
      </div>

      <div class="listener-section" *ngIf="socketService.getIsConnected()">
        <h3>Event Listeners</h3>
        <div class="input-group">
          <input 
            type="text" 
            placeholder="Event to listen for (e.g., 'response')"
            [(ngModel)]="listenerEventName"
            class="input"
          />
          <button (click)="addListener()" class="btn btn-info">
            Start Listening
          </button>
        </div>
        <div class="listeners-list">
          <strong>Active Listeners:</strong>
          <ul>
            <li *ngFor="let listener of activeListeners">
              {{ listener }}
              <button (click)="removeListener(listener)" class="btn-small">Remove</button>
            </li>
          </ul>
          <p *ngIf="activeListeners.length === 0" class="empty">No active listeners</p>
        </div>
      </div>

      <div class="messages-section">
        <h3>Messages Log</h3>
        <div class="messages-box">
          <div *ngFor="let message of messages" class="message" [class]="message.type">
            <span class="timestamp">{{ message.timestamp }}</span>
            <span class="event">{{ message.event }}</span>
            <span class="data">{{ message.data }}</span>
          </div>
          <p *ngIf="messages.length === 0" class="empty">No messages yet</p>
        </div>
        <button (click)="clearMessages()" class="btn btn-secondary" *ngIf="messages.length > 0">
          Clear
        </button>
      </div>
    </div>
  `,
  styles: [`
    .socket-example-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #ddd;
    }

    .header h2 {
      margin: 0;
      color: #333;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }

    .status.connected {
      background: #d4edda;
      color: #155724;
    }

    .status.disconnected {
      background: #f8d7da;
      color: #721c24;
    }

    .indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .connection-section,
    .messaging-section,
    .listener-section,
    .messages-section {
      margin-bottom: 20px;
      padding: 15px;
      background: white;
      border-radius: 6px;
      border: 1px solid #ddd;
    }

    .connection-section h3,
    .messaging-section h3,
    .listener-section h3,
    .messages-section h3 {
      margin-top: 0;
      color: #333;
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
    }

    .input-group {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    .input {
      flex: 1;
      min-width: 150px;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .input:disabled {
      background: #f0f0f0;
      cursor: not-allowed;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #c82333;
    }

    .btn-success {
      background: #28a745;
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: #218838;
    }

    .btn-info {
      background: #17a2b8;
      color: white;
    }

    .btn-info:hover:not(:disabled) {
      background: #138496;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #5a6268;
    }

    .btn-small {
      padding: 4px 8px;
      font-size: 12px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      margin-left: 8px;
    }

    .btn-small:hover {
      background: #c82333;
    }

    .error {
      padding: 10px;
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      color: #721c24;
      font-size: 14px;
    }

    .listeners-list {
      margin-top: 10px;
      padding: 10px;
      background: #f9f9f9;
      border-radius: 4px;
    }

    .listeners-list ul {
      list-style: none;
      padding: 0;
      margin: 8px 0 0 0;
    }

    .listeners-list li {
      padding: 6px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 3px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .messages-box {
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 4px;
      max-height: 300px;
      overflow-y: auto;
      padding: 10px;
      margin-bottom: 10px;
    }

    .message {
      padding: 8px;
      margin-bottom: 6px;
      background: white;
      border-left: 4px solid #ddd;
      border-radius: 2px;
      font-size: 12px;
      font-family: monospace;
    }

    .message.sent {
      border-left-color: #28a745;
      background: #f0fdf4;
    }

    .message.received {
      border-left-color: #17a2b8;
      background: #f0feff;
    }

    .message.error {
      border-left-color: #dc3545;
      background: #fff5f5;
    }

    .timestamp {
      color: #666;
      font-weight: bold;
      margin-right: 8px;
    }

    .event {
      color: #007bff;
      font-weight: bold;
      margin-right: 8px;
    }

    .data {
      color: #333;
    }

    .empty {
      text-align: center;
      color: #999;
      padding: 20px;
      margin: 0;
    }
  `]
})
export class SocketExampleComponent implements OnInit, OnDestroy {
  serverUrl = 'http://localhost:3000';
  eventName = 'message';
  messageData = '';
  listenerEventName = '';
  activeListeners = signal<string[]>([]);
  messages = signal<Array<{ timestamp: string; event: string; data: string; type: 'sent' | 'received' | 'error' }>>([]);

  private unsubscribeFunctions = new Map<string, () => void>();

  constructor(protected socketService: SocketService) {}

  ngOnInit() {
    // Set up effect to react to connection changes
    effect(() => {
      const isConnected = this.socketService.getIsConnected();
      if (isConnected) {
        this.addMessage('System', 'Connected to server', 'received');
      }
    });
  }

  connectToServer() {
    if (!this.serverUrl) {
      this.addMessage('Error', 'Please enter a server URL', 'error');
      return;
    }

    this.socketService.connect(this.serverUrl);
  }

  disconnectFromServer() {
    this.socketService.disconnect();
    this.addMessage('System', 'Disconnected from server', 'received');
    this.activeListeners.set([]);
  }

  sendMessage() {
    if (!this.eventName || !this.messageData) {
      this.addMessage('Error', 'Please enter event name and message data', 'error');
      return;
    }

    try {
      const data = JSON.parse(this.messageData);
      this.socketService.emit(this.eventName, data);
      this.addMessage(this.eventName, JSON.stringify(data), 'sent');
      this.messageData = '';
    } catch {
      // Try to send as string if not valid JSON
      this.socketService.emit(this.eventName, this.messageData);
      this.addMessage(this.eventName, this.messageData, 'sent');
      this.messageData = '';
    }
  }

  addListener() {
    if (!this.listenerEventName) {
      this.addMessage('Error', 'Please enter an event name', 'error');
      return;
    }

    if (this.unsubscribeFunctions.has(this.listenerEventName)) {
      this.addMessage('Error', `Already listening to '${this.listenerEventName}'`, 'error');
      return;
    }

    const unsubscribe = this.socketService.on(this.listenerEventName, (data) => {
      this.addMessage(this.listenerEventName, JSON.stringify(data), 'received');
    });

    this.unsubscribeFunctions.set(this.listenerEventName, unsubscribe);
    this.activeListeners.set([...this.activeListeners(), this.listenerEventName]);
    this.addMessage('System', `Listening to '${this.listenerEventName}'`, 'received');
    this.listenerEventName = '';
  }

  removeListener(eventName: string) {
    const unsubscribe = this.unsubscribeFunctions.get(eventName);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribeFunctions.delete(eventName);
      this.activeListeners.set(this.activeListeners().filter(l => l !== eventName));
      this.addMessage('System', `Stopped listening to '${eventName}'`, 'received');
    }
  }

  clearMessages() {
    this.messages.set([]);
  }

  private addMessage(event: string, data: string, type: 'sent' | 'received' | 'error') {
    const timestamp = new Date().toLocaleTimeString();
    this.messages.set([
      ...this.messages(),
      { timestamp, event, data, type }
    ]);
  }

  ngOnDestroy() {
    // Clean up all listeners
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    this.unsubscribeFunctions.clear();
  }
}
