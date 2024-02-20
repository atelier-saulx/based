<!--
Copyright (c) 2022-2023 SAULX

SPDX-License-Identifier: MIT
-->
# Module: DB

## Hierarchy

Hierarchy is a graph data structure used for storing the hierarchical
relationships between the nodes in Selva. Hierarchy implements parent and child
constraints that have a very specific behavior when executing certain operations
on the hierarchy.

Hierarchy implements a number of different ways to traverse the graph utilizing
not only the family tree -like relationships but also other possible reference
and relationship types. The traversal methods can also filter out nodes from the
results by using [RPN Filter Expressions](expressions.md) with the traversal
methods, which can, most importantly, access the node fields and do comparison
and boolean operations against the fields.

## Selva Object

`SelvaObject` is a new data type for storing object-like data in
compute-efficient manner. In addition to in-memory storage it can
be also serialized and deserialized. The type can currently store strings,
integers, and doubles natively in the most efficient format for access and
computation.  Depending on the use case, the measured performance improvement
over Redis hash type is 20 % - 25 %. It can potentially offer even greater
performance improvement, compared to hashes, in use cases where the data
structure is accessed directly inside a Redis module.

`SelvaObject` stores the object keys in a rank-balanced tree. The key can
store small C-native data types as values directly and have a pointer
to the value for more complex or storage heavy types. The key itself
knows the data type of the value.

The `SelvaObject` data type is implemented in
[selva_object](../../../modules/db/module/selva_object/selva_object.c).

## Selva Node

A Selva node is a structure managed by the hierarchy system. A node
contains hard-coded hierarchy fields (`parents` and `children`),
a `SelvaObject` containing the data fields, edge fields, and other meta
data. Edge fields are actually handled as an external metadata to the
hierarchy system.

Hierarchy fields `ancestors`, `children`, `descendants`, and `parents` are
owned, managed, and traversed by the functions in
[hierarchy.c](../../../modules/db/module/hierarchy.c).

Node aliases (and `aliases` field) are handled by [alias.c](../../../modules/db/module/alias.c).

## Graph Link Types

The Selva C module supports a number ways to link or reference to other nodes in
the database.

### Parents/Children

The most important graph reference type in Selva is the parent/child
relationship. This relationship connects selva nodes together typically in
a tree manner but other topologies can be created by adjusting the
relationships.

This link type is fully managed and every edge must have an existing endpoint.
The relationship is always symmetric, if a node has a parent then it's also a
child to the parent. In addition to these constraints, in normal operation,
if a node or subtree is left orphan, it will be destroyed.

### Reference

Another way to point to other nodes is to create a reference field that
contains a set of nodeIds. These ids don't need to exist at the time of
adding to the set, but if they do the nodes will be visited when the field
is traversed.

This reference type is completely unmanaged and nothing will happen if a
referenced node is removed.

### Edge Field

Edge fields are customizable user defined edge types in the Selva C module.
An edge field is tied to a user defined edge constraint, that mandates the
behavior of the edges of the field on creation, traversals, and other database
operations. This is the reference type that makes Selva a true graph database.

These fields are managed according to the selected edge constraint, and
an edge can only exist if its endpoint exists.

Edge is the part that makes Selva a true graph database, as it allows making
graph connections between any nodes using customizable edge field names and
constraints.

The following drawing shows some examples of customized edge fields. From the
user's perspective all the graph fields can be treated almost the same way. The
difference comes from the constraints applied to each field. The hierarchical
fields `parents` and `children` have a set of hard-coded rules that are applied
to them, where as the constraints (or behavior) of the custom edge fields can
be selected when each field and its first edge is created.

