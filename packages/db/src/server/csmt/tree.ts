import { Hash, Csmt, TreeKey, TreeKeyNil, TreeNode, TreeDiff } from './types.js'
import { distance, min, max } from './tree-utils.js'
import membershipProof, { Proof } from './memebership-proof.js'
import { equals } from '../../utils.js'

export function hashEq(a: Hash, b: Hash) {
  return equals(a, b)
}

export function createTree(createHash: () => any): Csmt {
  let root: TreeNode | null = null
  const emptyHash = createHash().digest()

  function genNodeHash(lHash: Hash, rHash: Hash) {
    return createHash().update(lHash).update(rHash).digest()
  }

  function createNode(left: TreeNode | null, right: TreeNode | null): TreeNode {
    const hash = left && right ? genNodeHash(left.hash, right.hash) : emptyHash

    return {
      hash,
      key: max(left, right),
      left,
      right,
    }
  }

  function createLeaf(k: TreeKey, h: Hash, data: any): TreeNode {
    return {
      hash: h,
      key: k,
      data,
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
        throw new Error(`k=${k} exists`)
      }
    }

    const lDist = distance(k, (left && left.key) || TreeKeyNil)
    const rDist = distance(k, (right && right.key) || TreeKeyNil)
    if (lDist < rDist) {
      node.left = left ? insert(left, newLeaf) : newLeaf
    } else if (lDist > rDist) {
      node.right = right ? insert(right, newLeaf) : newLeaf
    } else {
      return k < min(left, right)
        ? createNode(newLeaf, node)
        : createNode(node, newLeaf)
    }

    updateNode(node)
    return node
  }

  function checkForLeaf(node: TreeNode, k: TreeKey) {
    return !node.left && !node.right && node.key === k
  }

  function deleteNode(node: TreeNode, k: TreeKey): TreeNode | null {
    const left = node.left
    const right = node.right

    if (!left || !right) {
      if (node.data) {
        if (node.key === k) {
          return null
        }

        throw new Error(`k=${k} does not exist`)
      } else {
        throw new Error('The tree is broken')
      }
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

  function updateNodeHash(node: TreeNode) {
    if (node.left && node.right) {
      node.hash = genNodeHash(node.left.hash, node.right.hash)
    }
  }

  function updateHash(node: TreeNode, k: TreeKey, hash: Hash): void {
    if (!node) return
    const { left, right } = node
    if (k === node.key && !left && !right) {
      node.hash = hash
    } else {
      if (left && left.key === k) {
        updateHash(left, k, hash)
        updateNodeHash(left)
        updateNodeHash(node)
        return
      }
      if (right && right.key === k) {
        updateHash(right, k, hash)
        updateNodeHash(right)
        updateNodeHash(node)
        return
      }
      const lDist = distance(k, (left && left.key) || TreeKeyNil)
      const rDist = distance(k, (right && right.key) || TreeKeyNil)
      if (left && lDist <= rDist) {
        updateHash(left, k, hash)
        updateNodeHash(left)
        updateNodeHash(node)
        return
      }
      if (right && rDist <= lDist) {
        updateHash(right, k, hash)
        updateNodeHash(right)
        updateNodeHash(node)
        return
      }
    }
  }

  function diffAB(
    diffA: Map<TreeKey, Hash>,
    diffB: Map<TreeKey, Hash>,
    nodeA: TreeNode | null,
    nodeB: TreeNode | null,
  ) {
    if (
      nodeA &&
      nodeB &&
      nodeA.key === nodeB.key &&
      hashEq(nodeA.hash, nodeB.hash)
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

      if (bHash && hashEq(bHash, nodeA.hash)) {
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

      if (aHash && hashEq(aHash, nodeB.hash)) {
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
      // Recurse to the right branch
      diffAB(diffA, diffB, rightA, rightB)
    }
  }

  function diff(tree: Csmt): TreeDiff {
    const leftMap = new Map<TreeKey, Hash>()
    const rightMap = new Map<TreeKey, Hash>()
    const nodeA = root
    const nodeB = tree.getRoot()

    diffAB(leftMap, rightMap, nodeA, nodeB)

    return {
      left: [...leftMap],
      right: [...rightMap],
    }
  }

  function _visitLeafNodes(node: TreeNode, cb: (leaf: TreeNode) => void) {
    if (!node) return
    if (!node.left && !node.right) cb(node)
    else {
      if (node.left) _visitLeafNodes(node.left, cb)
      if (node.right) _visitLeafNodes(node.right, cb)
    }
  }

  function search(node: TreeNode, k: TreeKey): TreeNode | null {
    if (!node || (k === node.key && !node.left && !node.right)) return node
    const { left, right } = node
    if (left && left.key === k) return search(left, k)
    if (right && right.key === k) return search(right, k)
    const lDist = distance(k, (left && left.key) || TreeKeyNil)
    const rDist = distance(k, (right && right.key) || TreeKeyNil)
    if (left && lDist <= rDist) return search(left, k)
    if (right && rDist <= lDist) return search(right, k)
    return null
  }

  return {
    emptyHash,

    getRoot: () => root,
    insert: (k: TreeKey, h: Hash, data: any = null) => {
      if (!(h instanceof Uint8Array)) {
        throw new TypeError('`h` must be a Uint8Array')
      }

      const newLeaf = createLeaf(k, h, data)
      root = root ? insert(root, newLeaf) : newLeaf
    },
    update: (k: TreeKey, h: Hash) => {
      if (root) {
        updateHash(root, k, h)
      }
    },
    delete: (k: TreeKey) => {
      if (root) {
        root = deleteNode(root, k)
      }
    },
    diff,
    membershipProof: (k: TreeKey): Proof => membershipProof(root, k),
    visitLeafNodes: (cb: (leaf: TreeNode) => void) => _visitLeafNodes(root, cb),
    search: (k: TreeKey) => search(root, k),
  }
}
