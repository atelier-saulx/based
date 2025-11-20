import test from 'node:test'
import { parseSchema, type Schema } from '../src/schema/schema.ts'
import { schemaToDefs } from '../src/schema/def.ts'

await test('testings', () => {
  const input: Schema = {
    types: {
      role: {
        name: 'string',
      },
      author: {
        name: 'string',
        age: 'uint8',
        articles: {
          ref: 'article',
          prop: 'author',
        },
      },
      article: {
        address: {
          props: {
            street: 'string',
          },
        },
        author: {
          ref: 'author',
          prop: 'articles',
          $durt: {
            ref: 'author',
          },
        },
        collaborators: {
          items: {
            ref: 'author',
            prop: 'collaborations',
            $role: ['owner', 'reader'],
            $roles: {
              items: {
                ref: 'role',
                // prop: 'ballz',
                // $test: 'string',
              },
            },
          },
        },
      },
    },
  }
  console.log('-- input')
  console.dir(input, { depth: null })
  const schema = parseSchema(input)
  console.log('-- strict schema')
  console.dir(schema, { depth: null })
  const defs = schemaToDefs(schema)
  console.log('-- schema defs')
  console.dir(defs, { depth: null })
})
