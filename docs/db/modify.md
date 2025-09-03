# Modify Operations

## Overview

This document describes the modify operations (update, upsert, delete, and drain) for BasedDB.

## Update Operations

### `db.update(type, id, data)`

Updates an existing entity of the specified type.

**Parameters:**

- `type` (string): The type of entity to update (e.g., 'article', 'user')
- `id` (number|object): The ID of the entity to update, or an object containing the ID
- `data` (object): The data to update the entity with

**Examples:**

```javascript
// Update with explicit ID
await db.update('article', 1, {
  body: 'xxx',
})

// Update with ID in payload
await db.update('article', {
  id: 1,
  body: 'xxx',
})

// Update nested properties
await db.update('snurp', 1, {
  name: 'mr snurp!',
  nested: {
    derp: 'a',
  },
})
```

**Notes:**

- Updates are queued and executed when `db.drain()` is called
- Attempting to update a non-existing entity may throw an error
- Partial updates are supported - only specified fields will be updated

## Upsert Operations

### `db.upsert(type, data)`

Updates an existing entity or creates a new one if it doesn't exist, using a unique identifier field.

**Parameters:**

- `type` (string): The type of entity to upsert
- `data` (object): The data for the entity, must include the unique identifier property

**Examples:**

```javascript
// Upsert a user by email
const userRef = client2.upsert('user', {
  email: 'james@flapmail.com',
  name: 'James!',
})

// Upsert with relationships
client2.upsert('article', {
  externalId: 'flap',
  name: 'flap',
  contributors: [
    client2.upsert('user', {
      email: 'james@flapmail.com',
      name: 'James!',
    }),
    client2.upsert('user', {
      email: 'derp@flapmail.com',
      name: 'Derp!',
    }),
  ],
})
```

## Delete Operations

### `db.delete(type, id)`

Deletes an entity of the specified type.

**Parameters:**

- `type` (string): The type of entity to delete
- `id` (number): The ID of the entity to delete

**Examples:**

```javascript
// Delete an entity
await db.delete('user', 1)

// Delete after creation
const user = await db.create('user', {...})
await db.delete('user', user)
```

**Notes:**

- Deleting non-existing entities is handled gracefully (no error thrown)
- Deletions are queued and executed when `db.drain()` is called
- After deletion, queries will no longer return the deleted entity

## Drain Operation

### `db.drain()`

Processes all queued operations (updates, deletes, upserts).

**Returns:** Promise that resolves when all operations are completed. Elapsed time when resolved.

**Examples:**

```javascript
// Process all queued operations
await db.drain()

// Batch operations with periodic draining
for (let i = 0; i < 1000000; i++) {
  db.create('user', { name: `user_${i}` })
  if (i % 10000 === 0) {
    await db.drain() // Process in batches
  }
}
await db.drain() // Process remaining
```

**Notes:**

- Essential for processing batched operations efficiently
- Improves performance by reducing disk I/O operations
- Should be called periodically when doing bulk operations

## Performance Considerations

1. **Batching**: Use `db.drain()` strategically to batch operations
2. **Memory Usage**: Large numbers of queued operations consume memory
3. **Throughput**: The system can handle high throughput (100k+ operations)
4. **Interleaved Draining**: For very large operations (1M+), interleave drains to manage memory

## Error Handling

- Attempting to update non-existing entities may throw errors
- Deleting non-existing entities is handled gracefully
- Schema validation errors will be thrown for invalid data
