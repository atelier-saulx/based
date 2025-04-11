import { strict as assert, notEqual } from 'node:assert'
import { createHash } from 'crypto'
import test from './shared/test.js'
import { equal } from './shared/assert.js'
import { base64encode } from '../src/utils.js'
import { Csmt, createTree } from '../src/server/csmt/index.js'
import { decodeBase64, deepEqual } from '@saulx/utils'

const ENCODER = new TextEncoder()

const shortHash = (buf: Uint8Array) => base64encode(buf).substring(0, 5)

function testHashGen() {
  const f = createHash('sha256')

  const o = {
    update: (data) => {
      f.update(data)
      return o
    },
    digest: () => new Uint8Array(f.digest()),
  }

  return o
}

function genNodeHash(lHash: Uint8Array, rHash: Uint8Array) {
  return testHashGen().update(lHash).update(rHash).digest()
}

await test('insert: A basic tree is formed correctly', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  tree.insert(2, ENCODER.encode('b'))
  tree.insert(3, ENCODER.encode('c'))
  tree.insert(4, ENCODER.encode('d'))

  const root = tree.getRoot()
  assert.ok(root)
  assert.ok(root.hash instanceof Uint8Array)
  assert.equal(shortHash(root.hash), 'jq/kE')
  assert.equal(root.key, 4)

  assert.ok(root.left)
  assert.equal(shortHash(root.left.hash), '8AS3E')
  assert.equal(root.left.key, 3)

  assert.ok(root.left.left)
  assert.equal(shortHash(root.left.left.hash), 'YQ==')
  assert.equal(root.left.left.key, 1)
  assert.ok(!root.left.left.left)
  assert.ok(!root.left.left.right)

  assert.ok(root.left.right)
  assert.equal(shortHash(root.left.right.hash), 'Hgu9b')
  assert.equal(root.left.right.key, 3)

  assert.ok(root.left.right.left)
  assert.equal(shortHash(root.left.right.left.hash), 'Yg==')
  assert.equal(root.left.right.left.key, 2)
  assert.ok(!root.left.right.left.left)
  assert.ok(!root.left.right.left.right)

  assert.ok(root.left.right.right)
  assert.equal(shortHash(root.left.right.right.hash), 'Yw==')
  assert.equal(root.left.right.right.key, 3)
  assert.ok(!root.left.right.right.left)
  assert.ok(!root.left.right.right.right)

  assert.ok(root.right)
  assert.equal(shortHash(root.right.hash), 'ZA==')
  assert.equal(root.right.key, 4)
  assert.ok(!root.right.left)
  assert.ok(!root.right.right)
})

await test('insert: The root hash is recomputed on every insert', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  assert.equal(shortHash(tree.getRoot().hash), 'YQ==')

  tree.insert(2, ENCODER.encode('b'))
  assert.equal(shortHash(tree.getRoot().hash), '+44g/')

  tree.insert(5, ENCODER.encode('c'))
  assert.equal(shortHash(tree.getRoot().hash), 'OvuAS')
})

await test('insert: Same key can be only inserted once', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  assert.equal(shortHash(tree.getRoot().hash), 'YQ==')

  tree.insert(2, ENCODER.encode('b'))
  assert.equal(shortHash(tree.getRoot().hash), '+44g/')

  tree.insert(5, ENCODER.encode('c'))
  assert.equal(shortHash(tree.getRoot().hash), 'OvuAS')

  assert.throws(() => tree.insert(5, ENCODER.encode('c')))
  assert.equal(shortHash(tree.getRoot().hash), 'OvuAS')
})

