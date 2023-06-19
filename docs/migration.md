# Migration to Based v1

As our new infrastructure nears completion, here's a small introduction to some of the main changes.  
Not everything has changed. **Our schema and query language** are exactly the same.

## Client

A new version of the `@based/client` accompanies this release. Please check npm for what the latest is, it changes often.

The API of the client has changed compared to the previous version, but the core concepts remain the same:

### Initializing the client

```ts
import { BasedClient } from '@based/client'

const based = new BasedClient({
  cluster: 'production',
  org: 'your-organization',
  project: 'your-project',
  env: 'your-environment',
})
```

This will create a client object and connect to your environment. The `cluster` field is optional and will default to `production`, but during development you might be instructed to connect to a different cluster.

### `based.call(name: string, payload?: any): Promise<any>`

```ts
const id = await client.call('db:set', {
  type: 'user',
  name: 'hello',
})
```

To invoke a based server-function, you use the `.call` method. This method takes the name of the function as first argument, and optionally a payload as second argument.

**This is the method used to execute functions of type `function`.** See later for other types of functions available.

### `based.query( name: string, payload?: any, opts?: { persistent: boolean }): BasedQuery`

```ts
const data = await based.query('db', queryObject).get()

const specificData = await based
  .query('db', queryObject)
  .getWhen((data) => data === desiredCondition)

const unsubscribe = based
  .query('db', queryObject, { persistent: true })
  .subscribe((data) => {
    console.log('received data!', data)
  })

// ...

unsubscribe()
```

This method is used to get or observe a `query` type function. It'll return an object with `get`, `subscribe`, and `getWhen` methods.

- `get` is used get the current state of the query function, only once.
- `getWhen` takes as argument a function to which it'll pass data every time the subscription fires. This function must return a boolean. When it returns true, the Promise will resolve with the latest sub data.
- `subscribe` is used to subscribe to the query function and receive all subsequent updates. This method returns the function which must be called to unsubscribe.

Much like `call`, it takes the name of the function and an optional payload.

This method however has an extra optional argument, where one can decide to mark the subscription as `persistent`, which means that the latest data received from it will be stored in the browser's local storage, or for Node environments it'll save it to a folder which must be specified when creating the client instance, like so:

```ts
const client = new BasedClient(opts, {
  persistentStorage: 'path/to/directory',
})
```

This data will be used as placeholder the next time the client is started, allowing for snappy-feeling applications, since data will be showed before the connection is established.

### `based.stream(name: string, stream: StreamFunctionOpts, progressListener?: (progress: number) => void): Promise<any>`

```ts
await based.stream('db:file-upload', {
  payload: { hello: true },
  file: 'path/to/file',
  mimeType: 'text/typescript',
})

await based.stream('db:file-upload', {
  payload: { hello: true },
  contents: 'look text content',
})
```

This endpoint is used to stream data to a `stream` type based functions. These are useful for things like uploading files.

// TODO: list all options for this method

### `based.channel(name: string, payload?: any): BasedChannel`

```ts
client
  .channel('events', { type: 'pageview' })
  .subscribe((event) => console.info(event))

client.channel('events', { type: 'pageview' }).publish({ path: '/home' })
```

Channels are stateless event streams that users can use to send and receive real-time updates from the Based API. You can create a channel by calling the channel method on the client and passing a channel name and options.

// TODO: add more info on channels/examples

### `based.setAuthState(authState: AuthState): Promise<AuthState>`

```ts
await based.setAuthState({
  token: 'mock_token',
  renewToken: 'mock_renew_token',
  userId: 'usUser',
})
```

This endpoint is used to set an authState for this client's session. On the server, this will trigger a call to `verifyAuthState`.  
A client's authState may be modified by the server.

## Server-side functions

Most of the changes with this new infrastructure happened on the server.

Please make sure to include the `@based/functions` package in your project, where you can find function signatures, types, and helper functions useful for development.

Users will now be able to deploy several types of functions:

- `authorize`: specific type used for Authorize functions, either global or function-specific
- `function`: these are pieces of code which have side-effects, ie: `db:set`
- `query`: functions used to observe and retrieve data, ie: `db`
- `stream`: functions used to stream data to, for example to upload files
- `channel`: stateless event streams, ie analytics
- `job`: functions that are kept alive, useful for cronjobs and action triggered by a subscription or time
- `app`: to serve front-end applications

Many of these functions have among their arguments a `BasedFunctionClient` instance, a `Payload`, and a `Context`.

