import { BasedFunctionConfig } from '@based/functions'
import { readFile, writeFile } from 'fs-extra'

export const updateTypes = async (
  fns: (
    | { config: BasedFunctionConfig; path: string }
    | { config: BasedFunctionConfig; payload: string; result: string }
  )[],
  opts: {
    extraImports?: string[]
    basedPath?: string
  } = {}
): Promise<string | void> => {
  // check if client is correct version

  const basedClientPath =
    opts.basedPath ||
    require.resolve('@based/client', { paths: [process.cwd()] })

  if (!basedClientPath) {
    throw new Error('Cannot find basedClient')
  }

  // original
  const decPath = basedClientPath.replace('/index.js', '/index.d.ts')
  const decPathOriginal = basedClientPath.replace(
    '/index.js',
    '/index_original.d.ts'
  )

  let decFile = ''

  try {
    decFile = (await readFile(decPathOriginal)).toString('utf-8')
  } catch (err) {
    throw new Error(
      'Cannot find original declaration file - you may need to upgrade to @based/client ^4.8.8'
    )
  }

  let imports = opts.extraImports ? opts.extraImports.join('\n') + '\n' : '\n'

  let callFns = '\n'
  let queryFns = '\n'

  let fnCnt = 0
  let queryCnt = 0

  let needsParsing = opts.extraImports ?? false

  for (const fn of fns) {
    if (fn.config.type === 'function') {
      needsParsing = true
      fnCnt++
      if ('path' in fn) {
        const name = 'FN_Type_' + fnCnt
        imports += `import type ${name} from '${fn.path}';\n`
        callFns += `
      call(
        name: '${fn.config.name}',
        payload: Parameters<typeof ${name}>[1],
        opts?: CallOptions
      ): ReturnType<typeof ${name}>;      
    `
      } else {
        callFns += `
        call(
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
        queryFns += `
        query(name: '${fn.config.name}', payload: Parameters<typeof ${name}>[1], opts?: QueryOptions): BasedQuery<Parameters<typeof ${name}>[1],Parameters<Parameters<typeof ${name}>[2]>[0]>;
    `
      } else {
        queryFns += `
        query(name: '${fn.config.name}', payload: ${fn.payload}, opts?: QueryOptions): BasedQuery<${fn.payload},${fn.result}>;
    `
      }
    }
  }

  if (needsParsing) {
    let x = imports + decFile
    if (fnCnt > 0) {
      x = x.replace(
        'call(name: string, payload?: any, opts?: CallOptions): Promise<any>;',
        callFns
      )
    }
    if (queryCnt > 0) {
      x = x.replace(
        `query(name: string, payload?: any, opts?: QueryOptions): BasedQuery;`,
        queryFns
      )
    }
    await writeFile(decPath, x)
    return decPath
  }
}
