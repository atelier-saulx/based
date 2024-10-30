import { strict as assert } from 'node:assert'
import { createHash } from 'crypto'
import test from './shared/test.js'
import { Csmt, createTree } from '../src/csmt/index.js'

const shortHash = (buf: Buffer) => buf.toString('base64').substring(0, 5)
function genNodeHash(lHash: Buffer, rHash: Buffer) {
	return createHash('sha256')
		.update(lHash)
		.update(rHash)
		.digest()
}

await test('insert: A basic tree is formed correctly', async (t) => {
  const tree = createTree(() => createHash('sha256'))

	tree.insert(1, Buffer.from('a'))
	tree.insert(2, Buffer.from('b'))
	tree.insert(3, Buffer.from('c'))
	tree.insert(4, Buffer.from('d'))

	const root = tree.getRoot()
  assert.ok(root)
  assert.ok(root.hash instanceof Buffer)
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
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1, Buffer.from('a'))
  assert.equal(shortHash(tree.getRoot().hash), 'YQ==')

  tree.insert(2, Buffer.from('b'))
  assert.equal(shortHash(tree.getRoot().hash), '+44g/')

  tree.insert(5, Buffer.from('c'))
  assert.equal(shortHash(tree.getRoot().hash), 'OvuAS')
})

await test('insert: Trees are reproducible regardless of the insertion order', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(2, Buffer.from('b'))
  tree1.insert(3, Buffer.from('c'))
  tree1.insert(4, Buffer.from('d'))

  tree2.insert(2, Buffer.from('b'))
  tree2.insert(4, Buffer.from('d'))
  tree2.insert(3, Buffer.from('c'))
  tree2.insert(1, Buffer.from('a'))

  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('insert: Difference in a single node causes the root hash to differ', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(2, Buffer.from('b'))
  tree1.insert(3, Buffer.from('c'))
  tree1.insert(4, Buffer.from('d'))

  tree2.insert(1, Buffer.from('a'))
  tree2.insert(2, Buffer.from('b'))
  tree2.insert(3, Buffer.from('x'))
  tree2.insert(4, Buffer.from('d'))

  assert.notEqual(tree2.getRoot().hash, tree1.getRoot().hash)
})

await test('delete: two trees are no longer equal after deleting a key', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(2, Buffer.from('b'))
  tree1.insert(3, Buffer.from('c'))
  tree1.insert(4, Buffer.from('d'))
  tree1.insert(7, Buffer.from('g'))
  tree1.insert(8, Buffer.from('h'))
  tree1.insert(9, Buffer.from('i'))

  tree2.insert(1, Buffer.from('a'))
  tree2.insert(2, Buffer.from('b'))
  tree2.insert(3, Buffer.from('c'))
  tree2.insert(4, Buffer.from('d'))
  tree2.insert(7, Buffer.from('g'))
  tree2.insert(8, Buffer.from('h'))
  tree2.insert(9, Buffer.from('i'))

  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
  tree1.delete(7)
  assert.notEqual(tree1.getRoot(), tree2.getRoot())
})

