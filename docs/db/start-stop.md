## Expiration Feature

The `BasedDb` class provides functionality to automatically expire documents after a specified time.

### Methods

#### `expire(type: string, id: string, seconds: number): void`

Sets a document to expire after a specified number of seconds.

**Parameters:**

- `type` (string): The type/collection of the document (e.g., 'token')
- `id` (string): The ID of the document to expire
- `seconds` (number): Number of seconds after which the document will be automatically deleted

**Behavior:**

- The expiration is persistent and will survive database restarts
- The document will be automatically removed after the specified time
- Multiple calls to `expire` for the same document will update the expiration time

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
- The expiration process continues to work even if:
- The database is saved and restarted
- The application is restarted
- You must call await db.drain() to ensure all operations are processed
- Expired documents are completely removed from the database

The expiration mechanism is persistent:

If you set an expiration and then save/restart the database, the expiration timer continues
After restart, documents will still be removed when their time expires
The state is maintained through database saves
