# Core Database Operations

## Starting

### Methods

#### `start(options: { clean?: boolean }): Promise<void>`

Initializes and starts the graph database.

**Parameters:**

- `options` (object):
  - `clean` (boolean, optional): If true, initializes a fresh client database (default: false)

**Behavior:**

- Prepares the database for operations
- Loads existing data if not starting clean
- Establishes necessary internal structures
- Must be called before any other operations

## Stopping

### Methods

#### `stop(): Promise<void>`

Gracefully shuts down the database.

**Behavior:**

- Flushes all pending operations
- Persists data to disk
- Releases resources
- Safe to call multiple times

## Expiration

The `BasedDb` class provides functionality to automatically expire nodes after a specified time.

### Methods

#### `expire(type: string, id: string, seconds: number): void`

Sets a node to expire after a specified number of seconds.

**Parameters:**

- `type` (string): The type of the node (e.g., 'token')
- `id` (string): The ID of the node to expire
- `seconds` (number): Number of seconds after which the node will be automatically deleted

**Behavior:**

- The expiration is persistent and will survive database restarts
- The node will be automatically removed after the specified time
- Multiple calls to `expire` for the same node will update the expiration time

### Example Usage

```javascript
const db = new BasedDb({ path: '/path/to/db' })
await db.start({ clean: true })

// Set up schema
await db.setSchema({
  types: {
    token: {
      name: 'string',
      user: {
        ref: 'user',
        prop: 'token',
      },
    },
    user: {
      name: 'string',
      token: {
        ref: 'token',
        prop: 'user',
      },
    },
  },
})

// Create documents
const user = await db.create('user')
const token = await db.create('token', {
  name: 'my token',
  user: user,
})

// Set token to expire after 1 second
db.expire('token', token, 1)

// After 1 second, the token will be automatically removed
```

### Notes

- The expiration time is measured in seconds
- You must call await db.drain() to ensure all operations are processed
- Expired nodes are completely removed from the database
- The expiration process continues to work even if:
  - The client database is saved and restarted;
  - The application is restarted.
