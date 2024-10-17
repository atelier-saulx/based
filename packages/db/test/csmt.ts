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

	tree.insert(1n, Buffer.from('a'))
	tree.insert(2n, Buffer.from('b'))
	tree.insert(3n, Buffer.from('c'))
	tree.insert(4n, Buffer.from('d'))

	const root = tree.getRoot()
  assert.ok(root)
  assert.ok(root.hash instanceof Buffer)
  assert.equal(shortHash(root.hash), 'jq/kE')
  assert.equal(root.key, 4n)

  assert.ok(root.left)
  assert.equal(shortHash(root.left.hash), '8AS3E')
  assert.equal(root.left.key, 3n)

  assert.ok(root.left.left)
  assert.equal(shortHash(root.left.left.hash), 'YQ==')
	assert.equal(root.left.left.key, 1n)
	assert.ok(!root.left.left.left)
	assert.ok(!root.left.left.right)

	assert.ok(root.left.right)
	assert.equal(shortHash(root.left.right.hash), 'Hgu9b')
	assert.equal(root.left.right.key, 3n)

	assert.ok(root.left.right.left)
	assert.equal(shortHash(root.left.right.left.hash), 'Yg==')
	assert.equal(root.left.right.left.key, 2n)
	assert.ok(!root.left.right.left.left)
	assert.ok(!root.left.right.left.right)

	assert.ok(root.left.right.right)
	assert.equal(shortHash(root.left.right.right.hash), 'Yw==')
	assert.equal(root.left.right.right.key, 3n)
	assert.ok(!root.left.right.right.left)
	assert.ok(!root.left.right.right.right)

	assert.ok(root.right)
	assert.equal(shortHash(root.right.hash), 'ZA==')
	assert.equal(root.right.key, 4n)
	assert.ok(!root.right.left)
	assert.ok(!root.right.right)
})

await test('insert: The root hash is recomputed on every insert', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1n, Buffer.from('a'))
  assert.equal(shortHash(tree.getRoot().hash), 'YQ==')

  tree.insert(2n, Buffer.from('b'))
  assert.equal(shortHash(tree.getRoot().hash), '+44g/')

  tree.insert(5n, Buffer.from('c'))
  assert.equal(shortHash(tree.getRoot().hash), 'OvuAS')
})

await test('insert: Trees are reproducible regardless of the insertion order', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(2n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('c'))
  tree1.insert(4n, Buffer.from('d'))

  tree2.insert(2n, Buffer.from('b'))
  tree2.insert(4n, Buffer.from('d'))
  tree2.insert(3n, Buffer.from('c'))
  tree2.insert(1n, Buffer.from('a'))

  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('insert: Difference in a single node causes the root hash to differ', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(2n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('c'))
  tree1.insert(4n, Buffer.from('d'))

  tree2.insert(1n, Buffer.from('a'))
  tree2.insert(2n, Buffer.from('b'))
  tree2.insert(3n, Buffer.from('x'))
  tree2.insert(4n, Buffer.from('d'))

  assert.notEqual(tree2.getRoot().hash, tree1.getRoot().hash)
})

await test('delete: two trees are no longer equal after deleting a key', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(2n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('c'))
  tree1.insert(4n, Buffer.from('d'))
  tree1.insert(7n, Buffer.from('g'))
  tree1.insert(8n, Buffer.from('h'))
  tree1.insert(9n, Buffer.from('i'))

  tree2.insert(1n, Buffer.from('a'))
  tree2.insert(2n, Buffer.from('b'))
  tree2.insert(3n, Buffer.from('c'))
  tree2.insert(4n, Buffer.from('d'))
  tree2.insert(7n, Buffer.from('g'))
  tree2.insert(8n, Buffer.from('h'))
  tree2.insert(9n, Buffer.from('i'))

  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
  tree1.delete(7n)
  assert.notEqual(tree1.getRoot(), tree2.getRoot())
})

