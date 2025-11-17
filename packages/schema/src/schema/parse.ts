import type { SchemaProp } from './prop.ts'
import type { SchemaReference } from './reference.ts'
import { parseSchema, type Schema } from './schema.ts'
import type { SchemaType } from './type.ts'

const test: any = {
  types: {
    user: {
      read: {
        props: {
          articles: {
            ref: 'user',
            prop: 'interested_users',
            $rating: 'uint8',
          },
        },
      },
    },
    article: {
      interested: {
        props: {
          users: {
            $rating: 'uint8',
          },
        },
      },
    },
    // this is generated from the edges
    '$article.interested.users$user': {
      $rating: 'uint8',
    },
  },
}

type DbSchema = Schema<true> & {
  types: Record<string, SchemaType<true> & { id: number }>
  hash: number
}

type DbSchemaTypeDefs = Record<string, {}>

const getRef = (prop: SchemaProp<true>): SchemaReference<true> | false =>
  (prop.type === 'reference' && prop) ||
  (prop.type === 'references' && prop.items)

// const getTree = (obj, tree) => {
//   const branch = {}
//   if (typeof obj === 'object' && obj !== null) {
//     for (const i in obj) {
//       branch[i] = getTree(obj[i], branch)
//     }
//   }
//   return branch
// }

const tree = {
  user: {
    id: 0,
    props: {
      name: {
        id: 1,
        type: 'string',
      },
      age: {
        id: 0,
        type: 'uint8',
      },
    },
  },
}

export const parse = (input: Schema): { schema: Schema<true> } => {
  const schema = parseSchema(input)
  const defs = {}

  for (const type in schema.types) {
    const schemaType = schema.types[type]
    const tree = {}
    const def = { type }

    for (const prop in schemaType.props) {
      tree[prop] = {}
    }

    defs[type] = def
  }

  // const allTypes: Record<string, SchemaType<true>> = {}
  // const dbSchema: DbSchema = {
  //   ...schema,
  //   types: {},
  //   hash: 0,
  // }

  // for (const type in schema.types) {
  //   const typeDef = schema.types[type]
  //   for (const prop in typeDef.props) {
  //     const ref = getRef(typeDef.props[prop])
  //     if (ref) {

  //     }
  //   }
  //   allTypes[type] = typeDef
  // }

  return { schema }
}
