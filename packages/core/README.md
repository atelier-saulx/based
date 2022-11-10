# @based/core

```
import { BasedCoreClient } from '@based/core-client'

// create client
const coreClient = new BasedCoreClient()

// connect
coreClient.connect({
  env: 'myEnv',
  org: 'myOrg',
  project: 'myProject'
})

coreClient.once('connect', (isConnected) => {
  console.info('connect', isConnected)
})

// authorize
const authState = await coreClient.auth(token)

// update schema
await coreClient.function('based-db-update-schema', {
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

// observe
coreClient.observe(
   'based-db-observe',
   (d) => {
     console.info('|-->', d)
   },
   { children: { name: true, id: true, $list: true } }
 )

// set (or any function)
const res = await coreClient.function('based-db-set', {
  type: 'thing',
  name: 'BLAAAA',
})

// get from observer
const res = await coreClient.get('based-db-observe')
```