await test('delete: delete rebalances the tree properly', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(2n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('c'))
  tree1.insert(4n, Buffer.from('d'))
  tree1.insert(5n, Buffer.from('e'))
  tree1.insert(6n, Buffer.from('f'))
  tree1.insert(7n, Buffer.from('g'))
  tree1.insert(8n, Buffer.from('h'))
  tree1.insert(9n, Buffer.from('i'))
  tree1.insert(10n, Buffer.from('j'))
  tree1.insert(11n, Buffer.from('k'))
  tree1.insert(12n, Buffer.from('l'))
  tree1.insert(13n, Buffer.from('m'))
  tree1.insert(14n, Buffer.from('n'))
  tree1.insert(15n, Buffer.from('p'))
  tree1.insert(16n, Buffer.from('q'))
  tree1.insert(17n, Buffer.from('r'))
  tree1.insert(18n, Buffer.from('s'))
  tree1.insert(19n, Buffer.from('t'))

  tree2.insert(1n, Buffer.from('a'))
  tree2.insert(2n, Buffer.from('b'))
  tree2.insert(3n, Buffer.from('c'))
  tree2.insert(4n, Buffer.from('d'))
  tree2.insert(5n, Buffer.from('e'))
  tree2.insert(6n, Buffer.from('f'))
  tree2.insert(7n, Buffer.from('g'))
  tree2.insert(9n, Buffer.from('i'))
  tree2.insert(10n, Buffer.from('j'))
  tree2.insert(11n, Buffer.from('k'))
  tree2.insert(12n, Buffer.from('l'))
  tree2.insert(13n, Buffer.from('m'))
  tree2.insert(14n, Buffer.from('n'))
  tree2.insert(15n, Buffer.from('p'))
  tree2.insert(16n, Buffer.from('q'))
  tree2.insert(17n, Buffer.from('r'))
  tree2.insert(18n, Buffer.from('s'))
  tree2.insert(19n, Buffer.from('t'))

  assert.notDeepEqual(tree1.getRoot(), tree2.getRoot())
  tree1.delete(8n)
  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('delete: delete rebalances the tree properly (upped boundary)', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(2n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('c'))
  tree1.insert(4n, Buffer.from('d'))

  tree2.insert(1n, Buffer.from('a'))
  tree2.insert(2n, Buffer.from('b'))
  tree2.insert(3n, Buffer.from('c'))
  tree2.insert(4n, Buffer.from('d'))
  tree2.insert(5n, Buffer.from('e'))

  assert.notDeepEqual(tree1.getRoot(), tree2.getRoot())
  tree2.delete(5n)
  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('delete rebalances the tree properly (lower boundary)', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(4n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('b'))
  tree1.insert(5n, Buffer.from('c'))
  tree1.insert(2n, Buffer.from('b'))

  tree2.insert(2n, Buffer.from('b'))
  tree2.insert(3n, Buffer.from('b'))
  tree2.insert(4n, Buffer.from('b'))
  tree2.insert(5n, Buffer.from('c'))

  assert.notDeepEqual(tree1.getRoot(), tree2.getRoot())
  tree1.delete(1n)
  assert.deepEqual(tree1.getRoot(), tree2.getRoot())
})

await test('diff: Equal trees have zero diff', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(2n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('c'))
  tree1.insert(4n, Buffer.from('d'))

  tree2.insert(1n, Buffer.from('a'))
  tree2.insert(2n, Buffer.from('b'))
  tree2.insert(3n, Buffer.from('c'))
  tree2.insert(4n, Buffer.from('d'))

  const diff = tree1.diff(tree2)

  assert.equal(diff.left.length, 0)
  assert.equal(diff.right.length, 0)
})

await test('diff: Equal trees have zero diff both ways', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(2n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('c'))
  tree1.insert(4n, Buffer.from('d'))

  tree2.insert(1n, Buffer.from('a'))
  tree2.insert(2n, Buffer.from('b'))
  tree2.insert(3n, Buffer.from('c'))
  tree2.insert(4n, Buffer.from('d'))

  const diff1 = tree1.diff(tree2)
  const diff2 = tree2.diff(tree1)

  assert.equal(diff1.left.length, 0)
  assert.equal(diff1.right.length, 0)
  assert.equal(diff2.left.length, 0)
  assert.equal(diff2.right.length, 0)
})

await test('diff: A tree has no diff against itself', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1n, Buffer.from('a'))
  tree.insert(2n, Buffer.from('b'))

  const diff = tree.diff(tree)

  assert.equal(diff.left.length, 0)
  assert.equal(diff.right.length, 0)
})

await test('diff: Right tree has one new node', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(4n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('b'))
  tree1.insert(5n, Buffer.from('b'))

  tree2.insert(1n, Buffer.from('a'))
  tree2.insert(4n, Buffer.from('b'))
  tree2.insert(3n, Buffer.from('b'))
  tree2.insert(5n, Buffer.from('b'))
  tree2.insert(2n, Buffer.from('b'))

  const { left, right } = tree1.diff(tree2)

  assert.equal(left.length, 0)
  assert.equal(right.length, 1)
  assert.equal(right[0][0], 2n)
  assert.deepEqual(right[0][1], Buffer.from('b'))
})

await test('diff: The same key is marked as a diff in both because the hash has changed', async (t) => {
  const tree1 = createTree(() => createHash('sha256'))
  const tree2 = createTree(() => createHash('sha256'))

  tree1.insert(1n, Buffer.from('a'))
  tree1.insert(4n, Buffer.from('b'))
  tree1.insert(3n, Buffer.from('b'))
  tree1.insert(5n, Buffer.from('b'))

  tree2.insert(1n, Buffer.from('a'))
  tree2.insert(4n, Buffer.from('b'))
  tree2.insert(3n, Buffer.from('b'))
  tree2.insert(5n, Buffer.from('c')) // hash changed

  const { left, right } = tree1.diff(tree2)

  assert.equal(left.length, 1)
  assert.equal(left[0][0], 5n)
  assert.deepEqual(left[0][1], Buffer.from('b'))

  assert.equal(right.length, 1)
  assert.equal(right[0][0], 5n)
  assert.deepEqual(right[0][1], Buffer.from('c'))
})

