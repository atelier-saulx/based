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

# PROPOSAL

- [ ] always have properties on edges (no primitives)

# QUESTIONS

- [ ] should we return ALL by default or only ID?
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
- [ ] Batch modify/create commands
