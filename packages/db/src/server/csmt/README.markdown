Compact Sparse Merkle Tree
==========================

This is a merkle tree implementation loosely based on the
[paper](https://eprint.iacr.org/2018/955.pdf) authored by
Faraz Haider describing the Compact Sparse Merkle Tree.

Usage
-----

```js
const { createHash } = require('crypto');
const { createTree } = require('./lib/index');

const tree = createTree(() => createHash('sha256'));
const ENCODER = new TextEncoder();

tree.insert(1n, ENCODER.encode('a'));
tree.insert(2n, ENCODER.encode('a'));
tree.insert(3n, ENCODER.encode('a'));
tree.insert(4n, ENCODER.encode('b'));
tree.insert(5n, ENCODER.encode('b'));
```

Results a tree like this:

```dot
graph ethane {
    a [label="5"];
    b [label="3"];
    c [label="1" shape=box];
    d [label="3"];
    e [label="2" shape=box];
    f [label="3" shape=box];
    g [label="5"];
    h [label="4" shape=box];
    i [label="5" shape=box];
    a -- b;
    b -- c;
    b -- d;
    d -- e;
    d -- f;
    a -- g;
    g -- h;
    g -- i;
}
```
