import test from 'ava'
import { BasedSchema, setWalker } from '../src/index.js'
import { resultCollect } from './utils/index.js'

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
        ref: {
          type: 'reference',
        },
        children: {
          type: 'references',
        },
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
  language: 'en',
  translations: ['de', 'nl', 'ro', 'za', 'ae'],
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

  t.true(r.errors.length === 1)
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

test('reference to wrong type', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referenceToThing: 'blbla',
  })
  t.true(r.errors.length === 1)
})

test('references with wrongly formatted ids and incorrect types ', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: ['blbla', 'ti123', 'ewiohfdoweihfw'],
  })

  t.true(r.errors.length === 2)
})

test('references to empty array (clear)', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: [],
  })
  t.deepEqual(resultCollect(r), [
    { path: ['referencesToThings'], value: { $value: [] } },
  ])
  t.is(r.errors.length, 0)
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

test('reference to an object', async (t) => {
  r = await setWalker(
    schema,
    {
      $id: 'bl120',
      referenceToThing: {
        type: 'thing',
        priority: 9000,
      },
    },
    async (args) => {
      if (args.value.type === 'thing') {
        return 'tilil'
      } else {
        return 'bl1221'
      }
    }
  )

  t.is(r.errors.length, 0)

  t.deepEqual(resultCollect(r), [
    { path: ['referenceToThing'], value: 'tilil' },
  ])

  t.true(true)
})

test('nested references + $add (deep)', async (t) => {
  r = await setWalker(
    schema,
    {
      $id: 'bl1221',
      children: {
        $add: [
          {
            type: 'bla',
          },
        ],
      },
    },
    async (args) => {
      if (args.value.type === 'thing') {
        return 'tilil'
      } else {
        return 'bl1221'
      }
    }
  )
  t.is(r.errors.length, 0)
  t.deepEqual(resultCollect(r), [
    { path: ['children'], value: { $add: ['bl1221'] } },
  ])
})

test('nested ref + references', async (t) => {
  r = await setWalker(
    schema,
    {
      $id: 'bl1221',
      ref: {
        $id: 'bl1221',
      },
      children: [
        {
          $id: 'bl1221',
        },
      ],
    },
    async (args) => {
      if (args.value.type === 'thing') {
        return 'tilil'
      } else {
        return 'bl1221'
      }
    }
  )
  t.is(r.errors.length, 0)

  t.deepEqual(resultCollect(r), [
    { path: ['ref'], value: 'bl1221' },
    { path: ['children'], value: { $value: ['bl1221'] } },
  ])
})
