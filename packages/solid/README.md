# @based/solidjs

Wraps the [`@based/client`](https://github.com/atelier-saulx/based/tree/main/packages/client) into SolidJS hooks and signals

```tsx
import { Show } from 'solid-js'
import type { Component } from 'solid-js'
import { useBasedQuery, useBasedClient, BasedProvider } from '@based/solidjs'
import based, { BasedClient } from '@based/client'

const client: BasedClient = based({
    env: 'myEnv',
    org: 'myOrg',
    project: 'myProject'
})

const LoadingData: Component = () => {
    return (
        <div>Loading data...</div>
    )
}

const UsersList: Component = () => {
    const {data, error, loading} = useBasedQuery(
        'counter',
        {
            count: true,
            speed: 3000
        }
    )

    return (
        <Show when={data.children.length && !loading} fallback={LoadingData}>
            <div>
                {(
                    data =>
                        data.children.map(({id, name}) =>
                            <p onClick={() => { client.call('db:delete', {id})}}>{name}</p>
                        )
                )}
            </div>
        </Show>
    )
}

const App: Component = () => {
    return (
        <BasedProvider client={client}>
            <UsersList/>
        </BasedProvider>
    )
}
```

## BasedProvider
Solid Component that inject the `BasedClient` context thought the application.

### Aliasing
```tsx
<BasedProvider client={client}>
    {/*slot*/}
</BasedProvider>
```
or (**in deprecation process**)
```tsx
<Provider client={client}>
    {/*slot*/}
</Provider>
```

### Props
| Parameter | Type           | Default  | Description                                                              | Required   |
|-----------|----------------|----------|--------------------------------------------------------------------------|------------|
| `client`  | `BasedClient`  | **N/A**  | All the connection information that identifies you in the `Based` cloud. | **true**   |

### Slots
| Name    | Content                                                          | Required  |
|---------|------------------------------------------------------------------|-----------|
| **N/A** | Any component that you want to inject the `BasedClient` context. | **true**  |

### Emits
None

Basic example:
```tsx
const App: Component = () => {
    return (
        <BasedProvider client={client}>
            <UsersList/> // Will receive the BasedClient context injected by the Provider.
        </BasedProvider>
    )
}
```

## useBasedClient
The `BasedClient` object with the information about the connection with the `Based` server. You cal also call functions using the client object.

### Aliasing
```ts
const client = useBasedClient()
```
or (**in deprecation process**)
```ts
const client = useClient()
```

### Params
None

### Response
The `BasedClient` object.

```tsx
import { useBasedClient, BasedProvider } from '@based/solidjs'
import based, { BasedClient } from '@based/client'
import type { Component } from 'solid-js'

const client: BasedClient = based({
    env: 'myEnv',
    org: 'myOrg',
    project: 'myProject'
})

const doSomething = (): void => {
    const client = useBasedClient()
    client.call('doSomething')
}

const context: BasedClient = useBasedClient()

const App: Component = () => {
    return (
        <BasedProvider client={client}>
            <button onClick={() => doSomething()}/>
            <p>WebSockets URL: {context.opts.url.toString()}</p>
        </BasedProvider>
    )
}
```

## useBasedQuery
Subscribes when a component gets mounted / unsubscribes when a comment gets unmounted

```ts
const useBasedQuery = <N extends keyof BasedQueryMap>(
    db: N,
    payload?: BasedQueryMap[N]['payload'],
    opts?: BasedQueryOptions,
): BasedQueryResult<BasedQueryMap[N]['result']> => {}
```
### Aliasing
```ts
const { data, error, loading } = useBasedQuery('myQueryFunction')
```
or (**in deprecation process**)
```ts
const { data, error, loading } = useQuery('myQueryFunction')
```

### Types
<details>
  <summary>BasedQueryMap</summary>

```ts
type BasedQueryMap = {
  db: { payload: any; result: any }
  [key: string]: { payload: any; result: any }
}
```
</details>

<details>
  <summary>BasedQueryOptions</summary>

```ts
type BasedQueryOptions = {
    persistent: boolean
}
```
</details>

<details>
  <summary>BasedQueryResult</summary>

```ts
type BasedQueryResult<T> = {
    loading: boolean
    data?: T
    error?: BasedError
    checksum?: number
}
```
</details>

<details>
  <summary>BasedError</summary>

```ts
class BasedError extends Error {
    public statusMessage?: string
    public code?: BasedErrorCode
}
```
</details>

### Params
| Parameter | Type            | Default                 | Description                                                                                                                                     | Required  |
|-----------|-----------------|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|-----------|
| `db`      | `string`/`null` | **N/A**                 | The query function name                                                                                                                         | **true**  |
| `payload` | `object`        | **N/A**                 | Filters and other possible mutations that you want from the query                                                                               | **false** |
| `opts`    | `object`        | `{ persistent: false }` | When is **true** will store the cached result of a query in `localStorage` on the client-side. Otherwise, the cache is only in volatile memory. | **false** |

### Response
| Key        | Type         | Always present | Description                                                                                              |
|------------|--------------|----------------|----------------------------------------------------------------------------------------------------------|
| `loading`  | `boolean`    | `true`         | If the query is still loading.                                                                           |
| `data`     | `any`        | `false`        | The data coming from your filters.                                                                       |
| `error`    | `BasedError` | `false`        | The `BasedError` object containing the `statusMessage` and `code` from your error.                       |
| `checksum` | `number`     | `false`        | A calculated value used to verify data integrity and detect errors. Each response has a unique checksum. |

Basic example:
```tsx
import { useBasedQuery } from '@based/solidjs'
import type { Component } from 'solid-js'

const ProcessData: Component = () => {
    const { data, error, loading } = useBasedQuery('myQueryFunction')
    
    if (error) {
        return error.message
    }
    
    return (
        <Show when={data.text && !loading} fallback={<div>Loading data...</div>}>
            <div>data.text</div>
        </Show>
    )
}
```

To persist the result of the query on `localStorage` on the client-side, pass `persistent` as true.
```ts
const { data: userInfo } = useBasedQuery(
    'someUserInfo',
    {
        id: client.authState.userId
    },
    { 
        persistent: true
    }
)
```

Is also possible to pass a `null` value to the function name. This is useful when you have a query depending on other data, like Auth.
```ts
const { data: userInfo } = useBasedQuery('someUserInfo', { id: client.authState.userId })

const { data } = useBasedQuery(
    userInfo.preferedLanguage ? 'someQueryFunction' : null,
    {
        preferedLanguage: userInfo.preferedLanguage
    }
)
```

## useBasedAuth
Check the authorization state from the `Based` client.

### Aliasing
```ts
const auth = useBasedAuth()
```
or (**in deprecation process**)

```ts
const auth = useAuthState()
```

### Params
None

### Response
| Key            | Type      | Always present | Description                                                    |
|----------------|-----------|----------------|----------------------------------------------------------------|
| `token`        | `string`  | `false`        | The connection token                                           |
| `userId`       | `string`  | `false`        | The connected userID.                                          |
| `refreshToken` | `string`  | `false`        | If there is a new token provided.                              |
| `error`        | `string`  | `false`        | If the auth fails, an error message will be provided.          |
| `persistent`   | `string`  | `false`        | If the auth values are being stored locally on `localStorage`. |
| `type`         | `string`  | `false`        | N/A.                                                           |

```ts
import { useBasedAuth } from '@based/solidjs'

const IsUserAuthorized = () => {
    const { error, token, userId } = useBasedAuth()
    
    if (!error || !token || !userId) {
        return 'Not authorized 😭'
    }
    
    return 'Authorized! 🎉'
}
```

## useBasedStatus
Get the connection status from the `Based` client.

### Aliasing
```ts
const client = useBasedStatus()
```
or (**in deprecation process**)
```ts
const client = useStatus()
```

### Enums
<details>
  <summary>BasedStatus</summary>

```ts
enum BasedStatus {
    DISCONNECT = 'disconnect',
    RECONNECT = 'reconnect',
    CONNECT = 'connect'
}
```
</details>

### Params
None

### Response
| Key         | Type          | Always present | Description                              |
|-------------|---------------|----------------|------------------------------------------|
| `connected` | `boolean`     | `true`         | If the connection is established or not. |
| `status`    | `BasedStatus` | `true`         | One of the three possible status.        |

```ts
import { useBasedStatus } from '@based/solidjs'

const IsBasedConnected = () => {
    const { connected } = useBasedStatus()
    
    if (!connected) {
        return 'Not connected 😭'
    }
    
    return 'Connected! 🎉'
}
```
