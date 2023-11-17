import test from 'ava'
import { getQueryValidation } from '../src/get/validation'

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
        /^Query error: Invalid \$list property "something" at "list.\$list".$/,
    }
  )
})
