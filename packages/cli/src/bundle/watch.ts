import { basename, join } from 'path'
import watcher from '@parcel/watcher'
import { configsFiles } from './constants.js'
import { BuildCtx, evalBuild } from './buildUtils.js'
import { ParseResult, ParseResults } from './parse.js'

export const watch = async (
  { configs, schema }: ParseResults,
  cb: (err: Error | null, path: string, type: string) => void,
) => {
  const cwd = process.cwd()
  const inputs = new Map<string, Map<BuildCtx, ParseResult>>()
  const buildInputs = (result: ParseResult, buildCtx: BuildCtx) => {
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

  const buildSchemaInputs = (schemaBuild: any) =>
    schema
      ? new Set<string>(
          Object.keys(schemaBuild.metafile.inputs).map((file) =>
            join(cwd, file),
          ),
        )
      : new Set()

  for (const result of configs) {
    const { indexCtx, configCtx, mainCtx } = result
    buildInputs(result, configCtx)
    buildInputs(result, indexCtx)
    if (mainCtx) {
      buildInputs(result, mainCtx)
    }
  }

  let schemaInputs
  if (schema) {
    schemaInputs = buildSchemaInputs(schema.schemaCtx.build)
  }

  const sub = await watcher.subscribe(cwd, async (err, events) => {
    // A) rebuild relevant stuff √
    // B) check for new functions
    // C) check for removed functions
    console.log('change!', events)
    await Promise.all(
      events.map(async (event) => {
        if (configsFiles.has(basename(event.path))) {
          if (event.type === 'delete') {
            // remove fn
            console.log('delete config', event.path)
          } else if (event.type === 'create') {
            // add fn
            console.log('create config', event.path)
          }
        }

        const fnInputs = inputs.get(event.path)
        if (fnInputs) {
          // console.log('fn change!', event.type, event.path, fnInputs)
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
              result.fnConfig = await evalBuild(buildCtx.build)
            }
          }
        }

        if (schema && schemaInputs.has(event.path)) {
          console.log('schema change!', event.type, event.path)
          schema.schemaCtx.build = await schema.schemaCtx.ctx.rebuild()
          schema.schema = await evalBuild(schema.schemaCtx.build)
          schemaInputs = buildSchemaInputs(schema.schemaCtx.build)
        }
      }),
    )
  })
}
