import test from 'ava'
import { BasedSchema, setWalker } from '../src/index'
import { errorCollect, resultCollect } from './utils'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        color: {
          type: 'string',
          format: 'rgbColor',
        },
        name: {
          minLength: 3,
          maxLength: 6,
          type: 'string',
        },
        phonkName: {
          type: 'string',
          pattern: '\\${1,4}',
        },
        bla: {
          type: 'set',
          items: { type: 'string', minLength: 3, maxLength: 6 },
        },
      },
    },
  },
  $defs: {},
  language: 'en',
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
  },
}

test('string max length', async (t) => {
  const err1 = await setWalker(schema, {
    $id: 'bl1',
    name: 'ax',
  })

  const err2 = await setWalker(schema, {
    $id: 'bl1',
    name: 'axaxaxax',
  })
  const res1 = await setWalker(schema, {
    $id: 'bl1',
    name: 'xaxx',
  })

  t.assert(errorCollect(err1, err2).length > 0)
  t.deepEqual(resultCollect(res1), [{ path: ['name'], value: 'xaxx' }])
})

//set parser
test('set with strings', async (t) => {
  const err1 = await setWalker(schema, {
    $id: 'bl1',
    bla: ['ax', 'axa', 'axxxxa'],
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    bla: ['axx', 'axxxx', 'blaaa'],
  })

  t.assert(errorCollect(err1).length > 0)
  t.deepEqual(resultCollect(res1), [
    { path: ['bla'], value: { $value: ['axx', 'axxxx', 'blaaa'] } },
  ])
})

// this one causes weird array lenght issue in string max length test
test('string pattern', async (t) => {
  const err1 = await setWalker(schema, {
    $id: 'bl1',
    phonkName: 'blabla',
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    phonkName: 'bla$',
  })

  t.assert(errorCollect(err1).length > 0)
  t.deepEqual(resultCollect(res1), [{ path: ['phonkName'], value: 'bla$' }])
})

test('setting $default', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    phonkName: { $default: 'blabla' },
  })

  t.assert(err.errors.length > 0)

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    phonkName: { $default: 'bla$' },
  })

  t.deepEqual(resultCollect(res1), [
    { path: ['phonkName'], value: { $default: 'bla$' } },
  ])
})

test('setting $value', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    phonkName: { $value: 'blabla' },
  })
  t.is(err.errors.length, 1)
  const res1 = await setWalker(schema, {
    $id: 'bl1',
    phonkName: { $value: 'bla$' },
  })
  t.deepEqual(resultCollect(res1), [{ path: ['phonkName'], value: 'bla$' }])
})

test('setting color', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    color: 'rgba(255,255,255,0.1)',
  })
  t.is(err.errors.length, 0)
  const err2 = await setWalker(schema, {
    $id: 'bl1',
    color: 'rgba(255,255,255,0.1)x',
  })
  t.is(err2.errors.length, 1)
})
