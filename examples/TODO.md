# DECISIONS

- [x] edge values are both ways
- [x] expose and, or also on top level
- [x] call order for filter
- [x] 1 edge max
- [x] add required: boolean on edge as well (validation)
- [x] use properties vs fields
- [x] bidirectional is only to single field (eg admin => adminOf)
- [x] no arrays in filter
- [x] bidirectional => inverseProperty
- [x] always have properties on edges? (no primitives)
- [x] sort is default asc, (you can also define in schema, and opts)
- [x] multi-level sort (eg sort by year and withn that sort by rating)
- [x] we always return all by default (exclude references)
- [x] select by aliasfield/id 'user[email:beerdejim@gmail.com]'
- [x] edge is a reserved key (eg @roles in query / 'edge' prop in response)

# PROPOSAL

# QUESTIONS

- [ ] TODO what do we do for iteration variables? (authorize.ts:81)
- [ ] How do we SYNC CREATE new nodes when writing to multiple origins? (sync the count for ID?)

# TODO

- [ ] Aliases
- [ ] Batch update by query
- [ ] Language
- [ ] Remove/delete
- [ ] Update edge
- [ ] Handle deletes/orphans => maybe add "dependant"/"noOrphan" field in schema?
- [ ] Do we need type?
- [ ] Make aliases custom field?
- [ ] Handle upsert/insert/update etc operations
- [ ] Bulk modify/create commands
- [ ] Conditions