// FDN-791
// The original paper (https://eprint.iacr.org/2018/955.pdf) states:
// > 2.4 History Independence
// > A unique set of keys produce a deterministic root hash,
// > regardless of the order in which keys have been inserted or removed.
// However, this is not true.
await test.skip('insert: Trees are reproducible regardless of the insertion order', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(2, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('c'))
  tree1.insert(4, ENCODER.encode('d'))

  tree2.insert(2, ENCODER.encode('b'))
  tree2.insert(4, ENCODER.encode('d'))
  tree2.insert(3, ENCODER.encode('c'))
  tree2.insert(1, ENCODER.encode('a'))

  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test.skip('insert: Trees are reproducible regardless of the insertion order 2', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(4294967297, ENCODER.encode('a'))
  tree1.insert(8589934593, ENCODER.encode('b'))
  tree1.insert(12884901889, ENCODER.encode('c'))

  tree2.insert(8589934593, ENCODER.encode('b'))
  tree2.insert(12884901889, ENCODER.encode('c'))
  tree2.insert(4294967297, ENCODER.encode('a'))

  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('insert: Difference in a single node causes the root hash to differ', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(2, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('c'))
  tree1.insert(4, ENCODER.encode('d'))

  tree2.insert(1, ENCODER.encode('a'))
  tree2.insert(2, ENCODER.encode('b'))
  tree2.insert(3, ENCODER.encode('x'))
  tree2.insert(4, ENCODER.encode('d'))

  assert.notEqual(tree2.getRoot().hash, tree1.getRoot().hash)
})

await test('delete: delete throws', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  tree.insert(2, ENCODER.encode('b'))
  tree.insert(3, ENCODER.encode('c'))
  tree.insert(4, ENCODER.encode('d'))

  assert.doesNotThrow(() => tree.delete(4))
  assert.throws(() => tree.delete(4))
  assert.throws(() => tree.delete(5))
})

await test('delete and insert same', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  tree.insert(2, ENCODER.encode('b'))

  assert.doesNotThrow(() => tree.delete(2))
  assert.doesNotThrow(() => tree.insert(2, ENCODER.encode('c')))

  const l = tree.search(2)
  assert.equal(l.key, 2)
  deepEqual(l.hash, ENCODER.encode('c'))
})

await test('delete: two trees are no longer equal after deleting a key', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(2, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('c'))
  tree1.insert(4, ENCODER.encode('d'))
  tree1.insert(7, ENCODER.encode('g'))
  tree1.insert(8, ENCODER.encode('h'))
  tree1.insert(9, ENCODER.encode('i'))

  tree2.insert(1, ENCODER.encode('a'))
  tree2.insert(2, ENCODER.encode('b'))
  tree2.insert(3, ENCODER.encode('c'))
  tree2.insert(4, ENCODER.encode('d'))
  tree2.insert(7, ENCODER.encode('g'))
  tree2.insert(8, ENCODER.encode('h'))
  tree2.insert(9, ENCODER.encode('i'))

  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
  tree1.delete(7)
  assert.notEqual(tree1.getRoot(), tree2.getRoot())
})

