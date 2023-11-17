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
