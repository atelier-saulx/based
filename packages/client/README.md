# @based/client

### Index

- [Modify data](#modify-data)
- [Observe data](#observe-data)
- [Upload files](#upload-files)
- [Schema](#schema)
- [Analytics](#analytics)

---

This package allows to interact with a Based environment, set and observe data, upload files, track and see analytics, and authenticate users.

This page provides a quick first look at the main methods this package offers. Detailed information about each method is linked in the appropriate paragraph.

###### Example:

```js
import based from '@based/client'

const client = based({
  org: 'my-org',
  project: 'someproject',
  env: 'production',
})

// create a schema
await client.updateSchema({
  schema: {
    types: {
      thing: {
        fields: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          reason: { type: 'string' },
          otherThings: { type: 'references' },
          favouriteThing: { type: 'reference' },
        },
      },
    },
  },
})

// observe some data
await client.observe(
  { $id: 'root', children: { $all: true, $list: true } },
  (data) => {
    console.log(data)
  }
)

// set data
await client.set({
  type: 'thing',
  name: 'book',
  quantity: 3,
})
```

## Modify data

> Read more about `set` and its operators [here](docs/set.md)

### `set`

The `based.set()` method allows to create new nodes or modify data on existing nodes. To change an existing one, one can do the following:

###### Example:

<!-- prettier-ignore-start -->
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

const result = await client.set({        // Value of result: maASxsd3
  $id: 'maASxsd3',                       // Resulting node in database:
  type: 'match',                         // { id: 'maASxsd3',
  title: {                               //   type: 'match',
    en: 'hello',                         //   value: 10,     // existing value remains
    de: 'hallo',                         //   title: {
  },                                     //     en: 'hello', // .en is overwritten
  name: 'match',                         //     de: 'hallo'  // .de is added
                                         //   },
                                         //   name: 'match'  // name is added
})
```
<!-- prettier-ignore-end -->

Omitting the `$id` field would **create a new node instead**.

> :exclamation: **All set operations must still respect the schema, otherwise the set won't take effect.**

### `delete`

A node can be removed using `client.delete()`, by passing an object with a property named `$id` containing the node's ID.

###### Example:

```js
await client.delete({
  $id: 'maASxsd3',
})
```

## Observe data

> Read more about `observe` and the query language [here](docs/get.md)

Based is built from the ground up with realtime updates in mind. This is why the best way to retrieve data for the database is to _observe_ it. This allows to pass an `onData` function that will get called any time the data that the query points to changes.

Using this same method, it is also possible to observe a data function.

This method returns a `close` function that must be called in order to allow the subscription to close gracefully.

###### Example:

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

###### Example:

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

###### Example:

```js
// Gets every child of `root`
const data = await client.get({
  $id: 'root',
  children: { $all: true, $list: true },
})
```

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

Also supports browser file objects

```jsx
<input
  type="file"
  onChange={async (e) => {
    const id = await client.file(e.target.files[0]);
    // const id = await client.file({ contents: e.target.files[0], name: 'custom name' });
  }}
/>
```

Or streams in node

```js
import fs from 'fs'

const id = await client.file(fs.createReadStream(aFile)); 
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

## Schema

> Read more about schemas [here](docs/schema.md)

The schema describes what types of nodes can exist on the database. Each `type` can have several named `fields`, each with its own data type (i.e. `string`, `number`, `object`, and so on). Based on the data type, Based will validate the value passed.

One of the first things a Based user will have to do is set a schema for its database. This is done using the `client.updateSchema()` method.

###### Example:

```js
await client.updateSchema({
  types: {
    thing: {
      fields: {
        name: { type: 'string' },
        nested: {
          type: 'object',
          properties: {
            something: { type: 'string' },
          },
        },
      },
    },
  },
})
```

## Analytics

Based is capable of tracking a client using the include `client.track()` method (and `client.untrack()`).  
This method allows to track any user defined event, a payload to it. The client stops being tracked when `client.untrack()` is called, or when the connection is closed.

###### Example:

```js
client.track('view', {
  edition: '2022',
  language: 'en',
})

// when the event is no longer happening (i.e. the user moves to a different view)...
client.untrack('view', {
  edition: '2022', // The payload needs to be specified again, since it defines a unique event type
  language: 'en',
})
```

Analytics can be queried with `client.observe()` and `client.get()` using a special endpoint:

###### Example:

<!-- prettier-ignore-start -->

```js
const data = await client.get('analytics', {   // The resulting object has 
  type: 'view',                                // { active, all, unique }
})                                             // counts, at the moment the method was called.
                                               // It is also possible to explore historical values using the $history operator, or observe the live count.
                                                

```
<!-- prettier-ignore-end -->

---

## License

Licensed under the MIT License.

See [LICENSE](./LICENSE) for more information.
