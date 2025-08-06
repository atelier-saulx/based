# Filter

## `.filter(field, operator, value, options?)`

Filters the results based on field values.

### Operators:

- \`=\`: Equal to (works for most types, including exact string match).
- \`!=\`: Not equal to.
- \`>\`: Greater than (numbers, timestamps).
- \`<\`: Less than (numbers, timestamps).
- \`>=\`: Greater than or equal to.
- \`<=\`: Less than or equal to.
- \`has\`: Contains substring (case sensitive by default for \`string\`, \`text\`, could be case insentive passing option argument).
- \`like\`: Fuzzy search / similarity (for \`string\`, \`text\`, \`vector\`).

**Filter Examples:**

- **Equality (=)**
  Finds nodes where the field exactly matches the value.

  ```typescript
  // Find users named exactly 'Alice'
  await db.query('user').filter('name', '=', 'Alice').get()

  // Find users with age 30
  await db.query('user').filter('age', '=', 30).get()

  // Find users with a specific country code
  await db.query('user').filter('countryCode', '=', 'NL').get()

  // Find users with a specific vector (exact match)
  const queryVector = new Float32Array([
    /* ... */
  ])
  await db.query('user').filter('embedding', '=', queryVector).get()
  ```

- **Inequality (!=)**
  Finds nodes where the field does _not_ match the value.

  ```typescript
  // Find users not named 'Alice'
  await db.query('user').filter('name', '!=', 'Alice').get()

  // Find users whose status is not 'pending'
  await db.query('user').filter('status', '!=', 'pending').get()
  ```

- **Comparison (>, \`<, >=, <=)**
  Finds nodes based on numerical or timestamp comparisons.

  ```typescript
  // Find users older than 50
  await db.query('user').filter('age', '>', 50).get()

  // Find users with a score less than or equal to 75.5
  await db.query('user').filter('score', '<=', 75.5).get()

  // Find users created within the last 24 hours
  await db
    .query('user')
    .filter('createdAt', '>=', Date.now() - 86400000)
    .get()
  ```

- **String/Text Contains (has)**
  Finds nodes where a \`string\` or \`text\` field includes a substring. Case-insensitive by default.

  ```typescript
  // Find users whose name contains 'ali' (matches 'Alice', 'Ali', 'Salim', etc.)
  await db.query('user').filter('name', 'has', 'ali').get()

  // Find users whose name contains 'ALI' (case-sensitive)
  await db
    .query('user')
    .filter('name', 'has', 'ALI', { lowerCase: false })
    .get()

  // Find users whose bio (any language) contains 'engineer'
  await db.query('user').filter('bio', 'has', 'engineer').get()

  // Find users whose English bio contains 'dev'
  await db.query('user').filter('bio.en', 'has', 'dev').get()
  ```

- **Fuzzy Match / Similarity (like)**
  Finds nodes based on approximate matching for \`string\`, \`text\`, or \`vector\` types.

  ```typescript
  // Find users whose bio might contain a typo like 'engneer'
  await db.query('user').filter('bio', 'like', 'engneer').get()

  // Find users whose embedding vector is similar to queryVector (cosine similarity >= 0.8)
  const queryVector = new Float32Array([
    /* ... */
  ])
  await db
    .query('user')
    .filter('embedding', 'like', queryVector, { score: 0.8 })
    .get()

  // Find users whose embedding vector is similar (Euclidean distance <= 1.0)
  await db
    .query('user')
    .filter('embedding', 'like', queryVector, {
      fn: 'euclideanDistance',
      score: 1.0,
    })
    .get()
  ```

- **Boolean Filtering**
  Finds nodes based on a boolean field's value.

  ```typescript
  // Find active users (explicitly true)
  await db.query('user').filter('isActive', '=', true).get()

  // Find active users (shortcut for true)
  await db.query('user').filter('isActive').get()

  // Find inactive users
  await db.query('user').filter('isActive', false).get()
  ```

- **Enum Filtering**
  Finds nodes where an \`enum\` field matches a specific value.

  ```typescript
  // Find users with status 'active'
  await db.query('user').filter('status', '=', 'active').get()

  // Find users whose status is not 'pending'
  await db.query('user').filter('status', '!=', 'pending').get()
  ```

- **Filtering on Nested Fields**
  Uses dot notation to access fields within nested objects.

  ```typescript
  // Find users where nestedData.value is 'nested info'
  await db.query('user').filter('nestedData.value', '=', 'nested info').get()
  ```

- **Filtering on Reference Fields**
  Uses dot notation to filter based on fields of referenced nodes.

  ```typescript
  // Find users whose best friend is named 'Bob'
  await db.query('user').filter('bestFriend.name', '=', 'Bob').get()

  // Find users who have at least one friend older than 30
  await db.query('user').filter('friends.age', '>', 30).get()

  // Find users whose best friend's status is 'active'
  await db.query('user').filter('bestFriend.status', '=', 'active').get()
  ```

- `has` also can be used with references (as also `>`, `>=`, `<` and `<=` ) see the example bellow.

Considering the schema. `bestBud` is a single reference prop but `buddies` is a multiple references prop:

```js
await db.setSchema({
  types: {
    user: {
      props: {
        name: { type: 'string' },
        age: { type: 'uint32' },
        bestBud: {
          // single Ref
          ref: 'user',
          prop: 'bestBudOf',
        },
        buddies: {
          // multiple Ref
          items: {
            ref: 'user',
            prop: 'buddies',
          },
        },
      },
    },
  },
})
```

populating it with:

```js
const ildo1 = db.create('user', {
  name: 'Clemildo',
  age: 29,
})
const ildo2 = db.create('user', {
  name: 'Josefildo',
  age: 34,
})
const ildo3 = db.create('user', {
  name: 'Adeildo',
  age: 50,
  bestBud: ildo2,
  buddies: [ildo1, ildo2],
})
```

we have bidirectional references for all users, where "Adeildo" and "Josefildo" as best buddies (single ref).
Let's filter it using the nested sintax:

```js
await db
  .query('user')
  .include('*')
  .filter('bestBud.name', 'has', 'Jose')
  .get()
  .inspect(10)
