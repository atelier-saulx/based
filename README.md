# based-db

## Constructor

```ts
new BasedDb({
  path: string,
  maxModifySize?: number
})
```

Creates a new BasedDb instance.

- `path`: File system path where the database will store its data
- `maxModifySize`: Optional maximum size for modify operations

## Database Operations

### Schema Management

#### `putSchema(schema: Schema): Promise<StrictSchema>`

Adds or updates the database schema. Returns a promise that resolves to the validated schema.

```ts
await db.putSchema({
  types: {
    user: {
      props: {
        name: { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
})
```

### Data Operations

#### `create(type: string, obj?: CreateObj, opts?: ModifyOpts): ModifyRes`

Creates a new record of the specified type.

```ts
const userId = db.create('user', {
  name: 'John',
  email: 'john@example.com',
})
```

#### `update(type: string, id: number, obj: Record<string, any>): Promise<void>`

Updates an existing record.

```ts
await db.update('user', userId, {
  name: 'John Smith',
})
```

#### `delete(type: string, id: number): Promise<void>`

Deletes a record.

```ts
await db.delete('user', userId)
```

#### `copy(type: string, target: number, obj?: Record<string, any>): Promise<ModifyRes>`

Creates a copy of an existing record.

```ts
const copyId = await db.copy('user', userId)
```

#### `upsert(type: string, obj: Record<string, any>): Promise<ModifyRes>`

Creates or updates a record.

### Queries

#### `query(type: string, id?: number): BasedDbQuery`

Creates a query builder for the specified type.

```ts
const results = await db.query('user').include('name', 'email').get()
```

### Database Management

#### `start(opts?: { clean?: boolean }): Promise<void>`

Starts the database. Set `clean` to true to start with a fresh database.

```ts
await db.start({ clean: true })
```

#### `drain(): Promise<void>`

Ensures all pending operations are written to disk.

```ts
await db.drain()
```

#### `save(): Promise<void>`

Saves the current database state to disk.

```ts
await db.save()
```

#### `destroy(): Promise<void>`

Closes the database and cleans up resources.

```ts
await db.destroy()
```

### Deprecated Methods

#### `remove()`

Deprecated - use `delete()` instead.

## Query Builder Methods

The query builder returned by `db.query()` supports:

- `include(fields: string[]): BasedDbQuery` - Select fields to return
- `filter(field: string, operator: string, value: any): BasedDbQuery` - Add filter conditions
- `range(start: number, end: number): BasedDbQuery` - Limit result range
- `get(): Promise<BasedQueryResponse>` - Execute query and get results

Example:

```ts
const users = await db
  .query('user')
  .include('name', 'email')
  .filter('age', '>', 18)
  .range(0, 10)
  .get()
```
