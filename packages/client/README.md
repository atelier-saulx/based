# @based/client

This package allows to interact with a Based environment, to set and observe data, to upload files, track and see analytics, and authenticate users.

This page provide a quick first look to the main methods this package offers. Detailed information about each method is linked in the appropriate paragraph.

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

This method returns a `close` function that must be called in order to allow the subscription to close gracefully.

```js
// This query observes all nodes of type `thing` and counts how many times any of them
// changes, is removed, or is added, while also logging all the entries every time.
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
  (data) => {
    console.log(data)
    receivedCnt++
  }
)

// when done ...
close()
```

**To observe a data function instead**, one can simply replace the query with the name of the function:

```js
let receivedCnt = 0

const close = await client.observe('observeAllThings', (data) => {
  console.log(data)
  receivedCnt++
})

// when done ...
close()
```

#### `get`

It's also possible to simply get the data once, instead of observing it, using the `based.get` method, which accepts a query or data function name as argument.

## License

Licensed under the MIT License.

See [LICENSE](./LICENSE) for more information.
