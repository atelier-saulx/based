import { basicTest } from './assertions/index.js'
import { subscribe } from '../src/index.js'
import { wait } from '@saulx/utils'

const test = basicTest()

test('subscribing to all fields', async (t) => {
  const client = t.context.client
  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      folder: {
        prefix: 'fo',
        fields: { title: { type: 'text' } },
      },
      match: {
        prefix: 'ma',
        fields: {
          published: { type: 'boolean' },
          buttonText: { type: 'text' },
        },
      },
    },
  })

  await client.set({
    $language: 'en',
    $id: 'fo1',
    children: [],
  })

  const get = {
    $id: 'fo1',
    $all: true,
    $language: 'en',
    children: {
      $list: true,
      $all: true,
    },
  }

  const results: any[] = []
  subscribe(client, get, (v: any) => {
    if (v.children[0]) {
      results.push(v.children[0].buttonText)
    }
  })

  await client.set({
    $id: 'fo1',
    $language: 'en',
    children: [
      {
        $id: 'ma1',
        buttonText: 'my sallz',
      },
    ],
  })
  await wait(300)

  await client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sall',
  })
  await wait(300)

  await client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sa',
  })
  await wait(300)

  await client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sal',
  })
  await wait(300)

  await client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sallz',
  })
  await wait(300)

  await client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sallzzzz',
  })

  await wait(300)

  t.deepEqual(results, [
    'my sallz',
    'my sall',
    'my sa',
    'my sal',
    'my sallz',
    'my sallzzzz',
  ])
})
