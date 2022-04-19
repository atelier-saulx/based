# @based/client

This package allows to interact with a Based environment, to set and observe data, to upload files, track and see analytics, and authenticate users.

This page provide a quick first look to the main methods thi package offers. Detailed information about each method is linked in the appropriate paragraph.

In summary, the main methods the Based client offers are

| Name                             | Args                                                                 | Function                                        |
| -------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| [`based.set()`](set.md)          | `query`                                                              | Add or modify data on the database              |
| [`based.get()`](get.md)          | `query`                                                              | Extract and shape data from the database.       |
| `based.observe()`                | `query, onData: (data: any, checksum: number), onErr?: (err: Error)` | Subscribe to a query or server-side method.     |
| `based.delete()`                 | `id`                                                                 | Remove a node from the database                 |
| [`based.configure()`](schema.md) | `schema query`                                                       | Change schema.                                  |
| `based.digest()`                 | `string`                                                             | Hash the input string, returning sha-64 digest. |
| [`based.call()`](functions.md)   | `string`                                                             | Executes a server-side function.                |

## Set data

The `based.set()` method allows us to create new nodes or modify data on existing nodes. To change an existing one, one can do the following:

```js
/*
Let's assume the following node in database:
{
    id: 'maASxsd3',
  type: 'match',
  value: 10,
  title: {
      en: 'yes'
  }
}
*/

// prettier-ignore
const result = await client.set({        // Value of result: maASxsd3
  $id: 'maASxsd3',                       // Resulting node in database:
  type: 'match',                         // { id: 'maASxsd3',
  title: {                               //   type: 'match',
    en: 'hello',                         //   value: 10, // value remains
    de: 'hallo',                         //   title: {
  },                                     //     en: 'hello', // .en is overwritten
  name: 'match',                         //     de: 'hallo' // .de is added
                                         //   },
                                         //   name: 'match' // name is added
})
```

Omitting the `$id` field would **create a new node instead**.

> :exclamation: **All set operations must still respect the schema, otherwise the set won't take effect.**

## Observe data

Based is built from the ground up with realtime updates in mind. This is why the best way retrieve data for the database is to _observe_ it. This allows us to pass a `onData` function that will get called any time the data the query points to changes.

Using this same method, it is also possible to observe a data function.

```js
// This query observes all nodes of type `thing` and counts how many time any of them
// changes, is removed, or is added
let receivedCnt = 0

const close = await client.observe(
  {
    things: {
      name: true,
      id: true,
      nested: true,
      $list: {
        $find: {
          $traverse: 'children',
          $filter: {
            $operator: '=',
            $value: 'thing',
            $field: 'type',
          },
        },
      },
    },
  },
  () => {
    receivedCnt++
  }
)

// when done ...
close()
```

**To observe a data function instead**, one can simply replace the query with the name of the function:

```js
let receivedCnt = 0

const close = await client.observe('observeAllThings', () => {
  receivedCnt++
})

// when done ...
close()
```

#### `get`

It's also possible to simply get the data, instead of observing it, using the same

## License

Licensed under the MIT License.

See [LICENSE](./LICENSE) for more information.
