Migrating from Redis
====================

Redis Query Engine
------------------

### Data

```js
const users = [
  {
    name: 'Nancy Davolio',
    email: 'nancyd@northwind',
    age: 42,
    city: 'Seattle'
  },
  {
    name: 'Andrew Fuller',
    email: 'andrewf@northwind',
    age: 29,
    city: 'Tacoma',
  },
  {
    name: 'Nancy Leverling',
    email: 'nancyl@nortwind',
    age: 35,
    city: 'Kirkland',
  }
]
```

### Redis Version

```js
import {
  createClient,
  SCHEMA_FIELD_TYPE,
  FT_AGGREGATE_GROUP_BY_REDUCERS,
  FT_AGGREGATE_STEPS,
} from 'redis';

await client.ft.create('hash-idx:users', {
  'name': {
    type: SchemaFieldTypes.TEXT
  },
  'city': {
    type: SchemaFieldTypes.TEXT
  },
  'age': {
    type: SchemaFieldTypes.NUMERIC
  }
}, {
  ON: 'HASH',
  PREFIX: 'user:'
});

await Promise.all(users.map((user, i) => client.hSet(`user:${i}`, user))

let res = await client.ft.search(
  'hash-idx:users', 'Nancy @age:[30 40]'
);

console.log(res.total); // >>> 1
res.documents.forEach(doc => {
  console.log(`ID: ${doc.id}, name: ${doc.value.name}, age: ${doc.value.age}`);
});
// >>> ID: huser:3, name: Nancy Leverling, age: 35
```

### Based Version

```js
await db.setSchema({
  types: {
    user: {
      props: {
        name: 'string',
        email: 'string',
        age: 'uint16',
        city: 'string',
      },
    },
  },
})

users.map((user) => db.create('user', user))
await db.query('user').filter('name', 'like', 'Nancy').filter('age', '..', [30, 40]).get().inspect()
```