await test('proof: Prove that 3n is a member of the tree', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1n, Buffer.from('a'))
  tree.insert(4n, Buffer.from('b'))
  tree.insert(3n, Buffer.from('c'))
  tree.insert(5n, Buffer.from('d'))

  const proof = tree.membershipProof(3n)
  const rightHash = Buffer.from('XmV/9hWNPiptI+KlI5F6IwWs7pQjNl4mhpXEt7iRn0w=', 'base64')

  assert.equal(proof.length, 3)
  proof.forEach((el: typeof proof[0]) => assert.equal(Array.isArray(el) && el.length, 2))
  assert.deepEqual(proof[0], [Buffer.from('c'), 3n])
  assert.deepEqual(proof[1], [Buffer.from('a'), 'L'])
  assert.deepEqual(proof[2], [rightHash, 'R'])

  const leftHash = genNodeHash(Buffer.from('a'), Buffer.from('c'))
  const rootHash = genNodeHash(leftHash, rightHash)
  const root = tree.getRoot()

  assert.ok(root)
  assert.deepEqual(rootHash, root && root.hash)
})

await test('proof: Prove that 5n is a member of the tree (boundary)', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1n, Buffer.from('a'))
  tree.insert(4n, Buffer.from('b'))
  tree.insert(3n, Buffer.from('c'))
  tree.insert(5n, Buffer.from('d'))

  const proof = tree.membershipProof(5n)
  const leftHash = genNodeHash(Buffer.from('a'), Buffer.from('c'))

  assert.equal(proof.length, 3)
  proof.forEach((el: typeof proof[0]) => assert.equal(Array.isArray(el) && el.length, 2))
  assert.deepEqual(proof[0], [Buffer.from('d'), 5n])
  assert.deepEqual(proof[1], [Buffer.from('b'), 'L'])
  assert.deepEqual(proof[2], [leftHash, 'L'])

  const rightHash = genNodeHash(Buffer.from('b'), Buffer.from('d'))
  const rootHash = genNodeHash(leftHash, rightHash)
  const root = tree.getRoot()

  assert.ok(root)
  assert.deepEqual(rootHash, root && root.hash)
})

await test('proof: Show a proof that 6n is greater than the greatest key in the tree (5n)', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1n, Buffer.from('a'))
  tree.insert(3n, Buffer.from('b'))
  tree.insert(4n, Buffer.from('c'))
  tree.insert(5n, Buffer.from('d'))

  const proof = tree.membershipProof(6n)

  assert.equal(proof.length, 4)

  const [ d, c, ab, miss ] = proof

  assert.equal(Array.isArray(d) && d.length, 2)
  assert.deepEqual(d[0], Buffer.from('d'))
  assert.equal(d[1], 5n)

  assert.equal(Array.isArray(c) && c.length, 2)
  assert.deepEqual(c[0], Buffer.from('c'))
  assert.equal(c[1], 'L')

  assert.equal(Array.isArray(ab) && ab.length, 2)
  assert.deepEqual(ab[0], genNodeHash(Buffer.from('a'), Buffer.from('b')))
  assert.equal(ab[1], 'L')

  assert.ok(!miss)
})

await test('proof: Show a proof that 10n is greater than the greatest key in the tree (5n)', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(1n, Buffer.from('a'))
  tree.insert(3n, Buffer.from('b'))
  tree.insert(4n, Buffer.from('c'))
  tree.insert(5n, Buffer.from('d'))

  const proof = tree.membershipProof(10n)

  assert.equal(proof.length, 4)

  const [ d, c, ab, miss ] = proof

  assert.equal(Array.isArray(d) && d.length, 2)
  assert.deepEqual(d[0], Buffer.from('d'))
  assert.equal(d[1], 5n)

  assert.equal(Array.isArray(c) && c.length, 2)
  assert.deepEqual(c[0], Buffer.from('c'))
  assert.equal(c[1], 'L')

  assert.equal(Array.isArray(ab) && ab.length, 2)
  assert.deepEqual(ab[0], genNodeHash(Buffer.from('a'), Buffer.from('b')))
  assert.equal(ab[1], 'L')

  assert.ok(!miss)
})

await test('proof: Show a proof that 1n is smaller than the smallest key in the tree (2n)', async (t) => {
  const tree = createTree(() => createHash('sha256'))

  tree.insert(2n, Buffer.from('a'))
  tree.insert(3n, Buffer.from('b'))
  tree.insert(4n, Buffer.from('c'))
  tree.insert(5n, Buffer.from('d'))

  const proof = tree.membershipProof(1n)

  assert.equal(proof.length, 4)
  const expectedProof = [
    null,
    [ Buffer.from('a'), 2n ],
    [ Buffer.from('b'), 'R' ],
    [ genNodeHash(Buffer.from('c'), Buffer.from('d')), 'R' ]
  ]

  assert.deepEqual(proof, expectedProof)
})
