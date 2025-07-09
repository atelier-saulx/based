import {
  getEntryPoints,
  isConfigFile,
  isInfraFile,
  isSchemaFile,
} from './getBasedFiles.js'
import { bundle } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'
import { access, constants } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export const bundleFunctions = async () => {
  const entryPoints = await getEntryPoints()
  console.log({ entryPoints })

  let schema: any
  let infra: any
  let nodeFunctions: {
    [name: string]: {
      entryPoint: string
    }
  } = {}
  let browserFunctions: {
    [name: string]: {
      publicPath: string
      entryPoint: string
      main: string // how to use this?
      // TODO: plugins and define
    }
  } = {}

  const bundledConfigFiles = await bundle({ entryPoints })
  await Promise.all(
    Object.entries(bundledConfigFiles.result.metafile.outputs).map(
      async ([key, value]) => {
        let config
        if (value.entryPoint.endsWith('.json')) {
          config = await readJSON(value.entryPoint)
        } else {
          const compiled = bundledConfigFiles.require(value.entryPoint)
          config = compiled.default || compiled
        }

        const filename: string = basename(value.entryPoint)
        const folder: string = dirname(join(process.cwd(), value.entryPoint))

        if (isConfigFile(filename)) {
          const functionName =
            config.type === 'authorize' ? 'authorize' : config.name

          const indexFile = await findIndexFile(folder)
          if (!indexFile) {
            console.error(`Index file missing in ${folder}`)
          }

          if (config.type === 'app') {
            if (browserFunctions[functionName]) {
              console.error(`Duplicate function name in ${value.entryPoint}`)
              return
            }
            browserFunctions[functionName] = {
              publicPath: 'todo',
              entryPoint: indexFile,
              main: config.main,
            }
          } else {
            if (nodeFunctions[functionName]) {
              console.error(`Duplicate function name in ${value.entryPoint}`)
              return
            }
            nodeFunctions[functionName] = {
              entryPoint: indexFile,
            }
          }
        } else if (isSchemaFile(filename)) {
          schema = config
        } else if (isInfraFile(filename)) {
          infra = config
        }
      },
    ),
  )

  console.log({ schema, nodeFunctions, browserFunctions })
}

const findIndexFile = async (folder) => {
  try {
    const path = join(folder, 'index.ts')
    await access(path, constants.F_OK)
    return path
  } catch (_err) {}
  try {
    const path = join(folder, 'index.js')
    await access(path, constants.F_OK)
    return path
  } catch (_err) {}
  return null
}
