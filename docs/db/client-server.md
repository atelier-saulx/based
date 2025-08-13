# Client-Server Operations

The database supports multiple clients with real-time synchronization:

- All schema changes are propagated to all clients
- Node creations/updates are immediately visible to other clients
- Queries reflect the latest state across all clients

Example Multi-Client Usage:

```javascript
// Client 1 creates a node
const nodeId = await client1.create('user', { name: 'Client1' })

// Client 2 can immediately query it
const nodes = await client2.query('user').get()
```

**Performance Considerations**

1. For bulk operations, use:
   - Batched creates/updates
   - Appropriate query ranges
2. Relationships are efficiently stored and traversed
3. The database handles rapid-fire operations from multiple clients

See more on the [test file](https://github.com/atelier-saulx/based/blob/main/packages/db/test/clientServer.ts).
