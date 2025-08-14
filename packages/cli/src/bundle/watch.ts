import { basename, dirname, extname, join } from 'path'
import watcher from '@parcel/watcher'
import { configsFiles } from './constants.js'
import { BuildCtx, importFromBuild } from './buildUtils.js'
import { parseConfig, ParseResult, ParseResults } from './parse.js'
import { Schema } from '@based/schema'

export const watch = async (
  { configs, schema, publicPath, cwd, opts }: ParseResults,
  cb: (err: Error | null, changes: ParseResults) => void,
) => {
  const inputs = new Map<string, Map<BuildCtx, ParseResult>>()
  const addResult = (result: ParseResult, buildCtx: BuildCtx) => {
    for (const file in buildCtx.build.metafile.inputs) {
      const path = join(cwd, file)
      let map = inputs.get(path)
      if (!map) {
        map = new Map()
        inputs.set(path, map)
      }
      map.set(buildCtx, result)
    }
  }

  // TODO: remove results when deleting files
  // const removeResult = (buildCtx: BuildCtx) => {
  //   for (const file in buildCtx.build.metafile.inputs) {
  //     const path = join(cwd, file)
  //     const map = inputs.get(path)
  //     if (map) {
  //       map.delete(buildCtx)
  //       if (map.size === 0) {
  //         inputs.delete(path)
  //       }
  //     }
  //   }
  // }

  const buildSchemaInputs = (schemaBuild: any) =>
    schema
      ? new Set<string>(
          Object.keys(schemaBuild.metafile.inputs).map((file) =>
            join(cwd, file),
          ),
        )
      : new Set()

  const addConfig = (result: ParseResult) => {
    const { indexCtx, configCtx, mainCtx } = result
    addResult(result, configCtx)
    addResult(result, indexCtx)
    if (mainCtx) {
      addResult(result, mainCtx)
    }
  }

  for (const result of configs) {
    addConfig(result)
  }

  let schemaInputs
  if (schema) {
    schemaInputs = buildSchemaInputs(schema.schemaCtx.build)
  }

  await watcher.subscribe(cwd, async (err, events) => {
    let changedSchema: {
      schema: Schema
      schemaCtx: BuildCtx
    }
    let changedConfigs = new Set<ParseResult>()

    await Promise.all(
      events.map(async (event) => {
        if (event.type === 'create') {
          if (configsFiles.has(basename(event.path))) {
            const result = await parseConfig(
              {
                path: event.path,
                file: basename(event.path),
                dir: dirname(event.path),
                ext: extname(event.path),
              },
              publicPath,
              opts,
            )
            addConfig(result)
            changedConfigs.add(result)
            return
          }
        }

        const fnInputs = inputs.get(event.path)
        if (fnInputs) {
          // if (event.type === 'delete') {
          //   for (const [buildCtx] of fnInputs) {
          //     removeResult(buildCtx)
          //   }
          //   return
          // }

          for (const [buildCtx, result] of fnInputs) {
            const prevInputs = buildCtx.build.metafile.inputs
            buildCtx.build = await buildCtx.ctx.rebuild()
            const currInputs = buildCtx.build.metafile.inputs
            for (const file in currInputs) {
              if (!(file in prevInputs)) {
                fnInputs.set(buildCtx, result)
              }
            }
            for (const file in prevInputs) {
              if (!(file in currInputs)) {
                fnInputs.delete(buildCtx)
              }
            }
            if (buildCtx === result.configCtx) {
              result.fnConfig = importFromBuild(buildCtx.build, event.path)
            }
            changedConfigs.add(result)
          }
        }

        if (schema && schemaInputs.has(event.path)) {
          schema.schemaCtx.build = await schema.schemaCtx.ctx.rebuild()
          schema.schema = importFromBuild(schema.schemaCtx.build, event.path)
          schemaInputs = buildSchemaInputs(schema.schemaCtx.build)
          changedSchema = schema
        }
      }),
    )

    if (changedSchema || changedConfigs.size > 0) {
      cb(null, {
        schema: changedSchema,
        configs: Array.from(changedConfigs),
        publicPath,
        cwd,
        opts,
      })
    }
  })
}
