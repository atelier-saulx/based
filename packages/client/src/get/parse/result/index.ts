import { deepEqual, deepMerge, getByPath, setByPath } from '@saulx/utils'
import { getTypeSchema } from '../../../util'
import { ExecContext, GetCommand } from '../../types'
import { findFieldSchema, parseObjFields } from './obj'
import { setResultValue } from './setResultValue'
import { SELVA_NODE_ID_LEN } from '../../../protocol'
import { BasedSchemaFieldArray, BasedSchemaFieldObject } from '@based/schema'

export function parseGetResult(
  ctx: ExecContext,
  cmds: GetCommand[],
  results: any[]
): any {
  let obj = {}
  let hasKeys = false
  for (let i = 0; i < results.length; i++) {
    const result = results[i]?.[0]
    if (!result) {
      continue
    }

    const cmd: GetCommand = cmds[i]
    const {
      type,
      target: { path },
    } = cmd

    const parsed =
      type === 'aggregate' ||
      (cmd.type === 'ids' && cmd.mainType === 'aggregate')
        ? Number(result)
        : cmd.type === 'ids' && !cmd.nestedFind
        ? result
        : parseResultRows({ ...ctx, commandPath: path }, cmd, result)

    // if it's a top level $list expression, just return in straight up
    if (
      !path.length &&
      (type === 'traverse' ||
        (cmd.type === 'ids' && cmd.mainType === 'traverse')) &&
      !cmd.isSingle
    ) {
      return parsed
    }

    if (
      cmd.type !== 'traverse' &&
      typeof parsed !== 'number' &&
      !parsed?.length
    ) {
      continue
    }

    if (!path.length) {
      obj = { ...obj, ...parsed[0] }
    } else {
      if (cmd.type === 'node') {
        const v = parsed[0]
        if (deepEqual(v, {})) {
          continue
        }

        const cur = getByPath(obj, path)
        const o = deepMerge({}, cur, v)
        setByPath(obj, path, o)
      } else if (cmd.type === 'traverse' && cmd.isSingle) {
        setByPath(obj, path, parsed[0])
      } else {
        setByPath(obj, path, parsed)
      }
    }

    hasKeys = true
  }

  if (!hasKeys) {
    return
  }

  return obj
}

function parseResultRows(
  ctx: ExecContext,
  cmd: GetCommand,
  result: [string, any[]][]
): any {
  return result.map((row) => {
    const rowCtx = { ...ctx, fieldAliases: {} }

    if (!row) {
      return {}
    }

    const [id, fields]: [string, any[]] = row

    let schema: BasedSchemaFieldObject
    if (id === '\0'.repeat(SELVA_NODE_ID_LEN)) {
      const typeSchema = getTypeSchema(rowCtx, cmd.source.id)
      if (!typeSchema) {
        return {}
      }

      const fieldSchema: BasedSchemaFieldArray = <BasedSchemaFieldArray>(
        findFieldSchema((<any>cmd).sourceField, {
          type: 'object',
          properties: typeSchema?.fields,
        })
      )

      schema = {
        type: 'object',
        properties: (<BasedSchemaFieldObject>fieldSchema?.values)?.properties,
      }
    } else {
      schema = { type: 'object', properties: getTypeSchema(rowCtx, id)?.fields }
    }

    if (!schema.properties) {
      return {}
    }

    const obj = parseObjFields(rowCtx, schema, cmd, fields) || {}

    for (const path in rowCtx.fieldAliases) {
      setResultValue({ obj, path, ...rowCtx.fieldAliases[path] })
    }

    return obj
  })
}
