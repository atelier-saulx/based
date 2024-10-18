import { Csmt, TreeKey, TreeKeyNil, TreeNode, TreeDiff } from './types.js'
import { distance, min, max } from './tree-utils.js'
import membershipProof, { Proof } from './memebership-proof.js'

export function createTree(createHash: () => any): Csmt {
  let root: TreeNode | null = null

  function genHash(s: Buffer) {
    return createHash().update(s).digest()
  }

  function genNodeHash(lHash: Buffer, rHash: Buffer) {
    return createHash().update(lHash).update(rHash).digest()
  }

  function createNode(left: TreeNode | null, right: TreeNode | null): TreeNode {
    const hash =
      left && right
        ? genNodeHash(left.hash, right.hash)
        : genHash(Buffer.from(''))

    return {
      hash,
      key: max(left, right),
      left,
      right,
    }
  }

  function createLeaf(k: TreeKey, h: Buffer): TreeNode {
    return {
      hash: h,
      key: k,
      left: null,
      right: null,
    }
  }

  /**
   * Update node properties.
   */
  function updateNode(node: TreeNode): void {
    if (node.left || node.right) {
      node.key = max(node.left, node.right)
      if (node.left && node.right) {
        node.hash = genNodeHash(node.left.hash, node.right.hash)
      }
    }
  }

  function insert(node: TreeNode, newLeaf: TreeNode) {
    const { key: k } = newLeaf
    let left = node.left
    let right = node.right

    // Check if this is a leaf
    if (!left && !right) {
      const nodeKey = node.key

      if (nodeKey < k) {
        return createNode(node, newLeaf)
      } else if (nodeKey > k) {
        return createNode(newLeaf, node)
      } else {
        throw new Error('Key exist')
      }
    }

    const lDist = distance(k, (left && left.key) || TreeKeyNil)
    const rDist = distance(k, (right && right.key) || TreeKeyNil)
    if (lDist < rDist) {
      if (left) {
        node.left = insert(left, newLeaf)
      } else {
        node.left = newLeaf
      }
    } else if (lDist > rDist) {
      if (right) {
        node.right = insert(right, newLeaf)
      } else {
        node.right = newLeaf
      }
    } else {
      const minKey = min(left, right)

      if (k < minKey) {
        return createNode(newLeaf, node)
      } else {
        return createNode(node, newLeaf)
      }
    }

    updateNode(node)
    return node
  }

  function checkForLeaf(node: TreeNode, k: TreeKey) {
    return !node.left && !node.right && node.key === k
  }

  function deleteNode(node: TreeNode, k: TreeKey): TreeNode {
    const left = node.left
    const right = node.right

    if (!left || !right) {
      throw new Error('The tree is broken')
    }

    if (checkForLeaf(left, k) || checkForLeaf(right, k)) {
      if (left.key === k) {
        // The `left` node is discarded
        return right
      } else {
        // The `right` node is discarded
        return left
      }
    } else {
      const lDist = distance(k, left.key)
      const rDist = distance(k, right.key)

      if (lDist < rDist) {
        node.left = deleteNode(left, k)
        updateNode(node)

        return node
      } else if (lDist > rDist) {
        node.right = deleteNode(right, k)
        updateNode(node)

        return node
      } else {
        throw new Error(`k=${k} does not exist`)
      }
    }
  }

  function diffAB(
    diffA: Map<TreeKey, Buffer>,
    diffB: Map<TreeKey, Buffer>,
    nodeA: TreeNode | null,
    nodeB: TreeNode | null,
  ) {
    if (
      nodeA &&
      nodeB &&
      nodeA.key === nodeB.key &&
      nodeA.hash.compare(nodeB.hash) === 0
    ) {
      return
    }
    // No hash match

    const leftA = nodeA && nodeA.left
    const leftB = nodeB && nodeB.left
    const rightA = nodeA && nodeA.right
    const rightB = nodeB && nodeB.right

    // Check if this is a leaf that is missing from the right tree
    if (nodeA && !leftA && !rightA) {
      const bHash = diffB.get(nodeA.key)

      if (bHash && bHash.compare(nodeA.hash) === 0) {
        // The same leaf appears to exist in both trees
        diffB.delete(nodeA.key)
      } else {
        // The leaf doesn't exist or differs from the right tree
        diffA.set(nodeA.key, nodeA.hash)
      }
    }

    // Check if this is a leaf that is missing from the left tree
    if (nodeB && !leftB && !rightB) {
      const aHash = diffA.get(nodeB.key)

      if (aHash && aHash.compare(nodeB.hash) === 0) {
        diffA.delete(nodeB.key)
      } else {
        diffB.set(nodeB.key, nodeB.hash)
      }
    }

    if (leftA || leftB) {
      // Recurse to the left branch
      diffAB(diffA, diffB, leftA, leftB)
    }
    if (rightA || rightB) {
      // Recurese to the right branch
      diffAB(diffA, diffB, rightA, rightB)
    }
  }

  function diff(tree: Csmt): TreeDiff {
    const leftMap = new Map<TreeKey, Buffer>()
    const rightMap = new Map<TreeKey, Buffer>()
    const nodeA = root
    const nodeB = tree.getRoot()

    diffAB(leftMap, rightMap, nodeA, nodeB)

    return {
      left: [...leftMap],
      right: [...rightMap],
    }
  }

  return {
    getRoot: () => root,
    insert: (k: TreeKey, h: Buffer) => {
      if (!(h instanceof Buffer)) {
        throw new TypeError('`h` must be a Buffer')
      }

      const newLeaf = createLeaf(k, h)

      if (root) {
        root = insert(root, newLeaf)
      } else {
        root = newLeaf
      }
    },
    delete: (k: TreeKey) => {
      if (!root) {
        throw new Error('The tree is empty')
      }

      root = deleteNode(root, k)
    },
    diff,
    membershipProof: (k: TreeKey): Proof => membershipProof(root, k),
  }
}
