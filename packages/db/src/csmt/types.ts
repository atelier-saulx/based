import { Proof } from './memebership-proof.js'

export interface TreeNode {
  hash: Buffer
  key: bigint
  left: TreeNode | null
  right: TreeNode | null
}

export type KeyHashPair = [bigint, Buffer]

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
  insert: (k: bigint, h: Buffer) => void

  /**
   * Delete a key-hash pair from the tree.
   */
  delete: (k: bigint) => void

  /**
   * Provide a proof of membership if a key exist in the three;
   * Otherwise a proof of non-membership is returned.
   */
  membershipProof: (k: bigint) => Proof

  /**
   * Compute the diff between this and a given tree.
   */
  diff: (tree: Csmt) => TreeDiff
}