```
        +--------------------+
        |  id = root         |<------+----------------------------+
        |                    |       |                            |
        | parents            |       |                            | 
        |           children +-----+---------------------+--------------------------+
  +---->|                    |     | |                   |        |                 |
  |     +--------------------+     | |                   |        |                 |
  |     |        {           |     | |                   |        |                 |
  |     |         my:        |     | |                   |        |                 |
  |     |           {        |     | |                   |        |                 |
  |     |             custom |     | |                   |        |                 |
  |     |           }        |     | |                   |        |                 |
  |     |         others     |     | |                   |        |                 |
  |     |        }           |     | |                   |        |                 |
  |     +--------------------+     | |                   |        |                 |
  |                                | |                   |        |                 |
  |                      +---------+ |                   |        |                 |
  |                      v           |                   v        |                 v
  |     +--------------------+       |   +--------------------+   |      +--------------------+
  |     |  id = atnode1      |       |   |  id = btnode2      |   |      |  id = atnode3      |
  |     |                    |       |   |                    |   |      |                    |
  +-----+ parents            |       +---+ parents            |   +------+ parents            |
        |           children |           |           children |          |           children |
        |                    |     +---->|                    |     +--->|                    |
        +--------------------+     |     +--------------------+     |    +--------------------+
        |       {            |     |     |     {              |     |    |        {           |
        |         my: {      |     |     |       my: {        |     |    |          my: {     |
        |           abc: []  |-----+     |         custom: [] |     |    |            abc: [] |
        |         }          |           |       }            |     |    |          }         |
        |         edges: []  |-----+     |       edges: []    |     |    |          edges: [] |
        |        }           |     |     |     }              |     |    |        }           |
        +--------------------+     |     +--------------------+     |    +--------------------+
                                   |                                |
                                   +--------------------------------+
```

## Subscriptions

A subscription is a collection of subscription markers. There are three basic
types of subscription markers. A regular marker is attached to a start node and
the nodes that follow it according to the rules of the traversal specified, and
the marker reacts to changes in the node's relationships or data.  A missing
accessor marker is a marker that is waiting for a node or an alias to appear
(to be created). Finally a trigger marker reacts to certain database events.

The reality with the markers is a bit more complex than what was just stated,
because the actual marker types can be mixed with matcher flags and action
functions can change the actual behavior. Some markers are also detached and
not directly attached to a node or nodeId, one example of such a maker is the
trigger marker.

When a regular node marker is created it's applied to the node it starts from and
it's applied to all the connected nodes following the edge constraint of the
specified field or relation. For example a marker could start from `ma0002` and
it could be applied to all the descendants of the node.

A marker will trigger an event on behalf of the subscription if a conjunction of
the given conditions become truthy in certain situations. This could happen when
a field of one of the nodes is changed, a new node matching the marker conditions
is added in the graph, etc.

A Trigger marker will trigger an event based on its trigger type and conditions.

## Indexing

Traversals over the hierarchy can be long and complex and additional RPN
expression filtering can make it slow. Often subscriptions require a new
traversal to be executed every time something changes in the subscription.
To help speeding up the most complex and frequent traversals, there is a
built-in indexing support, that can be utilized by providing indexing hints
when executing a find query. For efficient indexing, an indexing hint should
form a proper super set of the normal find query result.

The indexing system in Selva is completely automatic from the user's point of
view. The Selva client and server determine together in cooperation which
queries or subqueries should be indexed for the best performance gain, and
on in turn, which queries shouldn't be indexed.

The indexing procedure starts when the client breaks down the AST of a get query
filter into smaller subqueries that form super sets of the assumed end result of
the original query. These subquery filters are called hints. Together the filter
and the traversal direction parameters form an indexing query. The hints are
passed to the server along with the query parameters.

An index in Selva is essentially a subscription and a `SelvaSet` of nodeIds. 
The indexing system utilizes a single subscription which contains markers for
each actual index. Like any subscription marker, an index subscription marker
starts from a single node in the hierarchy and executes a selective RPN filter
expression on each node it visits during the traversal. Every node that passes
the expression filter is added to the resulting SelvaSet.

