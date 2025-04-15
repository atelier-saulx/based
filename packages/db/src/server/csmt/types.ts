import { Proof } from './memebership-proof.js'

export type TreeKey = number
export const TreeKeyNil = 0
export type Hash = Uint8Array

export interface TreeNode<T> {
  hash: Hash
  key: TreeKey | null
  data?: T | null // Only on a leaf
  left: TreeNode<T> | null
  right: TreeNode<T> | null
}

export type KeyHashPair = [TreeKey, Hash]

export interface TreeDiff {
  left: KeyHashPair[]
  right: KeyHashPair[]
}

export interface Csmt<T> {
  emptyHash: Uint8Array,

  /**
   * Get the root node.
   */
  getRoot: () => TreeNode<T> | null

  /**
   * Insert a new key-hash pair.
   */
  insert: (k: TreeKey, h: Hash, data?: any) => void

  /**
   * Delete a key-hash pair from the tree.
   */
  delete: (k: TreeKey) => void

  /**
   * Update node hash.
   */
  update: (k: TreeKey, h: Hash) => void

  /**
   * Compute the diff between this and a given tree.
   */
  diff: (tree: Csmt<T>) => TreeDiff

  /**
   * Provide a proof of membership if a key exist in the three;
   * Otherwise a proof of non-membership is returned.
   */
  membershipProof: (k: TreeKey) => Proof

  visitLeafNodes: (cb: (leaf: TreeNode<T>) => void) => void

  search: (k: TreeKey) => TreeNode<T>
}
