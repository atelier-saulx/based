import { encodeBase64 } from '@saulx/utils'
import { Csmt, TreeNode } from './index.js'

function makeLabel(node: TreeNode<any>) {
  return `${node.key}\n${encodeBase64(node.hash).substring(0, 5)}`
}

// This can be visualized with Graphviz dot
// Online: https://dreampuf.github.io/GraphvizOnline/?engine=dot
export default function draw<T = any>(csmt: Csmt<T>, dataFormatter?: (data: T) => string) {
  const root = csmt.getRoot()
  const lines: string[] = []
  const nodes: string[] = []
  let i = 0

  const walk = (node: TreeNode<T>, prev: number) => {
    const cur = i
    const left = node.left
    const right = node.right
    const isLeaf = !left && !right

    nodes.push(
      `n${cur} [label="${makeLabel(node) + ((dataFormatter && node.data) ? '\n' + dataFormatter(node.data) : '')}"${isLeaf ? ' shape=box' : ''}];`,
    )
    if (cur > 0) {
      lines.push(`n${prev} -- n${cur}`)
    }

    if (left) {
      i++
      walk(left, cur)
    }

    if (right) {
      i++
      walk(right, cur)
    }
  }

  if (root) {
    walk(root, i)
  }

  return `graph ethane {\n${nodes.join('\n')}\n${lines.join('\n')}\n}`
}
