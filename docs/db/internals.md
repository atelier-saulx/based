# Internals

## Memory Model

```mermaid
block-beta
  columns 2
  block:DB:1
    columns 1
    r["db"]
  end
  block:TYPES:1
  columns 2
  t1["type1"]
  r-->t1
  block:T1:1
    t1-->t1n1["1"]
    t1n2["2"]
    t1n3["3"]
  end
  t2["type2"]
  r-->t2
  block:T2:1
    t2-->t2n1["1"]
    t2n2["2"]
    t2n3["3"]
  end
  t3["type3"]
  r-->t3
  block:T3:1
    t3-->t3b1["1"]
    t3n40["40"]
    block
        space
    end
  end
  end
  style DB stroke:#f66,fill:#ffffff,stroke-width:3
  style TYPES stroke:#f66,fill:#ffffff,stroke-width:3
  style T1 stroke:#f66,fill:#fffff0,stroke-width:2
  style T2 stroke:#f66,fill:#fffff0,stroke-width:2
  style T3 stroke:#f66,fill:#fffff0,stroke-width:2
```

Each type (type1, type2, type2) has its own `mempool` that is used to allocate
nodes within that type. The nodes are normally allocated consecutively in
memory but deletions and new insertions may break that notion, as the `mempool`
system tries to keep all the allocations together for memory efficiency and
performance.

The nodes of each type are then linked together within in the type using a
rank-balanced tree. This is necessary because the nodes are not always in-order
in memory.

## Backups

### VerifTree

```mermaid
block-beta
  columns 2
  block:ROOT:1
    columns 1
    r["root<br/>hash: h(h(t1) + h(t2) + h(t3)"]
  end
  block:TYPES:1
  columns 2
  t1["type1<br/>hash: h(h(b1)+h(b2)+h(b3))"]
  r-->t1
  block:T1:1
    t1-->t1b1["b1"]
    t1b2["b2"]
    t1b3["b3"]
  end
  t2["type2<br/>hash: h(h(b1)+h(b2)+h(b3))"]
  r-->t2
  block:T2:1
    t2-->t2b1["b1"]
    t2b2["b2"]
    t2b3["b3"]
  end
  t3["type3<br/>hash: h(h(b1)+h(b3))"]
  r-->t3
  block:T3:1
    t3-->t3b1["b1"] 
    block
      space
    end
    t3b3["b3"]
  end
  end
  style ROOT fill:#0000,stroke-width:0
  style TYPES fill:#0000,stroke-width:0
```
