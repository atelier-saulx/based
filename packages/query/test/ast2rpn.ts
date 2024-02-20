import test from 'ava'
import { createAst, printAst, createRpn } from '../src/ast2rpn/index.js'
import { Fork, Filter } from '../src/ast2rpn/types.js'

test('basic filter', async (t) => {
  const filter: Filter[] = [
    {
      $field: 'type',
      $operator: '=',
      $value: 'team',
    },
    {
      $field: 'value',
      $operator: '!=',
      $value: 2,
    },
  ]

  const ast = createAst(filter)

  t.deepEqual(ast, {
    isFork: true,
    $and: [
      { $value: 'team', $operator: '=', $field: 'type' },
      { $value: 2, $operator: '!=', $field: 'value' },
    ],
  })

  const rpn = createRpn({ team: { prefix: 'te' } }, filter)

  printAst(ast)

  t.deepEqual(rpn, [' "te" e #2 $1 g G M', 'value'])
})

test('complex filter', async (t) => {
  const filter: Filter[] = [
    {
      $field: 'type',
      $operator: '=',
      $value: 'team',
    },
    {
      $field: 'value',
      $operator: '!=',
      $value: 2,
    },
    {
      $field: 'value',
      $operator: '=',
      $value: 3,
    },
    {
      $field: 'flapdrol',
      $operator: '>',
      $value: 10,
    },
    {
      $field: 'flapdrol',
      $operator: '>',
      $value: 100,
    },
    {
      $field: 'x',
      $operator: '>',
      $value: 10,
    },
    {
      $field: 'x',
      $operator: '>',
      $value: 100,
      $or: {
        $field: 'y',
        $operator: '=',
        $value: 'flapperdrol',
        $and: {
          $field: 'z',
          $operator: '=',
          $value: 'snurkypants',
        },
      },
    },
  ]

  const ast = createAst(filter)

  t.deepEqual(ast, {
    isFork: true,
    $and: [
      { $value: 'team', $operator: '=', $field: 'type' },
      { $value: 2, $operator: '!=', $field: 'value' },
      { $value: 100, $operator: '>', $field: 'flapdrol' },
      { $value: 10, $operator: '>', $field: 'x' },
      {
        isFork: true,
        $or: [
          { $value: 100, $operator: '>', $field: 'x' },
          {
            isFork: true,
            $and: [
              {
                $value: 'flapperdrol',
                $operator: '=',
                $field: 'y',
              },
              {
                $value: 'snurkypants',
                $operator: '=',
                $field: 'z',
              },
            ],
          },
        ],
      },
    ],
  })

  const rpn = createRpn({ team: { prefix: 'te' } }, filter)

  printAst(ast)

  t.deepEqual(rpn, [
    ' "te" e #2 $1 g G M #100 $2 g I M #10 $3 g I M #100 $3 g I $5 $4 f c $7 $6 f c M N M',
    'value',
    'flapdrol',
    'x',
    'y',
    'flapperdrol',
    'z',
    'snurkypants',
  ])
})

test('exists & not exist', async (t) => {
  const filter: Filter[] = [
    {
      $field: 'type',
      $operator: 'exists',
    },
    {
      $field: 'flurp',
      $operator: 'notExists',
    },
  ]

  const ast = createAst(filter)
  printAst(ast)

  t.deepEqual(ast, {
    isFork: true,
    $and: [
      { $operator: 'exists', $field: 'type' },
      { $operator: 'notExists', $field: 'flurp' },
    ],
  })
})

test('reduce exists', async (t) => {
  const filter: Filter[] = [
    {
      $field: 'type',
      $operator: '=',
      $value: 'team',
    },
    {
      $field: 'type',
      $operator: 'exists',
    },
    {
      $field: 'flap',
      $operator: '>',
      $value: 1,
      $or: {
        $field: 'snurf',
        $operator: 'exists',
        $and: {
          $field: 'snurf',
          $operator: '<',
          $value: 10,
        },
      },
    },
  ]

  const ast = createAst(filter)

  t.deepEqual(ast, {
    isFork: true,
    $and: [
      { $operator: '=', $field: 'type', $value: 'team' },
      {
        isFork: true,
        $or: [
          { $operator: '>', $field: 'flap', $value: 1 },
          {
            isFork: true,
            $and: [{ $operator: '<', $field: 'snurf', $value: 10 }],
          },
        ],
      },
    ],
  })

  printAst(ast)
})

test('perf test', async (t) => {
  const filter: Filter[] = [
    {
      $field: 'type',
      $operator: '=',
      $value: 'team',
    },
    {
      $field: 'type',
      $operator: 'exists',
    },
    {
      $field: 'flap',
      $operator: '>',
      $value: 1,
      $or: {
        $field: 'snurf',
        $operator: 'exists',
        $and: {
          $field: 'snurf',
          $operator: '<',
          $value: 10,
        },
      },
    },
  ]

  for (let i = 0; i < 1000; i++) {
    filter.push({
      $field: 'flap',
      $operator: '<',
      $value: ~~(Math.random() * 1000),
    })
  }

  var d = Date.now()
  const r: Fork[] = []
  for (let i = 0; i < 1000; i++) {
    const ast = createAst(filter)
    if (ast) {
      r.push(ast)
    }
  }

  const time = Date.now() - d

  printAst(r[0])

  console.log(`1000x 1000 filters takes ${time}ms`)

  t.is(r?.[0]?.$and?.length, 3, 'reduced a 1000 options')

  t.true(time < 5000, 'takes less then 5 seconds to check 1000 queries')
})