await test('delete: delete rebalances the tree properly', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(2, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('c'))
  tree1.insert(4, ENCODER.encode('d'))
  tree1.insert(5, ENCODER.encode('e'))
  tree1.insert(6, ENCODER.encode('f'))
  tree1.insert(7, ENCODER.encode('g'))
  tree1.insert(8, ENCODER.encode('h'))
  tree1.insert(9, ENCODER.encode('i'))
  tree1.insert(10, ENCODER.encode('j'))
  tree1.insert(11, ENCODER.encode('k'))
  tree1.insert(12, ENCODER.encode('l'))
  tree1.insert(13, ENCODER.encode('m'))
  tree1.insert(14, ENCODER.encode('n'))
  tree1.insert(15, ENCODER.encode('p'))
  tree1.insert(16, ENCODER.encode('q'))
  tree1.insert(17, ENCODER.encode('r'))
  tree1.insert(18, ENCODER.encode('s'))
  tree1.insert(19, ENCODER.encode('t'))

  tree2.insert(1, ENCODER.encode('a'))
  tree2.insert(2, ENCODER.encode('b'))
  tree2.insert(3, ENCODER.encode('c'))
  tree2.insert(4, ENCODER.encode('d'))
  tree2.insert(5, ENCODER.encode('e'))
  tree2.insert(6, ENCODER.encode('f'))
  tree2.insert(7, ENCODER.encode('g'))
  tree2.insert(9, ENCODER.encode('i'))
  tree2.insert(10, ENCODER.encode('j'))
  tree2.insert(11, ENCODER.encode('k'))
  tree2.insert(12, ENCODER.encode('l'))
  tree2.insert(13, ENCODER.encode('m'))
  tree2.insert(14, ENCODER.encode('n'))
  tree2.insert(15, ENCODER.encode('p'))
  tree2.insert(16, ENCODER.encode('q'))
  tree2.insert(17, ENCODER.encode('r'))
  tree2.insert(18, ENCODER.encode('s'))
  tree2.insert(19, ENCODER.encode('t'))

  assert.notDeepEqual(tree1.getRoot(), tree2.getRoot())
  tree1.delete(8)
  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('delete: delete rebalances the tree properly (upped boundary)', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(2, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('c'))
  tree1.insert(4, ENCODER.encode('d'))

  tree2.insert(1, ENCODER.encode('a'))
  tree2.insert(2, ENCODER.encode('b'))
  tree2.insert(3, ENCODER.encode('c'))
  tree2.insert(4, ENCODER.encode('d'))
  tree2.insert(5, ENCODER.encode('e'))

  assert.notDeepEqual(tree1.getRoot(), tree2.getRoot())
  tree2.delete(5)
  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('delete: rebalances the tree properly (lower boundary)', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(4, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('b'))
  tree1.insert(5, ENCODER.encode('c'))
  tree1.insert(2, ENCODER.encode('b'))

  tree2.insert(2, ENCODER.encode('b'))
  tree2.insert(3, ENCODER.encode('b'))
  tree2.insert(4, ENCODER.encode('b'))
  tree2.insert(5, ENCODER.encode('c'))

  assert.notDeepEqual(tree1.getRoot(), tree2.getRoot())
  tree1.delete(1)
  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('diff: Equal trees have zero diff', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(2, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('c'))
  tree1.insert(4, ENCODER.encode('d'))

  tree2.insert(1, ENCODER.encode('a'))
  tree2.insert(2, ENCODER.encode('b'))
  tree2.insert(3, ENCODER.encode('c'))
  tree2.insert(4, ENCODER.encode('d'))

  const diff = tree1.diff(tree2)

  assert.equal(diff.left.length, 0)
  assert.equal(diff.right.length, 0)
})

await test('diff: Equal trees have zero diff both ways', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(2, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('c'))
  tree1.insert(4, ENCODER.encode('d'))

  tree2.insert(1, ENCODER.encode('a'))
  tree2.insert(2, ENCODER.encode('b'))
  tree2.insert(3, ENCODER.encode('c'))
  tree2.insert(4, ENCODER.encode('d'))

  const diff1 = tree1.diff(tree2)
  const diff2 = tree2.diff(tree1)

  assert.equal(diff1.left.length, 0)
  assert.equal(diff1.right.length, 0)
  assert.equal(diff2.left.length, 0)
  assert.equal(diff2.right.length, 0)
})

await test('diff: A tree has no diff against itself', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  tree.insert(2, ENCODER.encode('b'))

  const diff = tree.diff(tree)

  assert.equal(diff.left.length, 0)
  assert.equal(diff.right.length, 0)
})

await test('diff: Right tree has one new node', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(4, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('b'))
  tree1.insert(5, ENCODER.encode('b'))

  tree2.insert(1, ENCODER.encode('a'))
  tree2.insert(4, ENCODER.encode('b'))
  tree2.insert(3, ENCODER.encode('b'))
  tree2.insert(5, ENCODER.encode('b'))
  tree2.insert(2, ENCODER.encode('b'))

  const { left, right } = tree1.diff(tree2)

  assert.equal(left.length, 0)
  assert.equal(right.length, 1)
  assert.equal(right[0][0], 2)
  assert.deepEqual(right[0][1], ENCODER.encode('b'))
})

