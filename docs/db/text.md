# String and Text Fields

A string field can contain a single UTF-8 string of either unlimited length or
fixed length. A Text field can contain an UTF-8 string translations of the same
text in any supported language.

```js
await db.setSchema({
  types: {
    user: {
      props: {
        name: { type: 'string' },
        email: { type: 'string', max: 15 },
        age: 'uint32',
        bio: { type: 'text' },
      },
    },
  },
})
```

## Storage Format

### Normalization

String and text fields use [NFKD normalization](https://unicode.org/reports/tr15/),
which helps the database to implement extremely fast text search.
However, the normalization may cause some loss of information in certain cases
due to its irreversible nature and in rare cases the meaning of the string may
change.

**Example**

```js
const buf1 = Buffer.from('ÅﬃⅨ'.normalize('NFKD'), 'utf-8')
const buf2 = Buffer.from('ÅﬃⅨ', 'utf-8')
console.log(buf1)
console.log(buf1.toString())
console.log(buf2)
console.log(buf2.toString())
```

Prints:

```
<Buffer 41 cc 8a 66 66 69 49 58>
ÅffiIX
<Buffer c3 85 ef ac 83 e2 85 a8>
ÅﬃⅨ
```

In some cases the user might want to store string in a non-lossy manner.
Currently this can be achieved by storing the string(s) in a `binary` field.

### In-memory

Internally every string in the database is stored as follows:

```mermaid
%%{init: { 'packet': {'bitWidth': 20, 'bitsPerRow': 64} } }%%
packet-beta
title String/Text
0-7: "Lang (none=0)"
8-15: "Comp"
16-59: "Data (variable length)"
60-63: "CRC32C"
```
where

| Comp | Description    |
| ---- | -------------- |
| 0    | No compression |
| 1    | Raw deflate    |

**Comp=1**

```mermaid
%%{init: { 'packet': {'bitWidth': 20, 'bitsPerRow': 64} } }%%
packet-beta
title String/Text
0-7: "Lang (none=0)"
8-15: "1"
16-47: "Uncompressed size"
48-123: "Deflated data (variable length)"
124-127: "CRC32C"
```

In the compressed case the CRC32C value is calculated over the uncompressed data.
It's done like this to protect the data from both, errors while stored in compressed
format as well as decompression errors. Moreover, a slight change in the compressed
data may affect multiple bits in the decompression output and thus more easily result
a CRC32C value that is correvt, even if the output is not correct. The downside is
that the deflate decompression code must be more robust against bit errors.

## String Search

- TODO Describe how the search works at high level
- TODO Query examples

## External Links

- [Unicode Normalization Forms, Unicode® Standard Annex #15](https://unicode.org/reports/tr15/)
- [DerivedNormalizationProps-16.0.0.txt, Unicode®](https://www.unicode.org/Public/UCD/latest/ucd/DerivedNormalizationProps.txt)
- [Unicode equivalence, Wikipedia](https://en.wikipedia.org/wiki/Unicode_equivalence)
