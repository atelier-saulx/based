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

await client.query('db', { id: 'fwe2233', title: true }).get()

await client.query('db', { id: 'fwe2233', title: true }).subscribe((x) => console.log(x))
```
