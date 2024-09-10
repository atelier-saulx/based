import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import pc from 'picocolors'
import { rel } from './index.js'

const warned = new Set()
const types = {
  query: 'BasedQueryFunction',
  function: 'BasedFunction',
  app: 'BasedAppFunction',
}

export const invalidate = async (
  fileName: string,
  config: BasedCli.ConfigBase,
): Promise<boolean> => {
  const source = (await readFile(fileName)).toString()
  const target = ts.ScriptTarget.ESNext
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    target,
    false,
    ts.ScriptKind.TSX,
  )
  const typeName = types[config.type]
  let hasExport: boolean = false
  let hasType = !typeName

  ts.forEachChild(sourceFile, function walk(node) {
    if (
      node.kind === ts.SyntaxKind.ExportAssignment ||
      node.kind === ts.SyntaxKind.ExportKeyword
    ) {
      hasExport = true
    }

    // @ts-ignore
    if (node.type?.typeName?.escapedText === typeName) {
      hasType = true
    }

    if (!hasType || !hasExport) {
      ts.forEachChild(node, walk)
    }
  })

  if (hasType) {
    warned.delete(fileName)
  } else if (!warned.has(fileName)) {
    console.warn(
      `${pc.yellow(
        `⚠️ Missing type "${typeName}" in function "${config.name}" of type "${config.type}"`,
      )} ${pc.dim(rel(fileName))}`,
    )
    warned.add(fileName)
  }

  if (!hasExport) {
    console.error(pc.red(`‼️ Nothing exported in: ${fileName}`))
    return true
  }
}
