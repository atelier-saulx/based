import test from 'ava'
import { BasedSchema, setWalker } from '../src/index'
import { resultCollect, errorCollect } from './utils'
import { ParseError } from '../src/error'

const schema: BasedSchema = {
  types: {
    thing: {
      prefix: 'ti',
      fields: {
        priority: { type: 'number' },
        something: { type: 'string', format: 'strongPassword' },
      },
    },
    bla: {
      prefix: 'bl',
      fields: {
        referencesToThings: {
          type: 'references',
          allowedTypes: ['thing'],
        },
        referenceToThing: {
          type: 'reference',
          allowedTypes: ['thing'],
        },
      },
    },
  },
  $defs: {},
  languages: ['en', 'de', 'nl', 'ro', 'za', 'ae'],
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
    ti: 'thing',
  },
}

let r

test('simple error', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referenceToThing: 'sdfefewfewfewewffwe',
  })

  t.true(r.errors.lengt === 1)
})

test('simple case ', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referenceToThing: 'tibla',
  })

  t.deepEqual(resultCollect(r), [
    { path: ['referenceToThing'], value: 'tibla' },
  ])
})

test('refernce to wrong thing', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referenceToThing: 'blbla',
  })
  t.true(r.errors.length === 1)
})

test('refernces 0,2 wrong', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: ['blbla', 'ti123', 'ewiohfdoweihfw'],
  })

  t.true(r.errors.length === 2)
})

test('$remove references', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: { $remove: ['ti123'] },
  })

  t.deepEqual(resultCollect(r), [
    { path: ['referencesToThings'], value: { $remove: ['ti123'] } },
  ])
})

test('$add 0 2 wrong', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: { $add: ['blbla', 'ti123', 'ewiohfdoweihfw'] },
  })

  t.true(r.errors.length === 2)
})

test('$add correct ', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: { $add: 'ti123' },
  })

  t.deepEqual(resultCollect(r), [
    { path: ['referencesToThings'], value: { $add: ['ti123'] } },
  ])
})

test('$remove $value not allowed', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: { $remove: { $value: 'ti123' } },
  })

  t.true(r.errors.length > 0)
})

// reference object
test.only('reference to an object', async (t) => {
  r = await setWalker(
    schema,
    {
      $id: 'bl120',
      referenceToThing: {
        type: 'thing',
        priority: 9000,
      },
    },
    async (args, type) => {
      if (args.value.type === 'thing') {
        return 'ti' + Math.floor(Math.random() * 10000).toString(16)
      } else {
        return 'bl1221'
      }
    }
  )
  console.dir(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )
  t.true(true)
})