await test('delete: delete rebalances the tree properly', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(2, Buffer.from('b'))
  tree1.insert(3, Buffer.from('c'))
  tree1.insert(4, Buffer.from('d'))
  tree1.insert(5, Buffer.from('e'))
  tree1.insert(6, Buffer.from('f'))
  tree1.insert(7, Buffer.from('g'))
  tree1.insert(8, Buffer.from('h'))
  tree1.insert(9, Buffer.from('i'))
  tree1.insert(10, Buffer.from('j'))
  tree1.insert(11, Buffer.from('k'))
  tree1.insert(12, Buffer.from('l'))
  tree1.insert(13, Buffer.from('m'))
  tree1.insert(14, Buffer.from('n'))
  tree1.insert(15, Buffer.from('p'))
  tree1.insert(16, Buffer.from('q'))
  tree1.insert(17, Buffer.from('r'))
  tree1.insert(18, Buffer.from('s'))
  tree1.insert(19, Buffer.from('t'))

  tree2.insert(1, Buffer.from('a'))
  tree2.insert(2, Buffer.from('b'))
  tree2.insert(3, Buffer.from('c'))
  tree2.insert(4, Buffer.from('d'))
  tree2.insert(5, Buffer.from('e'))
  tree2.insert(6, Buffer.from('f'))
  tree2.insert(7, Buffer.from('g'))
  tree2.insert(9, Buffer.from('i'))
  tree2.insert(10, Buffer.from('j'))
  tree2.insert(11, Buffer.from('k'))
  tree2.insert(12, Buffer.from('l'))
  tree2.insert(13, Buffer.from('m'))
  tree2.insert(14, Buffer.from('n'))
  tree2.insert(15, Buffer.from('p'))
  tree2.insert(16, Buffer.from('q'))
  tree2.insert(17, Buffer.from('r'))
  tree2.insert(18, Buffer.from('s'))
  tree2.insert(19, Buffer.from('t'))

  assert.notDeepEqual(tree1.getRoot(), tree2.getRoot())
  tree1.delete(8)
  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('delete: delete rebalances the tree properly (upped boundary)', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(2, Buffer.from('b'))
  tree1.insert(3, Buffer.from('c'))
  tree1.insert(4, Buffer.from('d'))

  tree2.insert(1, Buffer.from('a'))
  tree2.insert(2, Buffer.from('b'))
  tree2.insert(3, Buffer.from('c'))
  tree2.insert(4, Buffer.from('d'))
  tree2.insert(5, Buffer.from('e'))

  assert.notDeepEqual(tree1.getRoot(), tree2.getRoot())
  tree2.delete(5)
  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('delete rebalances the tree properly (lower boundary)', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(4, Buffer.from('b'))
  tree1.insert(3, Buffer.from('b'))
  tree1.insert(5, Buffer.from('c'))
  tree1.insert(2, Buffer.from('b'))

  tree2.insert(2, Buffer.from('b'))
  tree2.insert(3, Buffer.from('b'))
  tree2.insert(4, Buffer.from('b'))
  tree2.insert(5, Buffer.from('c'))

  assert.notDeepEqual(tree1.getRoot(), tree2.getRoot())
  tree1.delete(1)
  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('diff: Equal trees have zero diff', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(2, Buffer.from('b'))
  tree1.insert(3, Buffer.from('c'))
  tree1.insert(4, Buffer.from('d'))

  tree2.insert(1, Buffer.from('a'))
  tree2.insert(2, Buffer.from('b'))
  tree2.insert(3, Buffer.from('c'))
  tree2.insert(4, Buffer.from('d'))

  const diff = tree1.diff(tree2)

  assert.equal(diff.left.length, 0)
  assert.equal(diff.right.length, 0)
})

await test('diff: Equal trees have zero diff both ways', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(2, Buffer.from('b'))
  tree1.insert(3, Buffer.from('c'))
  tree1.insert(4, Buffer.from('d'))

  tree2.insert(1, Buffer.from('a'))
  tree2.insert(2, Buffer.from('b'))
  tree2.insert(3, Buffer.from('c'))
  tree2.insert(4, Buffer.from('d'))

  const diff1 = tree1.diff(tree2)
  const diff2 = tree2.diff(tree1)

  assert.equal(diff1.left.length, 0)
  assert.equal(diff1.right.length, 0)
  assert.equal(diff2.left.length, 0)
  assert.equal(diff2.right.length, 0)
})

await test('diff: A tree has no diff against itself', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1, Buffer.from('a'))
  tree.insert(2, Buffer.from('b'))

  const diff = tree.diff(tree)

  assert.equal(diff.left.length, 0)
  assert.equal(diff.right.length, 0)
})

await test('diff: Right tree has one new node', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(4, Buffer.from('b'))
  tree1.insert(3, Buffer.from('b'))
  tree1.insert(5, Buffer.from('b'))

  tree2.insert(1, Buffer.from('a'))
  tree2.insert(4, Buffer.from('b'))
  tree2.insert(3, Buffer.from('b'))
  tree2.insert(5, Buffer.from('b'))
  tree2.insert(2, Buffer.from('b'))

  const { left, right } = tree1.diff(tree2)

  assert.equal(left.length, 0)
  assert.equal(right.length, 1)
  assert.equal(right[0][0], 2)
  assert.deepEqual(right[0][1], Buffer.from('b'))
})

await test('diff: The same key is marked as a diff in both because the hash has changed', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1, Buffer.from('a'))
  tree1.insert(4, Buffer.from('b'))
  tree1.insert(3, Buffer.from('b'))
  tree1.insert(5, Buffer.from('b'))

  tree2.insert(1, Buffer.from('a'))
  tree2.insert(4, Buffer.from('b'))
  tree2.insert(3, Buffer.from('b'))
  tree2.insert(5, Buffer.from('c')) // hash changed

  const { left, right } = tree1.diff(tree2)

  assert.equal(left.length, 1)
  assert.equal(left[0][0], 5)
  assert.deepEqual(left[0][1], Buffer.from('b'))

  assert.equal(right.length, 1)
  assert.equal(right[0][0], 5)
  assert.deepEqual(right[0][1], Buffer.from('c'))
})

