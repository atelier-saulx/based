import { ReaderLocales, ReaderSchema } from '../../protocol/index.js'
import { PropDef, PropTree } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'

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
  edges?: FilterAst
}

export type Include = {
  glob?: '*' | '**'
  meta?: true | 'only' | false
  maxChars?: number
  maxBytes?: number
  raw?: boolean
}

export type IncludeCtx = {
  tree: PropTree
  main: { prop: PropDef; include: Include }[]
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
      include?: Include
      select?: { start: number; end: number }
    }
  >
  edges?: QueryAst
}
export type Ctx = {
  query: AutoSizedUint8Array
  readSchema: ReaderSchema
  sub: AutoSizedUint8Array
  locales: ReaderLocales
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
// edges: {
// props: {
// $rating: {
//             //  ops: [{ val: 4, op: '>' }],
//             // },
// }
// }
// props: {
//   $rating: {
//     ops: [{ val: 4, op: '>' }],
//   },
// },
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
