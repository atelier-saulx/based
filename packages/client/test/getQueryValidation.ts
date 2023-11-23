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
        'Query error: Argument $traverse must be of type string or string array at "list.$list.$find.$traverse".',
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

test('validate $filter', (t) => {
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        list: {
          id: true,
          $list: {
            $find: {
              $traverse: 'children',
              $filter: true,
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $filter must be of type object or object array at "list.$list.$find.$filter".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        one: {
          two: {
            $filter: {
              $field: 'aField',
              $operator: '=',
              $value: 'aValue',
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $filter cannot be a child of "two" at "one.two.$filter".',
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
              $filter: {
                $field: 'aField',
                something: true,
              },
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $filter property "something" at "list.$list.$find.$filter".',
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
              $filter: [
                {
                  $field: 'aField',
                  $operator: '=',
                  $value: 'aValue',
                },
                {
                  $field: 'aField',
                  something: true,
                },
              ],
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $filter property "something" at "list.$list.$find.$filter.1".',
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
              $filter: {
                $field: 'aField',
                $operator: '=',
              },
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $filter must have the required properties "$field", "$operator" and "$value" at "list.$list.$find.$filter".',
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
              $filter: [
                {
                  $field: 'aField',
                  $operator: '=',
                  $value: 'aValue',
                },
                {
                  $field: 'aField',
                  $operator: '=',
                },
              ],
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $filter must have the required properties "$field", "$operator" and "$value" at "list.$list.$find.$filter.1".',
    }
  )
})

test('validate $field', (t) => {
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        list: {
          id: true,
          $list: {
            $find: {
              $traverse: 'descendants',
              $filter: {
                $field: true,
                $operator: '=',
                $value: 'aValue',
              },
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $field must be of type string at "list.$list.$find.$filter.$field".',
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
              $filter: [
                {
                  $field: true,
                  $operator: '=',
                  $value: 'aValue',
                },
              ],
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $field must be of type string at "list.$list.$find.$filter.0.$field".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        one: {
          two: {
            $field: '=',
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $field cannot be a child of "two" at "one.two.$field".',
    }
  )
})

test('validate $operator', (t) => {
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        list: {
          id: true,
          $list: {
            $find: {
              $traverse: 'descendants',
              $filter: {
                $field: 'aField',
                $operator: true,
                $value: 'aValue',
              },
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $operator must be of type string at "list.$list.$find.$filter.$operator".',
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
              $filter: [
                {
                  $field: 'aField',
                  $operator: true,
                  $value: 'aValue',
                },
              ],
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $operator must be of type string at "list.$list.$find.$filter.0.$operator".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        one: {
          two: {
            $operator: '=',
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $operator cannot be a child of "two" at "one.two.$operator".',
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
              $filter: {
                $field: 'aField',
                $operator: 'wawa',
                $value: 'aValue',
              },
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $operator argument value "wawa" at "list.$list.$find.$filter.$operator".',
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
              $filter: [
                {
                  $field: 'aField',
                  $operator: 'wawa',
                  $value: 'aValue',
                },
              ],
            },
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $operator argument value "wawa" at "list.$list.$find.$filter.0.$operator".',
    }
  )
})

test('validate $value', (t) => {
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        one: {
          two: {
            $value: '=',
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $value cannot be a child of "two" at "one.two.$value".',
    }
  )
})

test('validate $inherit', (t) => {
  t.notThrows(() => {
    getQueryValidation({
      $id: 'id',
      one: {
        two: { $inherit: true },
      },
    })
  })
  t.notThrows(() => {
    getQueryValidation({
      $id: 'id',
      one: {
        two: { $inherit: { $type: 'aType' } },
      },
    })
  })
  t.notThrows(() => {
    getQueryValidation({
      $id: 'id',
      one: {
        two: { $inherit: { $type: ['aType', 'anotherType'] } },
      },
    })
  })

  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        one: {
          two: {
            $type: 'aType',
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $type cannot be a child of "two" at "one.two.$type".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        one: {
          two: { $inherit: 'string' },
        },
      })
    },
    {
      message:
        'Query error: Argument $inherit must be of type boolean or object at "one.two.$inherit".',
    }
  )
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        one: {
          two: { $inherit: { $type: true } },
        },
      })
    },
    {
      message:
        'Query error: Argument $type must be of type string or string array at "one.two.$inherit.$type".',
    }
  )
  t.throws(
    () => {
      getQueryValidation({
        $id: 'id',
        one: {
          two: { $inherit: { $type: ['aType', 'anotherType', true] } },
        },
      })
    },
    {
      message:
        'Query error: Argument $type must be of type string or string array at "one.two.$inherit.$type".',
    }
  )
})

test('validate $aggregate', (t) => {
  t.notThrows(() => {
    getQueryValidation({
      $id: 'root',
      id: true,
      thing: {
        $aggregate: {
          $function: { $name: 'avg', $args: ['value'] },
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
            ],
          },
        },
      },
    })
  })

  t.notThrows(() => {
    getQueryValidation({
      $id: 'root',
      id: true,
      thing: {
        $aggregate: {
          $function: 'count',
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
        },
      },
    })
  })

  // TODO: What is required for $aggregate?

  t.throws(
    () => {
      getQueryValidation({
        $id: 'root',
        id: true,
        thing: {
          $function: 'aFunction',
        },
      })
    },
    {
      message:
        'Query error: Argument $function cannot be a child of "thing" at "thing.$function".',
    }
  )
  t.throws(
    () => {
      getQueryValidation({
        $id: 'root',
        id: true,
        thing: {
          $aggregate: {
            $function: true,
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $function must be of type string or object at "thing.$aggregate.$function".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'root',
        id: true,
        thing: {
          $aggregate: {
            $function: { $name: 'avg', something: true },
            $traverse: 'children',
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $function property "something" at "thing.$aggregate.$function".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'root',
        id: true,
        thing: {
          $aggregate: {
            $function: 'wawa',
            $traverse: 'children',
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $function argument value "wawa" at "thing.$aggregate.$function".',
    }
  )
  t.throws(
    () => {
      getQueryValidation({
        $id: 'root',
        id: true,
        thing: {
          $aggregate: {
            $function: { $name: 'wawa' },
            $traverse: 'children',
          },
        },
      })
    },
    {
      message:
        'Query error: Invalid $name argument value "wawa" at "thing.$aggregate.$function.$name".',
    }
  )

  t.throws(
    () => {
      getQueryValidation({
        $id: 'root',
        id: true,
        thing: {
          $aggregate: {
            $function: { $name: 'avg', $args: true },
            $traverse: 'children',
          },
        },
      })
    },
    {
      message:
        'Query error: Argument $args must be of type string array at "thing.$aggregate.$function.$args".',
    }
  )
})
