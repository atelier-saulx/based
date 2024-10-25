import { Proof } from './memebership-proof.js'

export type TreeKey = number
export const TreeKeyNil = 0

export interface TreeNode {
  hash: Buffer
  key: TreeKey
  data?: any // Only on a leaf
  left: TreeNode | null
  right: TreeNode | null
}

export type KeyHashPair = [TreeKey, Buffer]

export interface TreeDiff {
  left: KeyHashPair[]
  right: KeyHashPair[]
}

export interface Csmt {
  /**
   * Get the root node.
   */
  getRoot: () => TreeNode | null

  /**
   * Insert a new key-hash pair.
   */
  insert: (k: TreeKey, h: Buffer, data?: any) => void

  /**
   * Delete a key-hash pair from the tree.
   */
  delete: (k: TreeKey) => void

  /**
   * Compute the diff between this and a given tree.
   */
  diff: (tree: Csmt) => TreeDiff

  /**
   * Provide a proof of membership if a key exist in the three;
   * Otherwise a proof of non-membership is returned.
   */
  membershipProof: (k: TreeKey) => Proof

  visitLeafNodes: (cb: (leaf: TreeNode) => void) => void
}