// [
//   {
//      id: 3 user,
//      age: 50,
//      name: "Adeildo",
//   }
// ]
```

but to filter multiple refs we can't apply to `db.filter()` sequancially, so we use a branched query:

```js
await db
  .query('user')
  .include((q) => q('buddies').include('*').filter('name', 'has', 'Jose'), '*')
  .get()
  .inspect(10)
// [
//     {
//        id: 1 user,
//        age: 29,
//        name: "Clemildo",
//        buddies: []    },
//     {
//        id: 2 user,
//        age: 34,
//        name: "Josefildo",
//        buddies: []    },
//     {
//        id: 3 user,
//        age: 50,
//        name: "Adeildo",
//        buddies: [{
//           id: 2 user,
//           age: 34,
//           name: "Josefildo",
//        }]    }
//   ]
// }
```

Notice that the result is correctly applied for the branch, but to filter the top branch where there is no buddies (`buddies.length == 0`) we have to use JS in the result.

```js
;(
  await db
    .query('user')
    .include(
      (q) => q('buddies').include('*').filter('name', 'has', 'Jose'),
      '*',
    )
    .get()
    .toObject()
).filter((u) => u.buddies.length > 0)
// [{"id":3,"age":50,"name":"Adeildo","buddies":[{"id":2,"age":34,"name":"Josefildo"}]}]
```

## `.sort(field, direction?)`

Sorts the results by a specific field. \`direction\` can be \`'asc'\` (default) or \`'desc'\`.

```typescript
// Sort by age descending
await db.query('user').sort('age', 'desc').get()

// Sort by name ascending
await db.query('user').sort('name').get() // 'asc' is default

// Sort by text field (uses locale if provided)
await db.query('user').locale('nl').sort('bio').get()

// Sort by cardinality (HLL count)
await db.query('user').sort('visits', 'desc').get()

// Sort by alias
await db.query('article').sort('email', 'desc').get()

// Sort by timestamp
await db.query('event').sort('startTime').get()
```

The following data types doesn't support sort:

- Reference / References (you can if you use branched queries / nested include sintax) like

  ```js await db
  .query('actor')
  .include('*')
  .include((q) => q('movies').include('*').sort('name', 'desc'), '*')
  .sort('name', 'asc')
  .get()
  ```

- Vector
- Binary
