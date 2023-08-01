import test from 'ava'
import { BasedSchema, setWalker2 } from '../src/index'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
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
  languages: ['en'],
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
  },
}

test('string max length', async (t) => {
  const err1 = await setWalker2(schema, {
    $id: 'bl1',
    name: 'ax',
  })

  const err2 = await setWalker2(schema, {
    $id: 'bl1',
    name: 'axaxaxax',
  })
  const res1 = await setWalker2(schema, {
    $id: 'bl1',
    name: 'xaxx',
  })

  console.log(err1.errors)
  console.log(err2.errors)
  const err = [err2.errors]
  const res = [res1]

  // t.assert(err[0].length === 2)
  t.deepEqual(res[0].target.collected, [{ path: ['name'], value: 'xaxx' }])
})

//set parser
test('set with strings', async (t) => {
  const err1 = setWalker2(schema, {
    $id: 'bl1',
    bla: ['ax', 'axa', 'axxxxa'],
  })

  const res1 = await setWalker2(schema, {
    $id: 'bl1',
    bla: ['axx', 'axxxx', 'blaaa'],
  })

  const err = [(await err1).errors]
  const res = [await res1]

  // t.assert(err[0].length === 1)
  t.deepEqual(res[0].target.collected, [
    { path: ['bla'], value: { $value: ['axx', 'axxxx', 'blaaa'] } },
  ])
})

// this one causes weird array lenght issue in string max length test
test('string pattern', async (t) => {
  const err1 = await setWalker2(schema, {
    $id: 'bl1',
    phonkName: 'blabla',
  })

  const res1 = await setWalker2(schema, {
    $id: 'bl1',
    phonkName: 'bla$',
  })

  const err = [err1.errors]

  const res = [res1]
  // t.assert(err[0].length === 1)
  t.deepEqual(res[0].target.collected, [{ path: ['phonkName'], value: 'bla$' }])
})

test('setting $default', async (t) => {
  const err = await setWalker2(schema, {
    $id: 'bl1',
    phonkName: { $default: 'blabla' },
  })
  t.assert(err.errors.length > 1)

  const res1 = await setWalker2(schema, {
    $id: 'bl1',
    phonkName: { $default: 'bla$' },
  })

  const res = [res1]
  console.log(res) // is ok
  console.log(res1) // isnt ok???

  t.deepEqual(res[0].target.collected, [
    { path: ['phonkName'], value: { $default: 'bla$' } },
  ])
})

test('setting $value', async (t) => {
  const err = await setWalker2(schema, {
    $id: 'bl1',
    phonkName: { $value: 'blabla' },
  })
  t.assert(err.errors.length > 1)

  const res1 = await setWalker2(schema, {
    $id: 'bl1',
    phonkName: { $value: 'bla$' },
  })

  const res = [res1]
  console.log(res) // is ok
  console.log(res1) // isnt ok???

  t.deepEqual(res[0].target.collected, [
    { path: ['phonkName'], value: { $value: 'bla$' } },
  ])
})
