import fs from 'fs/promises'
import path from 'path'
import { fsWalk } from '@saulx/fs-walker'
import { GlobalOptions } from '../command'
import { DeployOptions } from '.'

type BasedFunctionConfigFile = {
  name: string
  observable: boolean
  shared: boolean
  bundle?: boolean
  entry?: string
}
export type BasedFunctionConfig = BasedFunctionConfigFile & {
  path: string
  code?: string
  status?: 'update' | 'new' | 'unchanged' | 'err'
  fromFile?: boolean
}

/**
 * Recursively finds schema files and functions that conform to the Based project file structure.
 * Each function must be in its own folder and contain an index.js/.ts file, and a
 * based.config.js file that exports a JavaScript object with at least 'name' and 'observable'
 * fields.
 * @param startDir Start searching from this directory. By default, it searches in `./*`
 * @returns All the schema files and functions, INCLUDING DOUBLES
 */
export async function findSchemaAndFunctions(
  options: GlobalOptions & DeployOptions,
  startDir?: string
): Promise<{
  schemaFiles: string[]
  fns: BasedFunctionConfig[]
}> {
  if (!startDir) startDir = './'

  let schemaFiles = []
  const fns: BasedFunctionConfig[] = []

  if (options.file?.length) {
    options.file.forEach((file) => {
      if (
        !fs
          .access(file)
          .then(() => true)
          .catch(() => false)
      ) {
        throw new Error(`File ${file} does not exist`)
      }
    })
    schemaFiles = options.file
  } else {
    await fsWalk(
      startDir,
      async (pathname, _info) => {
        schemaFiles.push(pathname)
      },
      {
        itemMatchFn: async (item) =>
          item.type === 'file' &&
          ['based.schema.ts', 'based.schema.js', 'based.schema.json'].includes(
            item.name
          ),
        recurseFn: async (item) =>
          item.type === 'dir' &&
          !['node_modules', 'tmp', 'dists', 'dist', '.git'].includes(item.name),
      }
    )
  }

  await fsWalk(
    startDir,
    async (fnConfigFile, _info) => {
      const folder = path.parse(path.resolve(fnConfigFile)).dir

      let basedConfig: BasedFunctionConfigFile | BasedFunctionConfigFile[]
      try {
        basedConfig = require(fnConfigFile)
      } catch (e) {
        const configBody: string = await fs.readFile(fnConfigFile, 'utf8')
        basedConfig = eval(configBody)
      }

      if (Array.isArray(basedConfig)) {
        for (const basedConfigItem of basedConfig) {
          ;['name', 'observable', 'entry'].forEach((fieldName) => {
            if (typeof basedConfigItem[fieldName] === 'undefined') {
              throw new Error(
                `Missing mandatory field "${fieldName}" for function at "./${folder}/based.config.js"`
              )
            }
          })
          try {
            await fs.access(path.join(folder, basedConfigItem.entry))
          } catch (_err) {
            throw new Error(
              `Cannot find entry file for function ${basedConfigItem.name} at "./${folder}/based.config.js"`
            )
          }
          fns.push({
            path: path.join(folder, basedConfigItem.entry),
            ...basedConfigItem,
          })
        }
      } else {
        ;['name', 'observable'].forEach((fieldName) => {
          if (!(fieldName in basedConfig)) {
            throw new Error(
              `Missing mandatory field "${fieldName}}" for function at "./${folder}/based.config.js"`
            )
          }
        })

        let indexesFound = []
        const dir = await fs.readdir(folder)
        ;['index.js', 'index.ts'].forEach((indexFileName) => {
          if (dir.includes(indexFileName)) {
            indexesFound.push(path.join(folder, indexFileName))
          }
        })

        if (indexesFound.length > 1) {
          throw new Error(`Multiple indexes found for function at ${folder}/`)
        }
        if (indexesFound.length < 1) {
          throw new Error(`No index file found for function at ${folder}/`)
        }
        fns.push({
          path: indexesFound[0],
          ...basedConfig,
        })
      }
    },
    {
      itemMatchFn: async (item) =>
        item.type === 'file' && item.name == 'based.config.js',
      recurseFn: async (item) =>
        item.type === 'dir' &&
        !['node_modules', 'tmp', 'dists', 'dist', '.git'].includes(item.name),
    }
  )

  return { schemaFiles, fns }
}
