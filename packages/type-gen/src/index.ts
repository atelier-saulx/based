import { BasedFunctionConfig } from '@based/functions'
import { readFile, writeFile } from 'fs-extra'

export const updateTypesPath = async (
  fns: (
    | { config: BasedFunctionConfig; path: string }
    | { config: BasedFunctionConfig; payload: string; result: string }
  )[],
  opts: {
    isAbstract?: boolean
    imports?: string[]
    originalDeclartionPath: string
    declarationPath: string
  }
): Promise<string | void> => {
  let decFile = ''

  try {
    decFile = (await readFile(opts.originalDeclartionPath)).toString('utf-8')
  } catch (err) {
    throw new Error(`Cannot find ${opts.originalDeclartionPath}`)
  }

  let imports = opts.imports ? opts.imports.join('\n') + '\n' : '\n'
  let callFns = '\n'
  let queryFns = '\n'
  let fnCnt = 0
  let queryCnt = 0
  let queryMap = '\n'
  let needsParsing = opts.imports ?? false

  const abstractPrefix = opts.isAbstract ? 'abstract ' : ''

  for (const fn of fns) {
    if (fn.config.type === 'function') {
      needsParsing = true
      fnCnt++
      if ('path' in fn) {
        const name = 'FN_Type_' + fnCnt
        imports += `import type ${name} from '${fn.path}';\n`
        callFns += `
      ${abstractPrefix}call(
        name: '${fn.config.name}',
        payload: Parameters<typeof ${name}>[1],
        opts?: CallOptions
      ): ReturnType<typeof ${name}>;      
    `
      } else {
        callFns += `
        ${abstractPrefix}call(
          name: '${fn.config.name}',
          payload: ${fn.payload},
          opts?: CallOptions
        ): Promise<${fn.result}>      
      `
      }
    } else if (fn.config.type === 'query') {
      queryCnt++
      if ('path' in fn) {
        const name = 'Q_Type_' + queryCnt
        imports += `import type ${name} from '${fn.path}';\n`
        queryMap += `'${fn.config.name}': { payload: Parameters<typeof ${name}>[1], result: Parameters<Parameters<typeof ${name}>[2]>[0] },`
        queryFns += `
        ${abstractPrefix}query(name: '${fn.config.name}', payload: Parameters<typeof ${name}>[1], opts?: QueryOptions): BasedQuery<Parameters<typeof ${name}>[1],Parameters<Parameters<typeof ${name}>[2]>[0]>;
    `
      } else {
        queryMap += `'${fn.config.name}': { payload: ${fn.payload}, result: ${fn.result} },`
        queryFns += `
        ${abstractPrefix}query(name: '${fn.config.name}', payload: ${fn.payload}, opts?: QueryOptions): BasedQuery<${fn.payload},${fn.result}>;
    `
      }
    }
  }
  if (needsParsing) {
    let x = imports + decFile
    if (fnCnt > 0) {
      x = x.replace(
        abstractPrefix +
          'call(name: string, payload?: any, opts?: CallOptions): Promise<any>;',
        callFns
      )
    }
    if (queryCnt > 0) {
      x = x.replace(
        abstractPrefix +
          `query(name: string, payload?: any, opts?: QueryOptions): BasedQuery;`,
        queryFns
      )
      x = x.replace(
        /export type QueryMap = ([^@]*?)\};([^@]*?)\};/,
        `export type QueryMap = {${queryMap}}`
      )
    }
    await writeFile(opts.declarationPath, x)
    return opts.declarationPath
  }
}

export const updateTypes = async (
  fns: (
    | { config: BasedFunctionConfig; path: string }
    | { config: BasedFunctionConfig; payload: string; result: string }
  )[],
  opts: {
    imports?: string[]
    clientPath?: string
    functionPath?: string
  } = {}
): Promise<{
  clientPath: string | void
  functionPath: string | void
}> => {
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
      '/index_original.d.ts'
    )

    clientPath = await updateTypesPath(fns, {
      imports: opts.imports,
      originalDeclartionPath,
      declarationPath,
    }).catch(() => {
      console.error(
        'Cannot find original declaration file - you may need to upgrade to @based/client ^4.8.8'
      )
    })
  }

  if (inputFunctionPath) {
    const declarationPath = inputFunctionPath.replace(
      '/index.js',
      '/client.d.ts'
    )
    const originalDeclartionPath = inputFunctionPath.replace(
      '/index.js',
      '/client_original.d.ts'
    )
    functionPath = await updateTypesPath(fns, {
      imports: opts.imports,
      originalDeclartionPath,
      declarationPath,
    }).catch(() => {
      console.error(
        'Cannot find original declaration file - you may need to upgrade to @based/functions ^2.2.4'
      )
    })
  }

  return {
    functionPath,
    clientPath,
  }
}
