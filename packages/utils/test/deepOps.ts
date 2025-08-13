import test from 'ava'
import { deepCopy, deepMerge, deepMergeArrays } from '../src/index.js'

test('deepCopy', async (t) => {
  const bla = {
    x: {
      bla: 'x',
    },
  }
  t.deepEqual(deepCopy(bla), bla)
})

test('deepCopy ArrayBuffer', async (t) => {
  const bla = {
    x: {
      bla: 'x',
      x: new Uint8Array([1, 2, 3, 4]),
      y: new Uint16Array([1, 2, 3, 4]),
      z: new Float64Array([1, 2, 3, 4]),
    },
  }
  t.deepEqual(deepCopy(bla), bla)
})

test('deepMergeArrayMulti', async (t) => {
  const r = deepMergeArrays(
    {},
    {
      a: [{ a: true }],
    },
    {
      a: [{ b: true }],
    },
    {
      a: [{ c: true }],
    },
    {
      a: [{ d: true }],
    }
  )

  // const m = deepMerge(
  //   {},
  //   {
  //     a: [{ a: true }],
  //   },
  //   {
  //     a: [{ b: true }],
  //   },
  //   {
  //     a: [{ c: true }],
  //   },
  //   {
  //     a: [{ d: true }],
  //   }
  // )

  t.deepEqual(r, {
    a: [
      {
        a: true,
        b: true,
        c: true,
        d: true,
      },
    ],
  })
})

test('deepMergeArrayMulti2', async (t) => {
  const r = deepMergeArrays(
    {},
    {
      a: [{ a: true }],
    },
    {
      a: [{ b: [{ snurp: true }] }],
    },
    {
      a: [{ c: true, b: [{ derp: true }] }],
    }
  )
  t.deepEqual(r, {
    a: [{ a: true, b: [{ snurp: true, derp: true }], c: true }],
  })
})

test('deepMergeArrayMulti3', async (t) => {
  const r = deepMergeArrays(
    {},
    {
      a: [{ a: true }],
    },
    {
      a: [undefined, { b: [{ snurp: true }] }],
    }
  )
  t.deepEqual(r, {
    a: [{ a: true }, { b: [{ snurp: true }] }],
  })
})

test('deepMergeArrayMulti4', async (t) => {
  const r = deepMergeArrays(
    {},
    {
      a: ['a', 'b'],
    },
    {
      a: ['a'],
    }
  )
  t.deepEqual(r, {
    a: ['a', 'b'],
  })
})

test('deepMerge', async (t) => {
  const a: any = {
    b: {
      a: 'a!',
      c: [
        { x: true, y: true },
        { x: false, y: true },
      ],
      d: { x: {} },
    },
  }

  const b: any = {
    b: {
      b: 'its b!',
      c: [{ x: true, y: true }],
      d: { x: { flap: true } },
    },
  }

  const r = deepCopy(a)

  deepMergeArrays(r, deepCopy(b))

  t.deepEqual(
    r,
    {
      b: {
        a: 'a!',
        c: [
          { x: true, y: true },
          { x: false, y: true },
        ],
        d: { x: { flap: true } },
        b: 'its b!',
      },
    },
    'deep merge include arrays'
  )
  const r2 = deepCopy(a)

  deepMerge(r2, deepCopy(b))

  t.deepEqual(
    r2,
    {
      b: {
        a: 'a!',
        c: [{ x: true, y: true }],
        d: { x: { flap: true } },
        b: 'its b!',
      },
    },
    'deep merge exclude arrays'
  )

  const r3 = deepCopy(a)

  deepMerge(
    r3,
    {
      b: { a: 'ja' },
    },
    {
      b: { x: 'snurf' },
    },
    {
      blarf: true,
    }
  )

  t.deepEqual(
    r3,
    {
      b: {
        a: 'ja',
        c: [
          { x: true, y: true },
          { x: false, y: true },
        ],
        d: { x: {} },
        x: 'snurf',
      },
      blarf: true,
    },
    'multiple arguments'
  )
})
