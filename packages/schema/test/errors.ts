import test from 'node:test'
import { parseSchema } from '../src/schema/schema.js'
import assert from 'node:assert'

await test('errors', () => {
  assert.throws(
    () =>
      parseSchema({
        types: {
          role: {
            // @ts-expect-error
            name: {
              type: 'string',
              default: 1,
            },
          },
        },
      }),
    {
      message: /^types.role.name.default: 1/,
    },
  )

  assert.throws(
    () =>
      parseSchema({
        types: {
          article: {
            author: {
              ref: 'author',
              prop: 'bla',
            },
          },
        },
      }),
    {
      message: /^types.article.props.author.ref: 'author'/,
    },
  )
})
