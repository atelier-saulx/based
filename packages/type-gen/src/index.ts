import { BasedFunctionConfig } from '@based/functions'
import { updateTypesPath } from './updateTypesPath.js'
import { createRequire } from 'node:module'

let require

export const updateTypes = async (
  fns: (
    | { config: BasedFunctionConfig; path: string }
    | { config: BasedFunctionConfig; payload: string; result: string }
  )[],
  opts: {
    imports?: string[]
    clientPath?: string
    functionPath?: string
  } = {},
): Promise<{
  clientPath: string | void
  functionPath: string | void
}> => {
  require ??= createRequire(import.meta.url)
  const inputClientPath =
    opts.clientPath ||
    require.resolve('@based/client', { paths: [process.cwd()] })

  const inputFunctionPath =
    opts.functionPath ||
    require.resolve('@based/functions', { paths: [process.cwd()] })

  let clientPath: string | void
  let functionPath: string | void

  if (inputClientPath) {
    const declarationPath = inputClientPath.replace('/index.js', '/index.d.ts')
    const originalDeclartionPath = inputClientPath.replace(
      '/index.js',
      '/index_original.d.ts',
    )

    clientPath = await updateTypesPath(fns, {
      imports: opts.imports,
      originalDeclartionPath,
      declarationPath,
    }).catch((e) => {
      console.error(e, {
        imports: opts.imports,
        originalDeclartionPath,
        declarationPath,
      })
      console.error(
        'Cannot find original declaration file - you may need to upgrade to @based/client ^4.8.8',
      )
    })
  }

  if (inputFunctionPath) {
    const declarationPath = inputFunctionPath.replace(
      '/index.js',
      '/client.d.ts',
    )
    const originalDeclartionPath = inputFunctionPath.replace(
      '/index.js',
      '/client_original.d.ts',
    )
    functionPath = await updateTypesPath(fns, {
      imports: opts.imports,
      originalDeclartionPath,
      declarationPath,
      isAbstract: true,
    }).catch(() => {
      console.error(
        'Cannot find original declaration file - you may need to upgrade to @based/functions ^2.2.4',
      )
    })
  }

  return {
    functionPath,
    clientPath,
  }
}
