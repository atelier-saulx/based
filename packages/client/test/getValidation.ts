import test from 'ava'
import { getQueryValidation } from '../src/get/validation'

test('valid query', (t) => {
  t.notThrows(() => {
    getQueryValidation({
      $id: 'id',
      list: {
        id: true,
        $list: {
          $sort: { $field: 'field', $order: 'asc' },
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'aType',
              },
              {
                $field: 'title',
                $operator: '=',
                $value: 'part of title',
              },
            ],
          },
        },
      },
    })
  })
})

test('validate $list', (t) => {
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        list: {
          id: true,
          $list: {
            something: true,
            somethingElse: {
              shouldNot: true,
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $list property "something" at "list.$list".',
    }
  )
})

test('validate $sort', (t) => {
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        list: {
          id: true,
          $list: {
            $sort: 'string',
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $sort must be of type object at "list.$list.$sort".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        $sort: { $field: 'field', $order: 'asc' },
      })
    },
    {
      message:
        'Query error: Argument $sort cannot be a child of "root" at "$sort".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        one: {
          two: {
            $sort: { $field: 'field', $order: 'asc' },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $sort cannot be a child of "two" at "one.two.$sort".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        list: {
          id: true,
          $list: {
            $sort: { $field: 'field', $order: 'something' },
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $order argument value "something" at "list.$list.$sort.$order".',
    }
  )
})

test('validate $find', (t) => {
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        list: {
          id: true,
          $list: {
            $find: 'string',
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $find must be of type object at "list.$list.$find".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        list: {
          id: true,
          $list: {
            $find: {
              $traverse: 'descendants',
              something: true,
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $find property "something" at "list.$list.$find".',
    }
  )
})

test('validate $traverse', (t) => {
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        list: {
          id: true,
          $list: {
            $find: {
              $traverse: true,
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $traverse must be of type string or array at "list.$list.$find.$traverse".',
    }
  )

  t.notThrows(() => {
    getQueryValidation({
      $id: 'id',
      list: {
        id: true,
        $list: {
          $find: {
            $traverse: ['id1', 'id2'],
          },
        },
      },
    })
  })
})
