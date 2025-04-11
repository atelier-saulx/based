import { encodeBase64 } from '@saulx/utils'
import { Csmt, TreeNode } from './index.js'

function makeLabel(node: TreeNode) {
  return `${node.key}\n${encodeBase64(node.hash).substring(0, 5)}`
}

export default function draw(csmt: Csmt) {
  const root = csmt.getRoot()
  const lines: string[] = []
  const nodes: string[] = []
  let i = 0

  const walk = (node: TreeNode, prev: number) => {
    const cur = i
    const left = node.left
    const right = node.right
    const isLeaf = !left && !right

    nodes.push(
      `n${cur} [label="${makeLabel(node)}"${isLeaf ? ' shape=box' : ''}];`,
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
