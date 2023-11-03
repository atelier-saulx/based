import anyTest, { TestInterface } from 'ava'
import { deepCopy, wait } from '@saulx/utils'
import '../assertions'
import { TestCtx, observe, startSubs } from '../assertions'
import { BasedSchemaPartial } from '@based/schema'

const test = anyTest as TestInterface<TestCtx>

const schema: BasedSchemaPartial = {
  language: 'en',
  types: {
    match: {
      prefix: 'ma',
      fields: {
        title: { type: 'text' },
        name: { type: 'string' },
        value: { type: 'number' },
        status: { type: 'number' },
        date: { type: 'number' },
      },
    },
    thing: {
      prefix: 'th',
      fields: {
        title: { type: 'text' },
        ary: {
          type: 'array',
          values: {
            type: 'object',
            properties: {
              title: { type: 'text' },
              name: { type: 'string' },
              value: {
                type: 'number',
              },
              status: {
                type: 'number',
              },
              date: {
                type: 'number',
              },
              intAry: {
                type: 'array',
                values: { type: 'integer' },
              },
            },
          },
        },
        intAry: {
          type: 'array',
          values: { type: 'integer' },
        },
      },
    },
  },
}

test.serial('subscription array', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

  const thing = await client.set({
    type: 'thing',
    title: { en: 'thing' },
  })

  const matches: any[] = []

  await wait(500)

  for (let i = 0; i < 10; i++) {
    matches.push({
      $id: thing,
      ary: {
        $push: {
          name: 'match ' + i,
          value: i,
          status: i < 5 ? 100 : 300,
        },
      },
    })
  }

  await Promise.all(matches.map((v) => client.set(v)))

  await wait(500)
  console.info(
    await client.get({
      $id: thing,
      ary: {
        name: true,
        $list: true,
      },
    })
  )

  let lastResult
  let cnt = 0
  observe(
    t,
    {
      $id: thing,
      ary: true,
    },
    (d) => {
      lastResult = deepCopy(d)
      cnt++
    }
  )

  await wait(1000)
  t.is(cnt, 1)

  await client.set({
    $id: thing,
    ary: {
      $assign: {
        $idx: 0,
        $value: {
          name: 'FLURP!',
        },
      },
    },
  })

  await wait(1000)
  t.is(cnt, 2)

  await client.set({
    $id: thing,
    ary: {
      $push: {
        name: 'match hello now',
      },
    },
  })

  await wait(1000)

  t.is(cnt, 3)

  t.deepEqual(lastResult.ary[lastResult.ary.length - 1], {
    name: 'match hello now',
  })

  let cnt2 = 0
  let lastResult2
  observe(
    t,
    {
      $id: thing,
      $language: 'en',
      ary: {
        name: true,
        title: true,
        type: true,
        $list: true,
      },
    },

    (d) => {
      lastResult2 = deepCopy(d)
      cnt2++
    }
  )

  await wait(2000)

  await client.set({
    $id: thing,
    ary: {
      $assign: {
        $idx: 0,
        $value: {
          title: { en: 'Flapdrol' },
        },
      },
    },
  })

  await wait(2000)

  t.is(cnt2, 2)

  await client.set({
    $id: thing,
    ary: {
      $push: {
        title: { en: 'Flapdrollll' },
      },
    },
  })

  await wait(2000)

  t.is(cnt2, 3)
  t.deepEqual(lastResult2.ary[lastResult2.ary.length - 1], {
    title: 'Flapdrollll',
  })
})

test.serial('subscription num array', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

  const thing = await client.set({
    type: 'thing',
    title: { en: 'thing' },
  })

  const matches: any[] = []

  await wait(500)

  for (let i = 0; i < 10; i++) {
    matches.push({
      $id: thing,
      intAry: {
        $push: i,
      },
    })
  }

  await Promise.all(matches.map((v) => client.set(v)))

  await wait(500)

  let cnt = 0
  observe(
    t,
    {
      $id: thing,
      intAry: true,
    },
    (d) => {
      cnt++
    }
  )

  await wait(1000)

  await client.set({
    $id: thing,
    intAry: {
      $assign: {
        $idx: 0,
        $value: 982,
      },
    },
  })

  await wait(1000)
  t.is(cnt, 2)
})

test.serial('subscription array in object array', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

  const thing = await client.set({
    type: 'thing',
    title: { en: 'thing' },
  })

  const matches: any[] = []

  await wait(500)

  for (let i = 0; i < 10; i++) {
    matches.push({
      $id: thing,
      ary: {
        $push: {
          name: 'match ' + i,
          intAry: {
            $push: i,
          },
        },
      },
    })
  }

  await Promise.all(matches.map((v) => client.set(v)))

  await wait(500)

  let cnt = 0
  observe(
    t,
    {
      $id: thing,
      ary: true,
    },
    (d) => {
      cnt++
    }
  )

  await wait(1000)

  await client.set({
    $id: thing,
    ary: {
      $insert: {
        $idx: 0,
        $value: {
          name: 'match 99',
        },
      },
    },
  })

  await wait(1000)

  await client.set({
    $id: thing,
    ary: {
      $assign: {
        $idx: 2,
        $value: {
          intAry: {
            $push: 99,
          },
        },
      },
    },
  })

  await wait(1000)

  t.is(cnt, 3)
})
