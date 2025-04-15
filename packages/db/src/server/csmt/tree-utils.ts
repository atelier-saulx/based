import { TreeKey, TreeKeyNil, TreeNode } from './types.js'

export function distance(x: TreeKey, y: TreeKey): TreeKey {
  let v = x ^ y
  let r = TreeKeyNil

  while ((v >>= 1)) {
    r++
  }

  return r
}

export function min(x: TreeNode<any> | null, y: TreeNode<any> | null): TreeKey {
  const a = (x && x.key) || TreeKeyNil
  const b = (y && y.key) || TreeKeyNil

  return a < b ? a : b
}

export function max(x: TreeNode<any> | null, y: TreeNode<any> | null): TreeKey {
  const a = (x && x.key) || TreeKeyNil
  const b = (y && y.key) || TreeKeyNil

  return a > b ? a : b
}

// Find min key in a subtree.
export function minInSubtree(node: TreeNode<any>): TreeKey {
  if (!node.left) {
    // We assume that the tree is always full and the last left node we can
    // find is the min.
    return node.key
  }

  return minInSubtree(node.left)
}

// Find max key in a subtree.
export function maxInSubtree(node: TreeNode<any>): TreeKey {
  return node.key
}
