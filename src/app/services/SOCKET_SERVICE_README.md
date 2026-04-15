# Socket.IO Service

Centralized service for managing Socket.IO client connections and real-time communication with a Socket.IO server. Built with Angular signals for reactive state management.

## Installation

The service requires socket.io-client:

```bash
npm install socket.io-client
```

## Quick Start

### Basic Connection

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { SocketService } from '../services/socket.service';

@Component({
  selector: 'app-chat',
  template: `...`
})
export class ChatComponent implements OnInit, OnDestroy {
  constructor(private socketService: SocketService) {}

  ngOnInit() {
    // Connect to server
    this.socketService.connect('http://localhost:3000');

    // Check if connected
    if (this.socketService.getIsConnected()) {
      console.log('Connected!');
    }
  }

  ngOnDestroy() {
    this.socketService.disconnect();
  }
}
```

## API Reference

### Connection Management

#### `connect(url: string, options?: any): void`

Establishes connection to a Socket.IO server.

**Parameters:**
- `url` - Server URL (e.g., 'http://localhost:3000')
- `options` - Optional Socket.IO options (reconnection, transport, etc.)

**Default Options:**
- `reconnection: true` - Enable auto-reconnection
- `reconnectionDelay: 1000` - Initial reconnection delay
- `reconnectionDelayMax: 5000` - Maximum reconnection delay
- `reconnectionAttempts: 5` - Max reconnection attempts

**Example:**
```typescript
this.socketService.connect('http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 10,
  transport: ['websocket', 'polling']
});
```

#### `disconnect(): void`

Disconnects from the server and cleans up resources.

```typescript
this.socketService.disconnect();
```

### Event Communication

#### `emit(eventName: string, data?: any, callback?: (response: any) => void): void`

Sends an event to the server.

**Parameters:**
- `eventName` - Name of the event
- `data` - Data to send (optional)
- `callback` - Function called with server response (optional)

**Examples:**
```typescript
// Send event without data
this.socketService.emit('userConnected');

// Send event with data
this.socketService.emit('message', { text: 'Hello', username: 'Alice' });

// Send event with callback
this.socketService.emit('ping', {}, (response) => {
  console.log('Server responded:', response);
});
```

#### `on(eventName: string, callback: (data: any) => void): () => void`

Listens to events from the server. Returns unsubscribe function.

**Returns:** Function to remove the listener

**Example:**
```typescript
// Listen to messages
const unsubscribe = this.socketService.on('message', (data) => {
  console.log('New message:', data);
});

// Later, stop listening
unsubscribe();
```

#### `once(eventName: string, callback: (data: any) => void): void`

Listens to an event only once.

```typescript
this.socketService.once('welcome', (data) => {
  console.log('Welcome message:', data);
});
```

#### `off(eventName: string, callback?: (data: any) => void): void`

Removes an event listener.

```typescript
const myCallback = (data) => { console.log(data); };

// Add listener
this.socketService.on('event', myCallback);

// Remove specific listener
this.socketService.off('event', myCallback);

// Remove all listeners for event
this.socketService.off('event');
```

### State Queries

#### `getIsConnected(): boolean`

Returns current connection state.

```typescript
if (this.socketService.getIsConnected()) {
  this.socketService.emit('action', { data: 'value' });
}
```

#### `getConnectionError(): string | null`

Returns error message if connection failed.

```typescript
const error = this.socketService.getConnectionError();
if (error) {
  console.error('Connection error:', error);
}
```

#### `getSocket(): Socket | null`

Returns raw Socket.IO instance (use with caution).

```typescript
const socket = this.socketService.getSocket();
if (socket) {
  console.log('Socket ID:', socket.id);
}
```

## Signals (Reactive State)

The service uses Angular signals for reactive state:

```typescript
// These are private but you can use the getter methods
this.socketService.getIsConnected();      // boolean
this.socketService.getConnectionError();  // string | null
```

Use effect to react to connection changes:

```typescript
import { effect } from '@angular/core';

effect(() => {
  const isConnected = this.socketService.getIsConnected();
  console.log('Connection state changed:', isConnected);
});
```

## Usage Patterns

### Pattern 1: Message Listener

```typescript
export class ChatComponent implements OnInit, OnDestroy {
  messages = signal<Message[]>([]);

  constructor(private socketService: SocketService) {}

  ngOnInit() {
    this.socketService.connect('http://localhost:3000');
    
    this.socketService.on('message', (data) => {
      this.messages.update(msgs => [...msgs, data]);
    });
  }

  sendMessage(text: string) {
    this.socketService.emit('message', { text, timestamp: Date.now() });
  }

