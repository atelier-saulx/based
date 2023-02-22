# @based/client

Based client

```js
import based from '@based/client'

// Create client
const client = based({
  env: 'myEnv',
  org: 'myOrg',
  project: 'myProject'
})

client.once('connect', (isConnected) => {
  console.info('connect', isConnected)
})

// Authenticate and use localStorage or a file in node
const authState = await client.setAuthState({
  token,
  persistent: true
})

// Call a function
await client.call('db:update-schema', {
  languages: ['en'],
  types: {
    thing: {
      fields: {
        name: { type: 'string' },
      },
    },
  },
})

// Get data once
const data = await client
  .query('db', { $id: 'fwe2233', title: true })
  .get()

// Get updates, persitent stores results in localStorage
const unsubscribe = client
  .query('db', { $id: 'fwe2233', title: true }, { persistent: true })
  .subscribe((data) => console.log(data))

// Channels are stateless streams
const unsubscribeChannel = client.channel('events', { type: 'page-view' })
  .subscribe(event => console.log(event))

client
  .channel('events', { type: 'page-view' })
  .publish({ id: 'mypage' })
```
