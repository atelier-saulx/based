import { deepMerge, getByPath, setByPath } from '@saulx/utils'
import { getTypeSchema } from '../../../util'
import { ExecContext, GetCommand } from '../../types'
import { parseObjFields } from './obj'
import { setResultValue } from './setResultValue'

export function parseGetResult(
  ctx: ExecContext,
  cmds: GetCommand[],
  results: any[]
): any {
  let obj = {}
  for (let i = 0; i < results.length; i++) {
    const result = results[i][0]
    const cmd: GetCommand = cmds[i]
    const {
      type,
      target: { path },
    } = cmd

    const parsed =
      type === 'aggregate' ||
      (cmd.type === 'ids' && cmd.mainType === 'aggregate')
        ? Number(result)
        : parseResultRows({ ...ctx, commandPath: path }, result)

    // if it's a top level $list expression, just return in straight up
    if (
      !path.length &&
      (type === 'traverse' ||
        (cmd.type === 'ids' && cmd.mainType === 'traverse')) &&
      !cmd.isSingle
    ) {
      return parsed
    }

    if (!path.length) {
      obj = { ...obj, ...parsed[0] }
    } else {
      if (cmd.type === 'node') {
        const v = parsed[0]
        const cur = getByPath(obj, path)
        const o = deepMerge({}, cur, v)
        setByPath(obj, path, o)
      } else if (cmd.type === 'traverse' && cmd.isSingle) {
        setByPath(obj, path, parsed[0])
      } else {
        setByPath(obj, path, parsed)
      }
    }
  }

  return obj
}

function parseResultRows(ctx: ExecContext, result: [string, any[]][]): any {
  return result.map((row) => {
    const rowCtx = { ...ctx, fieldAliases: {} }

    if (!row) {
      return {}
    }

    const [id, fields]: [string, any[]] = row

    const typeSchema = getTypeSchema(rowCtx, id)
    if (!typeSchema) {
      return {}
    }

    const obj =
      parseObjFields(
        rowCtx,
        { type: 'object', properties: typeSchema.fields },
        fields
      ) || {}

    for (const path in rowCtx.fieldAliases) {
      setResultValue({ obj, path, ...rowCtx.fieldAliases[path] })
    }

    return obj
  })
}
