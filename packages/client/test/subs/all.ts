import anyTest, { TestInterface } from 'ava'
import { wait } from '@saulx/utils'
import '../assertions'
import { TestCtx, observe, startSubs } from '../assertions'

const test = anyTest as TestInterface<TestCtx>

test.serial('subscribing to all fields', async (t) => {
  await startSubs(t, {})
  const client = t.context.dbClient
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
  observe(t, get, (v: any) => {
    if (v.children[0]) {
      results.push(v.children[0].buttonText)
    }
  })

  client.set({
    $id: 'fo1',
    $language: 'en',
    children: [
      {
        $id: 'ma1',
        buttonText: 'my sallz',
      },
    ],
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sall',
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sa',
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sal',
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sallz',
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sallzzzz',
  })

  await wait(100)

  t.deepEqual(results, [
    'my sallz',
    'my sall',
    'my sa',
    'my sal',
    'my sallz',
    'my sallzzzz',
  ])
})