  ngOnDestroy() {
    this.socketService.disconnect();
  }
}
```

### Pattern 2: Request-Response

```typescript
async getServerData(): Promise<any> {
  return new Promise((resolve) => {
    this.socketService.emit('getData', {}, (response) => {
      resolve(response);
    });
  });
}
```

### Pattern 3: Multiple Listeners

```typescript
ngOnInit() {
  this.socketService.connect('http://localhost:3000');

  this.unsubscribeMessage = this.socketService.on('message', (data) => {
    console.log('Message:', data);
  });

  this.unsubscribeStatus = this.socketService.on('statusUpdate', (data) => {
    console.log('Status:', data);
  });

  this.unsubscribeError = this.socketService.on('error', (data) => {
    console.error('Error:', data);
  });
}

ngOnDestroy() {
  this.unsubscribeMessage?.();
  this.unsubscribeStatus?.();
  this.unsubscribeError?.();
  this.socketService.disconnect();
}
```

### Pattern 4: Reactive Connection Status

```typescript
import { effect, computed } from '@angular/core';

export class AppComponent implements OnInit {
  isConnected = computed(() => this.socketService.getIsConnected());
  connectionStatus = computed(() => 
    this.isConnected() ? '🟢 Connected' : '🔴 Disconnected'
  );

  ngOnInit() {
    effect(() => {
      if (this.isConnected()) {
        console.log('Connected! Initializing...');
      }
    });
  }
}
```

## Common Events

### Server-Defined Events

Most events are application-specific, but Socket.IO provides built-in events:

```typescript
// System events (no need to emit, automatically triggered)
this.socketService.getIsConnected();        // Connection established
this.socketService.getConnectionError();    // Connection failed
```

### Example Application Events

```typescript
// Client → Server
this.socketService.emit('sendMessage', { text: 'Hello' });
this.socketService.emit('userTyping', { status: 'typing' });
this.socketService.emit('joinRoom', { roomId: 'room123' });

// Server → Client (listen with on())
this.socketService.on('receiveMessage', (data) => {});
this.socketService.on('userOnline', (data) => {});
this.socketService.on('notification', (data) => {});
```

## Error Handling

The service automatically handles connection errors:

```typescript
// Check for errors
if (this.socketService.getConnectionError()) {
  console.error(this.socketService.getConnectionError());
}

// Listen for connection errors
this.socketService.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

## Testing

Example test setup:

```typescript
describe('MyComponent', () => {
  let component: MyComponent;
  let socketService: SocketService;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [SocketService]
    }).compileComponents();

    socketService = TestBed.inject(SocketService);
    spyOn(socketService, 'emit').and.callThrough();
  });

  it('should emit message on send', () => {
    component.sendMessage('test');
    expect(socketService.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
  });
});
```

## Best Practices

1. **Always disconnect on component destroy** - Prevents memory leaks
   ```typescript
   ngOnDestroy() {
     this.socketService.disconnect();
   }
   ```

2. **Store unsubscribe functions** - For proper cleanup
   ```typescript
   private unsubscribe: (() => void) | null = null;
   
   ngOnInit() {
     this.unsubscribe = this.socketService.on('event', callback);
   }
   
   ngOnDestroy() {
     this.unsubscribe?.();
   }
   ```

3. **Check connection before emitting** - The service warns but doesn't error
   ```typescript
   if (this.socketService.getIsConnected()) {
     this.socketService.emit('action', data);
   }
   ```

4. **Use typed data** - Define interfaces for events
   ```typescript
   interface Message {
     id: string;
     text: string;
     timestamp: number;
   }
   
   this.socketService.on('message', (data: Message) => {
     // Use with confidence
   });
   ```

5. **Handle reconnection** - Use effects to re-initialize on reconnect
   ```typescript
   effect(() => {
     if (this.socketService.getIsConnected()) {
       this.initializeListeners();
     }
   });
   ```

## Example Component

See `socket-example.component.ts` for a complete working example with UI for:
- Connecting/disconnecting
- Sending events
- Adding/removing listeners
- Message logging
- Connection status display

Usage:
```typescript
import { SocketExampleComponent } from './component/socket-example.component';

// In your app
<app-socket-example></app-socket-example>
```

## Troubleshooting

### Connection not established
- Ensure server URL is correct
- Verify server is running and CORS is configured
- Check browser console for errors

### Events not received
- Verify listener is added before server sends event
- Check event name matches exactly (case-sensitive)
- Ensure socket is connected

### Memory leaks
- Always unsubscribe in ngOnDestroy
- Remove all listeners before disconnecting
- Close the component properly

## Dependencies

- `@angular/core` - Angular framework
- `socket.io-client` - Socket.IO client library

## Service Location

`src/app/services/socket.service.ts`
