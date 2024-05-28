# @based/solid

Wraps the [`@based/client`](https://github.com/atelier-saulx/based/tree/main/packages/client) into SolidJS hooks and signals

# W.I.P.
```jsx
import { useBasedQuery, useBasedClient, useAuthState,  Provider } from '@based/react'
import based from '@based/client'

// Create client
const client = based({
  env: 'myEnv',
  org: 'myOrg',
  project: 'myProject',
})

export const Authenticate = ({ children }) => {
  // Observes id a user is authenticated
  const authState = useAuthState()

  // Returns the based client from the provider
  const client = useBasedClient()

  if (authState.token) {
    // When authenticated render the app
    return children
  }

  return <button onClick={() => {
     // Authenticate and use localStorage
     await client.setAuthState({
      token: 'my-token',
      persistent: true,
     })
   }} />
}

export const Something = () => {
  // Subscribes to data
  const { data, error, loading } = useBasedQuery('db', {
    children: { $list: true, id: true, name: true },
  })

  return <div>{loading ? 'loading...' : data.children.map(
    { id, name } => <p onClick={() => {
        client.call('db:delete', { id })
    }} key={id}>{name}</p>)
  }</div>
}

export const App = () => {
  return <Provider client={client}>
    <Authenticate><Something /></Authenticate>
  </Provider>
}

```

## useBasedQuery

Subscribes when a component gets mounted / unsubscribes when a comment gets unmounted.
Query hooks are automaticly cached and share remote active subscriptions.

```js
import { useBasedQuery } from '@based/react'

export const Something = () => {
  const { data, error, loading } = useBasedQuery('someQueryFunction')
  if (error) {
    return error.message
  }
  return <div>{loading ? 'loading...' : data.text}</div>
}
```

The `persistent` option will store the cached result of a query in `localStorage`.

```js
const { data: userInfo } = useBasedQuery(
  'someUserInfo',
  {
    id: client.authState.userId,
  },
  { persistent: true }
)
```

`useBasedQuery` allows passing a `null` value to the function name - this is usefull when you have a query depending on other data

```js
const { data: userInfo } = useBasedQuery('someUserInfo', {
  id: client.authState.userId,
})

const { data } = useBasedQuery(
  userInfo.preferedLanguage ? 'someQueryFunction' : null,
  {
    preferedLanguage: userInfo.preferedLanguage,
  }
)
```

## useBasedClient

Returns the based client from the `Provider`

```js
import { useBasedClient, Provider } from '@based/react'
import based from '@based/client'

// Create client
const client = based({
  env: 'myEnv',
  org: 'myOrg',
  project: 'myProject',
})

export const Something = () => {
  const client = useBasedClient()
  useEffect(() => {
    client.call('domSomething')
  }, [])
}

export const App = () => {
  return (
    <Provider client={client}>
      <Something />
    </Provider>
  )
}
```

## useConnected

Observes the connected state of the based client.

```js
import { useConnected } from '@based/react'

export const Something = () => {
  const isConnected = useConnected()
  if (isConnected) {
    return 'connected!'
  }
  return 'not connected :('
}
```

## useLoading

Observes if any active `useBasedQuery` hook is loading.

```js
import { useLoading } from '@based/react'

export const Something = () => {
  const isLoading = useLoading()
  if (isLoading) {
    return 'some data is loading'
  }
  return 'everything is loaded'
}
```

## useAuthState

Observe if a client is authenticated.

```js
import { useAuthState } from '@based/react'

export const Something = () => {
  const authState = useAuthState()
  if (authState.token) {
    return `User ${authState.userId} is authenticated`
  }
  if (authState.error) {
    console.log('An error authenticating', authState.error)
  }
  return 'not authenticated'
}
```