await test('diff: The same key is marked as a diff in both because the hash has changed', async (t) => {
  const tree1 = createTree(testHashGen)
  const tree2 = createTree(testHashGen)

  tree1.insert(1, ENCODER.encode('a'))
  tree1.insert(4, ENCODER.encode('b'))
  tree1.insert(3, ENCODER.encode('b'))
  tree1.insert(5, ENCODER.encode('b'))

  tree2.insert(1, ENCODER.encode('a'))
  tree2.insert(4, ENCODER.encode('b'))
  tree2.insert(3, ENCODER.encode('b'))
  tree2.insert(5, ENCODER.encode('c')) // hash changed

  const { left, right } = tree1.diff(tree2)

  assert.equal(left.length, 1)
  assert.equal(left[0][0], 5)
  assert.deepEqual(left[0][1], ENCODER.encode('b'))

  assert.equal(right.length, 1)
  assert.equal(right[0][0], 5)
  assert.deepEqual(right[0][1], ENCODER.encode('c'))
})

await test('proof: Prove that 3 is a member of the tree', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  tree.insert(4, ENCODER.encode('b'))
  tree.insert(3, ENCODER.encode('c'))
  tree.insert(5, ENCODER.encode('d'))

  const proof = tree.membershipProof(3)
  const rightHash = decodeBase64('XmV/9hWNPiptI+KlI5F6IwWs7pQjNl4mhpXEt7iRn0w=')

  assert.equal(proof.length, 3)
  proof.forEach((el: (typeof proof)[0]) =>
    assert.equal(Array.isArray(el) && el.length, 2),
  )
  assert.deepEqual(proof[0], [ENCODER.encode('c'), 3])
  assert.deepEqual(proof[1], [ENCODER.encode('a'), 'L'])
  assert.deepEqual(proof[2], [rightHash, 'R'])

  const leftHash = genNodeHash(ENCODER.encode('a'), ENCODER.encode('c'))
  const rootHash = genNodeHash(leftHash, rightHash)
  const root = tree.getRoot()

  assert.ok(root)
  assert.deepEqual(rootHash, root && root.hash)
})

await test('proof: Prove that 5 is a member of the tree (boundary)', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  tree.insert(4, ENCODER.encode('b'))
  tree.insert(3, ENCODER.encode('c'))
  tree.insert(5, ENCODER.encode('d'))

  const proof = tree.membershipProof(5)
  const leftHash = genNodeHash(ENCODER.encode('a'), ENCODER.encode('c'))

  assert.equal(proof.length, 3)
  proof.forEach((el: (typeof proof)[0]) =>
    assert.equal(Array.isArray(el) && el.length, 2),
  )
  assert.deepEqual(proof[0], [ENCODER.encode('d'), 5])
  assert.deepEqual(proof[1], [ENCODER.encode('b'), 'L'])
  assert.deepEqual(proof[2], [leftHash, 'L'])

  const rightHash = genNodeHash(ENCODER.encode('b'), ENCODER.encode('d'))
  const rootHash = genNodeHash(leftHash, rightHash)
  const root = tree.getRoot()

  assert.ok(root)
  assert.deepEqual(rootHash, root && root.hash)
})

await test('proof: Show a proof that 6 is greater than the greatest key in the tree (5)', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  tree.insert(3, ENCODER.encode('b'))
  tree.insert(4, ENCODER.encode('c'))
  tree.insert(5, ENCODER.encode('d'))

  const proof = tree.membershipProof(6)

  assert.equal(proof.length, 4)

  const [d, c, ab, miss] = proof

  assert.equal(Array.isArray(d) && d.length, 2)
  assert.deepEqual(d[0], ENCODER.encode('d'))
  assert.equal(d[1], 5)

  assert.equal(Array.isArray(c) && c.length, 2)
  assert.deepEqual(c[0], ENCODER.encode('c'))
  assert.equal(c[1], 'L')

  assert.equal(Array.isArray(ab) && ab.length, 2)
  assert.deepEqual(ab[0], genNodeHash(ENCODER.encode('a'), ENCODER.encode('b')))
  assert.equal(ab[1], 'L')

  assert.ok(!miss)
})

