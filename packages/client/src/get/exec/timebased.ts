import {
  FilterAST,
  Fork,
  ast2rpn,
  convertNow,
  createAst,
  isFork,
} from '@based/db-query'
import { ExecContext, GetTraverse } from '../types.js'
import { SelvaResultOrder } from '../../protocol/index.js'
import { execCmd } from './cmd.js'
import { BasedDbClient } from '../../index.js'

export function excludeTimebased(ast: Fork | FilterAST): Fork | FilterAST {
  if (!isFork(ast)) {
    return ast
  }

  const newFork = Object.assign({}, ast)
  const filters = []
  if (ast.$or) {
    for (const f of ast.$or) {
      if (isFork(f)) {
        const n = excludeTimebased(f)
        if (n) {
          filters.push(n)
        }
      } else if (!f.hasNow) {
        filters.push(f)
      }
    }

    newFork.$or = filters
  } else if (ast.$and) {
    for (const f of ast.$and) {
      if (isFork(f)) {
        const n = excludeTimebased(f)
        if (n) {
          filters.push(n)
        }
      } else if (!f.hasNow) {
        filters.push(f)
      }
    }

    newFork.$and = filters
  }

  if (!filters.length) {
    return null
  }

  return newFork
}

export function findTimebased(ast: Fork): FilterAST[] {
  if (!ast) {
    return []
  }

  const uniq = new Set()

  const parse = (fork: Fork, filters: FilterAST[]) => {
    if (fork.$and) {
      for (const f of fork.$and) {
        if (isFork(f)) {
          parse(f, filters)
        } else if (f.hasNow && !uniq.has(f.$field)) {
          filters.push(f)
          uniq.add(f.$field)
        }
      }
    } else if (fork.$or) {
      for (const f of fork.$or) {
        if (isFork(f)) {
          parse(f, filters)
        } else if (f.hasNow && !uniq.has(f.$field)) {
          filters.push(f)
          uniq.add(f.$field)
        }
      }
    }
  }

  const res = []
  parse(ast, res)
  return res
}

export async function nextTimestamp(
  client: BasedDbClient,
  lang: string,
  subId: number,
  nowMarkers: any[]
) {
  const refreshes = (
    await Promise.all(
      nowMarkers.map(async (m) => {
        const cmd: GetTraverse = m.cmd
        const ast = createAst(cmd.filter)
        if (!ast) {
          return
        }

        const withoutTimebased = excludeTimebased(ast)
        const timebased = findTimebased(ast)

        const refreshes = await Promise.all(
          timebased.map(async (f) => {
            const newFilter: FilterAST = {
              $operator: '>',
              $value: f.$value,
              $field: f.$field,
            }

            const newFork: Fork = {
              isFork: true,
              $and: [withoutTimebased, newFilter],
            }

            if (!withoutTimebased) {
              newFork.$and = [newFilter]
            }

            const ctx: ExecContext = {
              lang,
              client,
            }

            const rpn = ast2rpn(client.schema.types, newFork, lang || '')

            const struct = { ...m.struct }
            struct.res_opt_str = f.$field
            struct.order = SelvaResultOrder.SELVA_RESULT_ORDER_ASC
            struct.order_by_field_str = f.$field
            struct.offset = BigInt(0)
            struct.limit = BigInt(1)

            const res = await execCmd(ctx, { ...m, struct, rpn })
            const nextRefresh = Number(res?.[0]?.[0]?.[1]?.[1])

            let v = <string>f.$value
            if (v.startsWith('now-')) {
              v = v.replace('now-', 'now+')
            } else if (v.startsWith('now+')) {
              v = v.replace('now+', 'now-')
            }

            return convertNow(v, nextRefresh)
          })
        )

        if (!refreshes.length) {
          return
        }

        const nextRefresh = Math.min(...refreshes)
        return { subId, markerId: m.cmdID, nextRefresh }
      })
    )
  ).filter((r) => !!r)

  return refreshes
}
