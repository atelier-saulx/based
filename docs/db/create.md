# Schema Operations

### Setting-up

### Methods

#### `setSchema(schema: object): Promise<void>`

Defines or updates the graph schema.

**Parameters:**

- `schema` (object): Schema definition containing:
  - `types`: Object defining node types and their properties

**Schema Example:**

```js
{
  types: {
    user: {
      name: 'string',
      age: 'number',
      favoriteUser: {
        ref: 'user',        // Reference to another user node
        prop: 'favoriteUser' // Inverse relationship property
      },
      others: {
        items: {
          ref: 'user',      // Multiple (Array) reference to user nodes
          prop: 'others'    // Inverse relationship property
        }
      }
    }
  }
}
```

**Notes:**

- Schema can be updated dynamically
- Existing nodes will be migrated to new schema
- Removed properties will be deleted from nodes
- Added properties will be initialized with default values

## Node Operations

### Method

#### `create(type: string, properties?: object): Promise<string>`

Creates a new node in the graph.

**Parameters:**

- `type` (string): Node type (must be defined in schema)
  - `properties` (object, optional): Initial properties

Returns:

Promise resolving to the new node's ID
Example:

```javascript
const userId = await db.create('user', {
  name: 'Alice',
  age: 30,
})
```

**Relationship Management**

The graph database automatically manages bidirectional relationships:

- When you set favoriteUser, the inverse relationship is maintained
- Array relationships (others in examples) are similarly managed
- All relationships are queryable from either directions