await test('proof: Show a proof that 10 is greater than the greatest key in the tree (5)', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(1, ENCODER.encode('a'))
  tree.insert(3, ENCODER.encode('b'))
  tree.insert(4, ENCODER.encode('c'))
  tree.insert(5, ENCODER.encode('d'))

  const proof = tree.membershipProof(10)

  assert.equal(proof.length, 4)

  const [d, c, ab, miss] = proof

  assert.equal(Array.isArray(d) && d.length, 2)
  assert.deepEqual(d[0], ENCODER.encode('d'))
  assert.equal(d[1], 5)

  assert.equal(Array.isArray(c) && c.length, 2)
  assert.deepEqual(c[0], ENCODER.encode('c'))
  assert.equal(c[1], 'L')

  assert.equal(Array.isArray(ab) && ab.length, 2)
  assert.deepEqual(ab[0], genNodeHash(ENCODER.encode('a'), ENCODER.encode('b')))
  assert.equal(ab[1], 'L')

  assert.ok(!miss)
})

await test('proof: Show a proof that 1 is smaller than the smallest key in the tree (2)', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(2, ENCODER.encode('a'))
  tree.insert(3, ENCODER.encode('b'))
  tree.insert(4, ENCODER.encode('c'))
  tree.insert(5, ENCODER.encode('d'))

  const proof = tree.membershipProof(1)

  assert.equal(proof.length, 4)
  const expectedProof = [
    null,
    [ENCODER.encode('a'), 2],
    [ENCODER.encode('b'), 'R'],
    [genNodeHash(ENCODER.encode('c'), ENCODER.encode('d')), 'R'],
  ]

  assert.deepEqual(proof, expectedProof)
})

await test('search: basic', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(2, ENCODER.encode('a'))
  tree.insert(3, ENCODER.encode('b'))
  tree.insert(4, ENCODER.encode('c'))
  tree.insert(5, ENCODER.encode('d'))

  equal(tree.search(1), null)
  equal(tree.search(10), null)
  equal(tree.search(2)?.key, 2)
  equal(tree.search(3)?.key, 3)
  equal(tree.search(4)?.key, 4)
  equal(tree.search(5)?.key, 5)
})

await test('search: distance mix', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(15032385535, ENCODER.encode('a'))
  tree.insert(10737418239, ENCODER.encode('b'))
  tree.insert(12884901889, ENCODER.encode('c'))

  equal(tree.search(15032385535)?.key, 15032385535)
  equal(tree.search(10737418239)?.key, 10737418239)
  equal(tree.search(12884901889)?.key, 12884901889)
})

await test('update', async (t) => {
  const tree = createTree(testHashGen)

  tree.insert(15032385535, ENCODER.encode('a'))
  tree.insert(10737418239, ENCODER.encode('b'))
  tree.insert(12884901889, ENCODER.encode('c'))

  let prevRootHash = tree.getRoot().hash
  tree.update(15032385535, ENCODER.encode('x'))
  notEqual(tree.getRoot().hash, prevRootHash)

  prevRootHash = tree.getRoot().hash
  tree.update(10737418239, ENCODER.encode('y'))
  notEqual(tree.getRoot().hash, prevRootHash)

  prevRootHash = tree.getRoot().hash
  tree.update(12884901889, ENCODER.encode('z'))
  notEqual(tree.getRoot().hash, prevRootHash)

  equal(tree.search(15032385535)?.hash, ENCODER.encode('x'))
  equal(tree.search(10737418239)?.hash, ENCODER.encode('y'))
  equal(tree.search(12884901889)?.hash, ENCODER.encode('z'))
})
