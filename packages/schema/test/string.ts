import test from 'ava'
import { BasedSchema, setWalker } from '../src/index'
import { errorCollect, resultCollect } from './utils'

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
        email: {
          type: 'string',
          format: 'email',
        },
        uppercase: {
          type: 'string',
          format: 'uppercase',
        },
        readOnly: {
          type: 'string',
          readOnly: true,
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

  t.true(errorCollect(err1, err2).length === 2)
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

  t.true(err1.errors.length === 1)
  t.deepEqual(resultCollect(res1), [
    { path: ['bla'], value: { $value: ['axx', 'axxxx', 'blaaa'] } },
  ])
})

test('string pattern', async (t) => {
  const err1 = await setWalker(schema, {
    $id: 'bl1',
    phonkName: 'blabla',
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    phonkName: 'bla$',
  })

  t.true(err1.errors.length === 1)
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

test('email', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    email: 'gmail.com',
  })

  t.true(err.errors.length === 1)

  const r = await setWalker(schema, {
    $id: 'bl1',
    email: 'gmail@gmail.com',
  })

  t.deepEqual(resultCollect(r), [
    {
      path: ['email'],
      value: 'gmail@gmail.com',
    },
  ])
})

test('uppercase', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    uppercase: 'aASaasDASD',
  })

  t.true(err.errors.length === 1)

  const r = await setWalker(schema, {
    $id: 'bl1',
    uppercase: 'ASDASD',
  })

  t.deepEqual(resultCollect(r), [
    {
      path: ['uppercase'],
      value: 'ASDASD',
    },
  ])
})

//TODO?? not sure but readonly should throw an error or not?
test('readOnly', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    readOnly: 'aASaasDASD',
  })
  // console.log(resultCollect(err))
  t.true(err.errors.length === 1)
})
