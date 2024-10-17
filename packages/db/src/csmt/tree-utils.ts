import { TreeNode } from './types.js';

export function distance(x: bigint, y: bigint): bigint {
	let v = x ^ y;
	let r = 0n;

	while ((v >>= 1n)) {
		r++;
	}

	return r;
}

export function min(x: TreeNode | null, y: TreeNode | null) {
	const a = (x && x.key) || 0n;
	const b = (y && y.key) || 0n;

	return a < b ? a : b;
}

export function max(x: TreeNode | null, y: TreeNode | null) {
	const a = (x && x.key) || 0n;
	const b = (y && y.key) || 0n;

	return a > b ? a : b;
}

// Find min key in a subtree.
export function minInSubtree(node: TreeNode): bigint {
	if (!node.left) {
		// We assume that the tree is always full and the last left node we can
		// find is the min.
		return node.key;
	}

	return minInSubtree(node.left);
}

// Find max key in a subtree.
export function maxInSubtree(node: TreeNode): bigint {
	return node.key;
}
