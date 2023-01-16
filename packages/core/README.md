# @based/core

```
import based from '@based/core-client'

// create client
const client = based()

// connect
client.connect({
  env: 'myEnv',
  org: 'myOrg',
  project: 'myProject'
})

client.once('connect', (isConnected) => {
  console.info('connect', isConnected)
})

// authorize
const authState = await client.auth(token)

await client.call('db:update-schema', {
  languages: ['en'],
  types: {
    thing: {
      prefix: 'th',
      fields: {
        name: { type: 'string' },
      },
    },
  },
})

const data = await client
  .query('db', { id: 'fwe2233', title: true })
  .get()

const unsubscribe = client
  .query('db', { id: 'fwe2233', title: true })
  .subscribe((data) => console.log(data))
```