The subscription markers are created as callback markers, which will call
`update_index()` callback every time something hitting the marker changes. This
keeps the index result sets up-to-date most of the time, although on some
occasions the result set must be rebuilt and during those times the index is
unusable.

The indexing result sets can be used by find queries to speed up finding the
result of the query. A find query may include an optional indexing hint
filter (see [RPN expression](expressions.md)) that can be used to form an
index. The hints are cached in a `SelvaObject` and the ones that are seen
frequently are turned into an actual indexing entry with a result set.

Formally, the index is a map from the tuple
`(node_id, direction[, dir_expression], indexing_clause)` to a set of
hierarchy nodeIds.

When a previously unseen indexing hint is observed a new `IndexControlBlock` or
`icb` is created. If further on the same hint is seen often enough a new index
is created. Once the new index is in `valid` state, the find command can use the
new index result set as a starting point for building the result of the find
query, instead of traversing the hierarchy to find the relevant nodes. This will
work as long as the index result set is a super set of what would normally be
the result set of the find query when no indexing is used.

The `IndexControlBlock` structure has a number of state flags which are needed
to determine whether the indexing mechanism is active and the result set is
valid.

| State flag            | Description                                                                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `is_valid_marked_id`  | A subscription marker id is reserved for this `icb` but it's not necessary in use yet (in the subscription).                                                  |
| `is_valid_timer_id`   | There is a timer running for state updates. (Generally this is always happening when there is an `icb` for a hint.)                                           |
| `unsigned is_active`  | Indexing is active. The index res set is actively being updated although res can be invalid from time to time, meaning that the index is currently invalid.   |
| `is_valid`            | The result set is valid, i.e. contains all the nodeIds that should be there and the result can be used by the find command.                                   |

### Testing

The [indexing performance test](/test/perf/indexing.ts) will create a CSV file
in the [client directory](/client) when executed. This CSV can be used to
further analyze the time complexity of the indexing subsystem as the data set
and index size grows.

Naturally, it's also possible to attach [Intel VTune](/doc/debugging.md#intel-vtune)
to the `selvad` process while the test is running and gather even more performance
data. The only thing to keep in mind is that the test will run three `selvad`
processes which of only one is processing the data, the `origin` process.

## Hierarchy Serialization

Hierarchy trees are serialized starting from each head towards descendants using
DFS algorithm.

The format is as follows: A nodeId is written first, then the number of children
that node has, and finally list the ID of each child. Then the algorithm
proceeds to the next node according to DFS algorithm. Finally once all nodes
of the whole hierarchy have been visited, a special id `HIERARCHY_RDB_EOF` (0)
is written marking the end of the serialized hierarchy.

The final serialization result looks like this:

```
NODE_ID1 | NODE_METADATA | NR_CHILDREN | CHILD_ID_0,..
NODE_ID2 | NODE_METADATA | NR_CHILDREN | ...
HIERARCHY_RDB_EOF
```

Deserialization is practically a reverse operation of what the serialization
algorithm does. A nodeId is read first but it's kept in memory for now. Then the
number of children is read, which tells how many values to read as child IDs.
The children are created first, one by one. Finally once all the child nodes
have been created the parent node itself can be created and marked as a parent
to the new children. The algorithm is repeated until `HIERARCHY_RDB_EOF` is
reached.

## Commands

### Find Commands

See

- [find.c](../../../modules/db/module/find.c),
- [aggregate.c](../../../modules/db/module/aggregate.c),
- [inherit.c](../../../modules/db/module/inherit.c).

### Hierarchy Commands

Direct hierarchy manipulation.

See [hierarchy.c](../../../modules/db/module/hierarchy.c).

### Subscription Commands

See [subscriptions.c](../../../modules/db/module/subscriptions.c).

### Modify

Create or update Selva nodes.

See [modify.c](../../../modules/db/module/modify.c).

### Selva Objects

Direct SelvaObject manipulation.

See [selva_object](../../../modules/db/module/selva_object.c).
