import { PropDef } from '../schema/defs/index.js'

export type FilterOp = {
  op: '=' | '<' | '>' | '..' | 'includes' | 'exists' | 'exist'
  val?: any
}

export type FilterAst = {
  props?: {
    [key: string]: FilterAst & {
      ops?: FilterOp[]
      select?: { start: number; end: number }
    }
  }
  or?: FilterAst[]
  and?: FilterAst[]
}

export type QueryAst = {
  locale?: string
  range?: { start: number; end: number }
  type?: string
  target?: string | number | (number | string)[] // '[id]'
  filter?: FilterAst
  sort?: { prop: string; order: 'asc' | 'desc' }
  props?: Record<
    string,
    QueryAst & {
      include?: {
        glob?: '*' | '**'
        meta?: true | 'only' | false
        maxChars?: number
        maxBytes?: number
        raw?: boolean
      }
      select?: { start: number; end: number }
    }
  >
}

export type QueryAstCtx = {
  main: PropDef[]
  // more?
}

// const x: QueryAst = {
// type: 'user',
// locale: 'nl',
// filter: {
//   props: {
//     articlesWritten: {
//       ops: [{ op: '>', val: 5 }],
//     },
//   },
// },
// props: {
//   articles: {
//     props: {
//       readBy: {
//         filter: {
//           props: {
//             $rating: {
//               ops: [{ val: 4, op: '>' }],
//             },
//           },
//         },
//         props: {
//           name: { include: { meta: 'only' } },
//           email: { include: {} },
//         },
//       },
//     },
//   },
// },
// }

/*
db.query('user')
  .locale('nl')
  .filter('articlesWritten', '>', 5)
  .include((select) =>
    select('articles.readBy')
      .filter('$rating', '>', 4)
      .include('name', 'email', { meta: 'only' }),
  )
  */

// query('user').include('address', 'address.city.**')

// {
//     props: {
//         address: {
//             opts: { include: '*' },
//             props: {
//                 city: {
//                     include: '**'
//                 }
//             }
//         }
//     }
// }

// {
//     props: {
//         address: {
//             include: '*',
//             props: {
//                 city: {
//                      include: '*'
//                 }
//             }
//         }
//     }
// }
