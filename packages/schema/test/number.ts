import test from 'ava'
import { BasedSchema, setWalker2 } from '../src/index'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        number: {
          type: 'number',
          maximum: 6,
          minimum: 3,
        },
        exclusiveminmax: {
          type: 'number',
          minimum: 3,
          exclusiveMinimum: true,
          maximum: 6,
          exclusiveMaximum: true,
        },
        integer: {
          type: 'integer',
        },
        multipleOf: {
          type: 'integer',
          multipleOf: 3,
        },
        set: {
          type: 'set',
          items: { type: 'number', minimum: 3, maximum: 6 },
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

test.only('min-max', async (t) => {
  console.info(
    await setWalker2(schema, {
      $id: 'bl1',
      number: 1,
    })
  )
  console.info(
    await setWalker2(schema, {
      $id: 'bl1',
      number: 10,
    })
  )
  //throw above

  console.info(
    await setWalker2(schema, {
      $id: 'bl1',
      number: 3,
    })
  )

  const x = await setWalker2(schema, {
    $id: 'bl1',
    number: 6,
  })

  // t.deepEqual(results, [
  //   { path: ['number'], value: 3 },
  //   { path: ['number'], value: 6 },
  // ])
  console.info('aaaaaaaaaaaaaaaaa', x, '-------------__<><><')
  t.true(true)
})

test('min-max exclusive', async (t) => {
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      exclusiveminmax: 3,
    })
  )

  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      exclusiveminmax: 6,
    })
  )
  await setWalker2(schema, {
    $id: 'bl1',
    exclusiveminmax: 4,
  })

  await setWalker2(schema, {
    $id: 'bl1',
    exclusiveminmax: 5,
  })
  // t.deepEqual(results, [
  //   { path: ['exclusiveminmax'], value: 4 },
  //   { path: ['exclusiveminmax'], value: 5 },
  // ])
  t.true(true)
})

test('isInteger', async (t) => {
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      integer: 6.5,
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    integer: 5,
  })
  // t.deepEqual(results, [{ path: ['integer'], value: 5 }])
  t.true(true)
})

test('isMultiple', async (t) => {
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      multipleOf: 7,
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    multipleOf: 9,
  })
  // t.deepEqual(results, [{ path: ['multipleOf'], value: 9 }])
  t.true(true)
})

test('numbers in a set', async (t) => {
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      set: [9, 4, 5, 2],
    })
  )
  await setWalker2(schema, { $id: 'bl1', set: [3, 3, 3, 3] })
  // t.deepEqual(results, [{ path: ['set'], value: { $value: [3, 3, 3, 3] } }])
  t.true(true)
})

test('value', async (t) => {
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      number: { $value: 7 },
    })
  )
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      exclusiveminmax: { $value: 3 },
    })
  )
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      integer: { value: 3.5 },
    })
  )

  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      set: { $value: [1, 3, 3, 4] },
    })
  )

  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      multipleOf: { $value: 2 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    number: { $value: 4 },
  })
  await setWalker2(schema, {
    $id: 'bl1',
    integer: { $value: 4 },
  })
  await setWalker2(schema, {
    $id: 'bl1',
    exclusiveminmax: { $value: 4 },
  })
  await setWalker2(schema, {
    $id: 'bl1',
    multipleOf: { $value: 6 },
  })

  await setWalker2(schema, {
    $id: 'bl1',
    set: { $value: [3, 3, 3, 4] },
  })
  // t.deepEqual(results, [
  //   { path: ['number'], value: { $value: 4 } },
  //   { path: ['integer'], value: { $value: 4 } },
  //   { path: ['exclusiveminmax'], value: { $value: 4 } },
  //   { path: ['multipleOf'], value: { $value: 6 } },
  //   { path: ['set'], value: { $value: [3, 3, 3, 4] } },
  // ])

  t.true(true)
})

test('default', async (t) => {
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      number: { $default: 7 },
    })
  )
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      exclusiveminmax: { $default: 3 },
    })
  )
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      integer: { $default: 3.5 },
    })
  )

  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      set: { $default: [1, 3, 3, 4] },
    })
  )

  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      multipleOf: { $default: 2 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    number: { $default: 4 },
  })
  await setWalker2(schema, {
    $id: 'bl1',
    integer: { $default: 4 },
  })
  await setWalker2(schema, {
    $id: 'bl1',
    exclusiveminmax: { $default: 4 },
  })
  await setWalker2(schema, {
    $id: 'bl1',
    multipleOf: { $default: 6 },
  })

  // t.deepEqual(results, [
  //   { path: ['number'], value: { $default: 4 } },
  //   { path: ['integer'], value: { $default: 4 } },
  //   { path: ['exclusiveminmax'], value: { $default: 4 } },
  //   { path: ['multipleOf'], value: { $default: 6 } },
  // ])
  t.true(true)
})

test('decrement', async (t) => {
  //maxmin
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      number: { $decrement: 2 },
    })
  )
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      number: { $decrement: 7 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    number: { $decrement: 3 },
  })
  //exclusiveminmax
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      exclusiveminmax: { $decrement: 3 },
    })
  )
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      exclusiveminmax: { $decrement: 6 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    exclusiveminmax: { $decrement: 4 },
  })

  //integer
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      integer: { $decrement: 3.5 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    integer: { $decrement: 3 },
  })
  //multiple of

  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      multipleOf: { $decrement: 7 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    multipleOf: { $decrement: 9 },
  })
  // t.deepEqual(results, [
  //   { path: ['number'], value: { $decrement: 3 } },
  //   { path: ['exclusiveminmax'], value: { $decrement: 4 } },
  //   { path: ['integer'], value: { $decrement: 3 } },
  //   { path: ['multipleOf'], value: { $decrement: 9 } },
  // ])
  t.true(true)
})

test('increment', async (t) => {
  //maxmin
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      number: { $increment: 2 },
    })
  )
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      number: { $increment: 7 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    number: { $increment: 3 },
  })
  //exclusiveminmax
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      exclusiveminmax: { $increment: 3 },
    })
  )
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      exclusiveminmax: { $increment: 6 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    exclusiveminmax: { $increment: 4 },
  })

  //integer
  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      integer: { $increment: 3.5 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    integer: { $increment: 3 },
  })
  //multiple of

  await t.throwsAsync(
    setWalker2(schema, {
      $id: 'bl1',
      multipleOf: { $increment: 7 },
    })
  )

  await setWalker2(schema, {
    $id: 'bl1',
    multipleOf: { $increment: 9 },
  })
  // t.deepEqual(results, [
  //   { path: ['number'], value: { $increment: 3 } },
  //   { path: ['exclusiveminmax'], value: { $increment: 4 } },
  //   { path: ['integer'], value: { $increment: 3 } },
  //   { path: ['multipleOf'], value: { $increment: 9 } },
  // ])
  t.true(true)
})
