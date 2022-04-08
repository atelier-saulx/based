import glob from 'glob'
import path from 'path'
import { walk } from '@root/walk'
import fs from 'fs-extra'
import { GlobalOptions } from '../command'
import { DeployOptions } from '.'

export type BasedFunctionConfig = {
  path: string
  name: string
  observable: boolean
  shared: boolean
  code?: string
  status?: 'update' | 'new' | 'unchanged' | 'err'
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
      if (!fs.existsSync(file)) {
        throw new Error(`File ${file} does not exist`)
      }
    })
    schemaFiles = options.file
  }

  // walk: traverse all subfolders, call the function for every fs entity
  await walk(
    startDir,
    async (err: Error, pathname: string, dirent: fs.Dirent) => {
      const configMandatoryFields = ['name', 'observable']
      const fnConfigFile = path.resolve(path.join(pathname, 'based.config.js'))
      const indexFileNames = ['index.js', 'index.ts']
      const schemaFileNames = [
        'based.schema.ts',
        'based.schema.js',
        'based.schema.json',
      ]

      // find schema file(s)
      if (
        !options.file?.length &&
        dirent.isDirectory() &&
        !pathname.includes('dist')
      ) {
        schemaFileNames.forEach((value) => {
          schemaFiles.push(glob.sync(`${path.resolve(pathname)}/${value}`))
        })
        schemaFiles = schemaFiles.flat()
      }

      // find index files and based.config.js files
      if (dirent.isDirectory() && fs.pathExistsSync(fnConfigFile)) {
        let indexesFound = []
        indexFileNames.forEach((value) => {
          indexesFound.push(glob.sync(`${path.resolve(pathname)}/${value}`))
        })
        indexesFound = indexesFound.flat()

        const basedConfig: {
          name: string
          observable: boolean
          shared: boolean
        } = require(fnConfigFile)
        for (const prop of configMandatoryFields) {
          if (!(prop in basedConfig)) {
            throw new Error(
              `Missing mandatory field "${prop}" for function at "./${pathname}/based.config.js"`
            )
          }
        }
        if (indexesFound.length > 1) {
          throw new Error(`Multiple indexes found for function at ${pathname}/`)
        }
        if (indexesFound.length < 1) {
          throw new Error(`No index file found for function at ${pathname}/`)
        }
        fns.push({
          path: indexesFound[0],
          ...basedConfig,
        })
      }

      if (err) throw err
    }
  )

  return { schemaFiles, fns }
}