await test('proof: Prove that 3 is a member of the tree', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1, Buffer.from('a'))
  tree.insert(4, Buffer.from('b'))
  tree.insert(3, Buffer.from('c'))
  tree.insert(5, Buffer.from('d'))

  const proof = tree.membershipProof(3)
  const rightHash = Buffer.from('XmV/9hWNPiptI+KlI5F6IwWs7pQjNl4mhpXEt7iRn0w=', 'base64')

  assert.equal(proof.length, 3)
  proof.forEach((el: typeof proof[0]) => assert.equal(Array.isArray(el) && el.length, 2))
  assert.deepEqual(proof[0], [Buffer.from('c'), 3])
  assert.deepEqual(proof[1], [Buffer.from('a'), 'L'])
  assert.deepEqual(proof[2], [rightHash, 'R'])

  const leftHash = genNodeHash(Buffer.from('a'), Buffer.from('c'))
  const rootHash = genNodeHash(leftHash, rightHash)
  const root = tree.getRoot()

  assert.ok(root)
  assert.deepEqual(rootHash, root && root.hash)
})

await test('proof: Prove that 5 is a member of the tree (boundary)', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1, Buffer.from('a'))
  tree.insert(4, Buffer.from('b'))
  tree.insert(3, Buffer.from('c'))
  tree.insert(5, Buffer.from('d'))

  const proof = tree.membershipProof(5)
  const leftHash = genNodeHash(Buffer.from('a'), Buffer.from('c'))

  assert.equal(proof.length, 3)
  proof.forEach((el: typeof proof[0]) => assert.equal(Array.isArray(el) && el.length, 2))
  assert.deepEqual(proof[0], [Buffer.from('d'), 5])
  assert.deepEqual(proof[1], [Buffer.from('b'), 'L'])
  assert.deepEqual(proof[2], [leftHash, 'L'])

  const rightHash = genNodeHash(Buffer.from('b'), Buffer.from('d'))
  const rootHash = genNodeHash(leftHash, rightHash)
  const root = tree.getRoot()

  assert.ok(root)
  assert.deepEqual(rootHash, root && root.hash)
})

await test('proof: Show a proof that 6 is greater than the greatest key in the tree (5)', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1, Buffer.from('a'))
  tree.insert(3, Buffer.from('b'))
  tree.insert(4, Buffer.from('c'))
  tree.insert(5, Buffer.from('d'))

  const proof = tree.membershipProof(6)

  assert.equal(proof.length, 4)

  const [ d, c, ab, miss ] = proof

  assert.equal(Array.isArray(d) && d.length, 2)
  assert.deepEqual(d[0], Buffer.from('d'))
  assert.equal(d[1], 5)

  assert.equal(Array.isArray(c) && c.length, 2)
  assert.deepEqual(c[0], Buffer.from('c'))
  assert.equal(c[1], 'L')

  assert.equal(Array.isArray(ab) && ab.length, 2)
  assert.deepEqual(ab[0], genNodeHash(Buffer.from('a'), Buffer.from('b')))
  assert.equal(ab[1], 'L')

  assert.ok(!miss)
})

await test('proof: Show a proof that 10 is greater than the greatest key in the tree (5)', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1, Buffer.from('a'))
  tree.insert(3, Buffer.from('b'))
  tree.insert(4, Buffer.from('c'))
  tree.insert(5, Buffer.from('d'))

  const proof = tree.membershipProof(10)

  assert.equal(proof.length, 4)

  const [ d, c, ab, miss ] = proof

  assert.equal(Array.isArray(d) && d.length, 2)
  assert.deepEqual(d[0], Buffer.from('d'))
  assert.equal(d[1], 5)

  assert.equal(Array.isArray(c) && c.length, 2)
  assert.deepEqual(c[0], Buffer.from('c'))
  assert.equal(c[1], 'L')

  assert.equal(Array.isArray(ab) && ab.length, 2)
  assert.deepEqual(ab[0], genNodeHash(Buffer.from('a'), Buffer.from('b')))
  assert.equal(ab[1], 'L')

  assert.ok(!miss)
})

await test('proof: Show a proof that 1 is smaller than the smallest key in the tree (2)', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(2, Buffer.from('a'))
  tree.insert(3, Buffer.from('b'))
  tree.insert(4, Buffer.from('c'))
  tree.insert(5, Buffer.from('d'))

  const proof = tree.membershipProof(1)

  assert.equal(proof.length, 4)
  const expectedProof = [
    null,
    [ Buffer.from('a'), 2 ],
    [ Buffer.from('b'), 'R' ],
    [ genNodeHash(Buffer.from('c'), Buffer.from('d')), 'R' ]
  ]

  assert.deepEqual(proof, expectedProof)
})

await test('search', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(2, Buffer.from('a'))
  tree.insert(3, Buffer.from('b'))
  tree.insert(4, Buffer.from('c'))
  tree.insert(5, Buffer.from('d'))

  console.log(tree.search(1))
  console.log(tree.search(10))
  console.log(tree.search(2))
  console.log(tree.search(3))
  console.log(tree.search(4))
  console.log(tree.search(5))
})