- `BasedFunctionClient` is similar to a normal BasedClient, but has access to functions marked as `internalOnly`.
- `Payload` is the payload sent by the BasedClient that invoked that function.
- `Context` is an object containing session information. It contains the connection's information, such as IP, protocol context (WebSocket or HTTP), authState, User Agent, and more.

### `authorize`

This type of server function has the following signature:

```ts
type Authorize = (
  based: BasedFunctionClient,
  context: Context<HttpSession | WebSocketSession>,
  name: string,
  payload?: any
) => Promise<boolean>
```

This function is used to check whether or not the request is authorized, by being executed right before the function being requested. The request is authorized if the function returns true, in which case the actual request is eecuted, and if the `authorize` returns false, the request doesn't move forward.

This function can be exported as a selfstanding function, in which case it'll be called before every other function that isn't public, or can be exported with the name `authorize` from within another function module, in which case it'll overwrite the generic `authorize` in favour of the specific one.

### `function`

This type of server function has the following signature:

```ts
type BasedFunction<P = any, K = any> = (
  based: BasedFunctionClient,
  payload: P,
  ctx: Context
) => Promise<K>
```

These are the simplest type of function, they are called with the user payload, and their return value is sent to the user as result.

### `query`

This type of server function has the following signature:

```ts
type BasedQueryFunction<P = any, K = any> =
  | ((
      based: BasedFunctionClient,
      payload: P,
      update: ObservableUpdateFunction<K>,
      error: ObserveErrorListener
    ) => Promise<() => void>)
  | ((
      based: BasedFunctionClient,
      payload: P,
      update: ObservableUpdateFunction<K>,
      error: ObserveErrorListener
    ) => () => void)
```

A user can subscribe to this function using `based.query()`, and they'll receive an update every time the `update` function is called, same as in the old system. Since this kind of function is shared, it has no access to a `Context` object.

Example:

```ts
const queryFunction = async (based, payload, update) => {
  let cnt = 0
  update(cnt)
  const counter = setInterval(() => {
    update(++cnt)
  }, 1000)
  return () => {
    clearInterval(counter)
  }
}
```

### `stream`

This type of server function has the following signature:

```ts
type BasedStreamFunction<P = any, K = any> = BasedFunction<StreamPayload<P>, K>
```

The `StreamPayload` object contains, in addition to a regular payload, information about the incoming stream, such as `mimeType`, `size` in bytes, `fileName`, `extension`, and of course the `stream` itself.

### `channel`

This type of server function has the following signature:

```ts
type BasedChannelFunction<P = any, K = any> = (
  based: BasedFunctionClient,
  payload: P,
  id: number,
  update: ChannelMessageFunction<K>,
  error: (err?: any) => void
) => () => void
```

### `job`

TODO

### `app`

TODO

## Default functions

Based provides some default functions to allow the user to interact with our database, as well as all the extra features Based provides.

Currently, these are the defaults we provide:

| Name              | Type     | Description                                    | Payload                                                               | Available on                             |
| ----------------- | -------- | ---------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `db`              | query    | Get and observe data from the database.        | A Based Query                                                         | `@based/env-hub`, `@based/env-admin-hub` |
| `db:set`          | function | Set data to the database.                      | A Based Query                                                         | `@based/env-hub`, `@based/env-admin-hub` |
| `db:schema`       | query    | Get and observe the schema of a database.      | `{ db?: string }` Optional, defaults to `default`                     | `@based/env-hub`, `@based/env-admin-hub` |
| `db:set-schema`   | function | Set schema of a database                       | A valid Schema object                                                 | `@based/env-hub`, `@based/env-admin-hub` |
| `db:delete`       | function | Delete node from database                      | `{ $id: string }` The id of the node to delete                        | `@based/env-hub`, `@based/env-admin-hub` |
| `db:origins`      | query    | List active origins                            | void                                                                  | `@based/env-hub`, `@based/env-admin-hub` |
| `analytics:track` | channel  | Publish analytics event. Cannot be listened to | any                                                                   | `@based/env-hub`, `@based/env-admin-hub` |
| `db:file-upload`  | stream   | Upload a file, store entry in the database.    | void                                                                  | `@based/env-hub`, `@based/env-admin-hub` |
| `db:events`       | channel  | Listen to a specific db event                  | `{ type: 'created' \| 'updated' \| 'deleted'; filter: DbGetOptions }` | `@based/env-hub`, `@based/env-admin-hub` |
