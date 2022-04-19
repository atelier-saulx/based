# @based/client

This package allows to interact with a Based environment, set and observe data, upload files, track and see analytics, and authenticate users.

This page provides a quick first look at the main methods this package offers. Detailed information about each method is linked in the appropriate paragraph.

## Set and remove data

> Read more about `set` and its operators [here](docs/set.md)

### `set`

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

### `delete`

A node can be removed using `client.delete(id)`, by passing the node's ID.

## Observe data

> Read more about `observe` and the query language [here](docs/get.md)

Based is built from the ground up with realtime updates in mind. This is why the best way to retrieve data for the database is to _observe_ it. This allows us to pass an `onData` function that will get called any time the data the query points to changes.

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

It's also possible to simply get the data once, instead of observing it, using the `based.get()` method, which accepts a query or data function name as argument.

## Upload files

> Details [here](docs/files.md)

Based provides a way to upload and serve user content without hassle using the `client.file()` API.

This sets a new node of type `file` in the database, which contains all its relevant information

###### Example:

```js
const fileId = await client.file({
  contents: 'This is a string I want to store as plain text!',
  mimeType: 'text/plain',
  name: 'my-file-name',
})
```

###### Retrieve the file node:

```js
const data = await client.get({
  $id: fileId,
  $all: true,
})
/*
data = {
  id: "fi6a535226",
  name: "eb3f67a3bc65325bf739ebddd94403e5",
  mimeType: "text/plain",
  version: "eb3f67a3bc65325bf739ebddd94403e5",
  origin: "https://based-env-files-do-usproduction-enb-xz-apz--orn-t-v-...98446afcb87d",
  src: "https://based-2129034536588.imgix.net/fi6a535226/84e62df3-75...98446afcb87d",
  progress: 1,
  size: 31,
  type: "file",
  createdAt: 1650360875043,
  updatedAt: 1650360882865,
}
*/
```

## License

Licensed under the MIT License.

See [LICENSE](./LICENSE) for more information.
