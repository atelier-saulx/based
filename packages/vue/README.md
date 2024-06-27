# @based/vue

Wraps the [`@based/client`](https://github.com/atelier-saulx/based/tree/main/packages/client) into Vue3 hooks and refs.

```vue
<script lang="ts" setup>
  import { inject } from 'vue'
  import type { BasedClient } from '@based/client'
  import { BasedContext, useBasedQuery } from '@based/vue'

  const client: BasedClient = inject(BasedContext.CLIENT)

  const { data, error, loading } = useBasedQuery(
      'counter',
      {
        count: true,
        speed: 3000
      }
  )
</script>

<template>
  <div v-if="data.children.length && !loading">
    <div v-for="(child in data.children)">
      <p @click="client.call('db:delete', {id: child.id})">{{child.name}}</p>
    </div>
  </div>
</template>
```

## BasedProvider
Solid Component that inject the `BasedClient` context thought the application.

### Aliasing
```vue
<BasedProvider :client="client">
  {/*slot*/}
</BasedProvider>
```
or (**in deprecation process**)
```vue
<Provider :client="client">
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
```vue
<script lang="ts" setup>
  import based, { BasedClient } from '@based/client'
  import { BasedProvider } from '@based/vue'

  const client: BasedClient = based({
    env: 'myEnv',
    org: 'myOrg',
    project: 'myProject'
  })
</script>

<template>
  <BasedProvider :client="client">
    <!-- Your app goes here. -->
    <!-- You'll can use inject to get the client context in any child component. -->
  </BasedProvider>
</template>
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

Basic example with static parameters:
```vue
<script lang="ts" setup>
  import { useBasedQuery } from '@based/vue'

  // With static parameters you may destruct the returned object.
  // The returned object will contain { data, loading, error, checksum } as reactive Refs.
  const { data, loading, error, checksum } = useBasedQuery('counter', {
    count: true,
  })
</script>
```
Basic example with dynamic parameters:
```vue
<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { useBasedQuery } from '@based/vue'

  // Update these values anywhere in your component.
  const name = ref<string>()
  const payload = ref<any>()

  // Don't destruct the returned object, will break the reactivity.
  // The returned object will contain { data, loading, error, checksum } as reactive Refs.
  // Use as 'query.data.value', 'query.loading.value', 'query.error.value', 'query.checksum.value'.
  const query = computed(() => useBasedQuery(name.value, payload.value))
</script>
```

To persist the result of the query on `localStorage` on the client-side, pass `persistent` as `true`.
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
import { useBasedAuth } from '@based/vue'

const IsUserAuthorized = () => {
  // The returned object is a Ref.
  // Don't destruct the returned object, will break the reactivity.
  // Use as 'auth.value.token', 'auth.value.userId', 'auth.value.error'...
  const auth = useBasedAuth()

  if (!auth.value.error || !auth.value.token || !auth.value.userId) {
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
import { useBasedStatus } from '@based/vue'

const IsBasedConnected = () => {
  // The returned object will contain { connected, status } as reactive Refs.
  const { connected } = useBasedStatus()

  if (!connected.value) {
    return 'Not connected 😭'
  }

  return 'Connected! 🎉'
}
```
