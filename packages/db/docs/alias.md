# Alias

An `alias` is used to identify and link records in relational operations. It is the designated field type for creating relationships based on a human-readable, unique value.

To better understand its functionality and follow this doc we encourage to take a look on the following test files:

- [packages/db/test/alias.ts](../test/alias.ts)
- [packages/db/test/aliasOps.ts](../test/aliasOps.ts)

### **Uniqueness and Identification**

An **`alias`** acts as a unique secondary key for a record within a specific type.

- **Direct Retrieval**: You can fetch a single record directly by providing its `alias` value, as shown in the `Get single node by alias` test: `db.query('user', { email: '2@saulx.com' })`.
- **Uniqueness Enforcement**: The database enforces that `alias` values are unique for each type. The `simple` test shows that when a new record is created with an `alias` already in use (`externalId: 'cool'`), the `alias` field on the older record is automatically cleared to maintain uniqueness.
- **Scope of Uniqueness**: The uniqueness is scoped per type. The `same-name-alias` test demonstrates that a `sequence` and a `round` can both have records with `name: 'semi1'`.

---

### **Upsert Behavior**

The **`alias`** type is integral to how the `upsert` command functions.

- When you `upsert` a record, the system checks if a record with that `alias` value already exists.
- If it exists, the existing record is **updated**.
- If it doesn't exist, a **new** record is created.

This is clearly shown in the `simple` test. The first `upsert` with `externalId: 'potato'` creates a user. The second `upsert` with the same `externalId` updates that same user instead of creating a new one.
