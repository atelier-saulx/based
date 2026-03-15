const std = @import("std");
const napi = @import("../napi.zig");
const selva = @import("../selva/selva.zig");
const Schema = @import("../selva/schema.zig");
const Node = @import("../selva/node.zig");
const Fields = @import("../selva/fields.zig");
const References = @import("../selva/references.zig");
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const subs = @import("subscription.zig");
const Sort = @import("../sort/sort.zig");
const sort = @import("./sort.zig");

pub const subscription = subs.subscription;
const resItemSize = utils.sizeOf(t.ModifyResultItem);
inline fn applyInc(comptime T: type, current: []u8, value: []u8, start: u16, incrementPositive: bool) void {
    const curr = utils.read(T, current, start);
    const inc = utils.read(T, value, 0);
    if (incrementPositive) {
        const res = if (@typeInfo(T) == .float) curr + inc else curr +% inc;
        utils.write(value, res, 0);
    } else {
        const res = if (@typeInfo(T) == .float) curr - inc else curr -% inc;
        utils.write(value, res, 0);
    }
}

inline fn writeResult(res: *t.ModifyResultItem, id: u32, err: t.ModifyError) void {
    const ptr = @as([*]u8, @ptrCast(res));
    utils.write(ptr[0..4], id, 0);
    ptr[4] = @intFromEnum(err);
}

//  ----------NAPI-------------
pub fn modifyThread(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    modifyInternalThread(
        env,
        info,
    ) catch undefined;
    return null;
}

fn modifyInternalThread(env: napi.Env, info: napi.Info) !void {
    const args = try napi.getArgs(2, env, info);
    const batch = try napi.get([]u8, env, args[0]);
    const dbCtx = try napi.get(*DbCtx, env, args[1]);
    try dbCtx.threads.modify(batch);
}

fn modifyProps(db: *DbCtx, typeEntry: Node.Type, node: Node.Node, data: []u8, items: []u8, typeSort: ?*Sort.TypeIndex) anyerror!void {
    if (typeSort) |ts| {
        try modifyPropsInner(true, db, typeEntry, node, data, items, ts);
    } else {
        try modifyPropsInner(false, db, typeEntry, node, data, items, undefined);
    }
}

inline fn modifyPropsInner(comptime updateSort: bool, db: *DbCtx, typeEntry: Node.Type, node: Node.Node, data: []u8, items: []u8, typeSort: *Sort.TypeIndex) anyerror!void {
    selva.markDirty(db, typeEntry, Node.getNodeId(node));

    var j: usize = 0;
    while (j < data.len) {
        const propId = data[j];
        const propSchema = try Schema.getFieldSchema(typeEntry, propId);
        if (propId == 0) {
            const main = utils.readNext(t.ModifyMainHeader, data, &j);
            const current = Fields.get(typeEntry, node, propSchema, t.PropType.microBuffer);
            const value = data[j .. j + main.size];
            j += main.size;

            if (main.increment) {
                switch (main.type) {
                    .number => applyInc(f64, current, value, main.start, main.incrementPositive),
                    .timestamp => applyInc(i64, current, value, main.start, main.incrementPositive),
                    .int8, .uint8 => applyInc(u8, current, value, main.start, main.incrementPositive),
                    .int16, .uint16 => applyInc(u16, current, value, main.start, main.incrementPositive),
                    .int32, .uint32 => applyInc(u32, current, value, main.start, main.incrementPositive),
                    else => {},
                }
            }

            if (main.expire and main.size == 8) {
                const typeId = Node.getNodeTypeId(node);
                const id = Node.getNodeId(node);
                Node.expireNode(db, typeId, id, @divTrunc(utils.read(i64, value, 0), 1000));
            }

            if (updateSort) {
                if (typeSort.main.get(main.start)) |ms| {
                    const currentValue = current[main.start .. main.start + main.size];
                    const same = std.mem.eql(u8, currentValue, value);
                    if (same == false) {
                        Sort.remove(db.decompressor, ms, current, node);
                        utils.copy(u8, current, value, main.start);
                        Sort.insert(db.decompressor, ms, current, node);
                        continue;
                    }
                }
            }
            if (main.resetDefault) {
                Fields.resetSmb(typeEntry, node, propSchema, main.start, main.size);
                // TODO Shouldn't maybe modify the data?
            } else {
                utils.copy(u8, current, value, main.start);
            }
        } else {
            const prop = utils.readNext(t.ModifyPropHeader, data, &j);
            const value = data[j .. j + prop.size];
            j += prop.size;
            switch (prop.type) {
                .stringLocalized, .jsonLocalized => {
                    if (prop.size == 0) {
                        // TODO Set defaults per translation
                        const langs: [1]u8 = .{0};
                        Fields.resetText(db, typeEntry, node, propSchema, &langs);
                        continue;
                    }
                    var k: usize = 0;
                    while (k < value.len) {
                        const textSize = utils.read(u32, value, k);
                        k += 4;
                        const textValue = value[k .. k + textSize];
                        k += textSize;
                        try Fields.setText(node, propSchema, textValue);
                    }
                },
                .alias => {
                    const id = Node.getNodeId(node);
                    if (prop.size == 0) {
                        if (updateSort) {
                            if (Sort.getSortIndex(typeSort, prop.id, 0, t.LangCode.none)) |propSort| {
                                const current = Fields.get(typeEntry, node, propSchema, prop.type);
                                Sort.remove(db.decompressor, propSort, current, node);
                                Sort.insert(db.decompressor, propSort, value, node);
                            }
                        }
                        try Fields.delAlias(typeEntry, id, prop.id);
                        continue;
                    }

                    if (updateSort) {
                        if (Sort.getSortIndex(typeSort, prop.id, 0, t.LangCode.none)) |propSort| {
                            const current = Fields.get(typeEntry, node, propSchema, prop.type);
                            Sort.remove(db.decompressor, propSort, current, node);
                            Sort.insert(db.decompressor, propSort, value, node);
                            const prevAliasedId = try Fields.setAlias(typeEntry, id, prop.id, value);
                            if (prevAliasedId > 0) {
                                if (Node.getNode(typeEntry, prevAliasedId)) |prevAliasedNode| {
                                    Sort.remove(db.decompressor, propSort, value, prevAliasedNode);
                                    Sort.insert(db.decompressor, propSort, Sort.EMPTY_SLICE, prevAliasedNode);
                                }
                            }
                            continue;
                        }
                    }
                    const prevAliasedId = try Fields.setAlias(typeEntry, id, prop.id, value);
                    if (prevAliasedId > 0) {
                        // TODO we can remove this when we have selva_sort_replace_buf
                        const typeId = selva.c.selva_get_type(typeEntry);
                        if (Sort.getTypeSortIndexes(db, typeId)) |ts| {
                            if (Sort.getSortIndex(ts, prop.id, 0, t.LangCode.none)) |propSort| {
                                if (Node.getNode(typeEntry, prevAliasedId)) |prevAliasedNode| {
                                    Sort.remove(db.decompressor, propSort, value, prevAliasedNode);
                                    Sort.insert(db.decompressor, propSort, Sort.EMPTY_SLICE, prevAliasedNode);
                                }
                            }
                        }
                    }
                },
                .cardinality => {
                    if (prop.size == 0) {
                        if (updateSort) {
                            if (Sort.getSortIndex(typeSort, prop.id, 0, t.LangCode.none)) |propSort| {
                                if (selva.c.selva_fields_get_selva_string(node, propSchema)) |hll| {
                                    const count = selva.c.hll_count(hll)[0..4];
                                    Sort.remove(db.decompressor, propSort, count, node);
                                    Sort.insert(db.decompressor, propSort, Sort.EMPTY_SLICE, node);
                                }
                            }
                        }
                        Fields.reset(db, typeEntry, node, propSchema);
                        continue;
                    }
                    var k: usize = 0;
                    const cardinality = utils.readNext(t.ModifyCardinalityHeader, value, &k);
                    var hll = selva.c.selva_fields_get_selva_string(node, propSchema);
                    if (hll == null) { // TODO check if this is null after delete!
                        hll = try Fields.ensurePropTypeString(node, propSchema);
                        selva.c.hll_init(hll, cardinality.precision, cardinality.sparse);
                    }

                    if (updateSort) {
                        if (Sort.getSortIndex(typeSort, prop.id, 0, t.LangCode.none)) |propSort| {
                            Sort.remove(db.decompressor, propSort, selva.c.hll_count(hll)[0..4], node);
                            while (k < value.len) {
                                const hash = utils.read(u64, value, k);
                                selva.c.hll_add(hll, hash);
                                k += 8;
                            }
                            Sort.insert(db.decompressor, propSort, selva.c.hll_count(hll)[0..4], node);
                            continue;
                        }
                    }

                    while (k < value.len) {
                        const hash = utils.read(u64, value, k);
                        selva.c.hll_add(hll, hash);
                        k += 8;
                    }
                },
                .reference => {
                    if (prop.size == 0) {
                        Fields.reset(db, typeEntry, node, propSchema);
                        continue;
                    }
                    const refTypeId = Schema.getRefTypeIdFromFieldSchema(propSchema);
                    const refTypeEntry = try Node.getType(db, refTypeId);
                    var k: usize = 0;
                    const meta = utils.readNext(t.ModifyReferenceMetaHeader, value, &k);
                    var refId = meta.id;
                    if (meta.isTmp) refId = utils.read(u32, items, refId * resItemSize);
                    if (Node.getNode(refTypeEntry, refId)) |dst| {
                        const ref = try References.writeReference(db, node, propSchema, dst);
                        if (meta.size != 0) {
                            if (ref) |r| {
                                const edgeProps = value[k .. k + meta.size];
                                const edgeConstraint = Schema.getEdgeFieldConstraint(propSchema);
                                const edgeType = try Node.getType(db, edgeConstraint.edge_node_type);
                                if (Node.getEdgeNode(db, edgeConstraint, r)) |edgeNode| {
                                    try modifyProps(db, edgeType, edgeNode, edgeProps, items, null);
                                } // TODO else error?
                            }
                        }
                    }
                },
                .references => {
                    if (prop.size == 0) {
                        Fields.reset(db, typeEntry, node, propSchema);
                        continue;
                    }
                    var k: usize = 0;
                    if (@as(t.ModifyReferences, @enumFromInt(value[0])) == t.ModifyReferences.clear) {
                        References.clearReferences(db, node, propSchema);
                        k += 1;
                    }
                    while (k < value.len) {
                        const references = utils.readNext(t.ModifyReferencesHeader, value, &k);
                        const refs = value[k .. k + references.size];
                        switch (references.op) {
                            .ids => {
                                const offset = utils.alignLeft(u32, refs);
                                const u32Ids = utils.read([]u32, refs[4 - offset .. refs.len - offset], 0);
                                try References.putReferences(db, node, propSchema, u32Ids);
                            },
                            .tmpIds => {
                                const offset = utils.alignLeft(u32, refs);
                                const u32Ids = utils.read([]u32, refs[4 - offset .. refs.len - offset], 0);
                                for (u32Ids) |*id| id.* = utils.read(u32, items, id.* * resItemSize);
                                try References.putReferences(db, node, propSchema, u32Ids);
                            },
                            .idsWithMeta => {
                                const refTypeId = Schema.getRefTypeIdFromFieldSchema(propSchema);
                                const refTypeEntry = try Node.getType(db, refTypeId);
                                const edgeConstraint = Schema.getEdgeFieldConstraint(propSchema);
                                const count = utils.read(u32, refs, 0);
                                var x: usize = 4;
                                References.preallocReferences2(db, node, propSchema, count);
                                while (x < refs.len) {
                                    const meta = utils.readNext(t.ModifyReferencesMetaHeader, refs, &x);
                                    var refId = meta.id;
                                    if (meta.isTmp) refId = utils.read(u32, items, refId * resItemSize);
                                    if (Node.getNode(refTypeEntry, refId)) |dst| {
                                        const ref = try References.insertReference(db, node, propSchema, dst, meta.index, meta.withIndex);
                                        if (meta.size != 0) {
                                            const edgeProps = refs[x .. x + meta.size];
                                            if (Node.getEdgeNode(db, edgeConstraint, ref.p.large)) |edgeNode| {
                                                const edgeType = try Node.getType(db, edgeConstraint.edge_node_type);
                                                try modifyProps(db, edgeType, edgeNode, edgeProps, items, null);
                                            } // TODO else err?
                                        }
                                    }

                                    x += meta.size;
                                }
                            },
                            .delIds => {
                                const offset = utils.alignLeft(u32, refs);
                                const u32Ids = utils.read([]u32, refs[4 - offset .. refs.len - offset], 0);
                                for (u32Ids) |id| try References.deleteReference(db, node, propSchema, id);
                            },
                            .delTmpIds => {
                                const offset = utils.alignLeft(u32, refs);
                                const u32Ids = utils.read([]u32, refs[4 - offset .. refs.len - offset], 0);
                                for (u32Ids) |*id| {
                                    const realId = utils.read(u32, items, id.* * resItemSize);
                                    try References.deleteReference(db, node, propSchema, realId);
                                }
                            },
                            else => {},
                        }

                        k += references.size;
                    }
                },
                .colVec => {
                    if (prop.size == 0) {
                        Fields.clearColvec(typeEntry, node, propSchema);
                        continue;
                    }
                    Fields.setColvec(typeEntry, node, propSchema, value);
                },
                else => {
                    if (updateSort) {
                        if (Sort.getSortIndex(typeSort, prop.id, 0, t.LangCode.none)) |propSort| {
                            const current = Fields.get(typeEntry, node, propSchema, prop.type);
                            Sort.remove(db.decompressor, propSort, current, node);
                            Sort.insert(db.decompressor, propSort, value, node);
                        }
                    }

                    if (prop.size == 0) {
                        Fields.reset(db, typeEntry, node, propSchema);
                    } else {
                        try Fields.set(node, propSchema, value);
                    }
                },
            }
        }
    }
}

const UpsertResult = struct {
    node: Node.Node,
    created: bool,
};

inline fn upsertTarget(db: *DbCtx, typeId: u16, typeEntry: Node.Type, data: []u8) !UpsertResult {
    var j: usize = 0;
    while (j < data.len) {
        const prop = utils.readNext(t.ModifyPropHeader, data, &j);
        const value = data[j .. j + prop.size];
        if (prop.type == t.PropType.alias) {
            if (Fields.getAliasByName(typeEntry, prop.id, value)) |node| {
                return .{ .node = node, .created = false };
            }
        }
        j += prop.size;
    }
    const id = db.ids[typeId - 1] + 1;
    const node = try Node.upsertNode(typeEntry, id);
    db.ids[typeId - 1] = id;
    return .{ .node = node, .created = true };
}

pub fn modify(
    thread: *Thread.Thread,
    buf: []u8,
    db: *DbCtx,
) !void {
    var i: usize = 0;
    var j: u32 = 4;
    const header = utils.readNext(t.ModifyHeader, buf, &i);
    const size = header.count * resItemSize;
    const result = try thread.modify.result(j + size, header.opId, header.opType);
    const items = result[j..];
    while (i < buf.len) {
        const op: t.Modify = @enumFromInt(buf[i]);
        switch (op) {
            .create => {
                const create = utils.read(t.ModifyCreateHeader, buf, i);
                i += utils.sizeOf(t.ModifyCreateHeader);
                const typeEntry = try Node.getType(db, create.type);
                const data: []u8 = buf[i .. i + create.size];
                const id = db.ids[create.type - 1] + 1;
                const node = try Node.upsertNode(typeEntry, id);
                modifyProps(db, typeEntry, node, data, items, null) catch {
                    // handle errors
                };
                sort.createSort(db, create.type, typeEntry, node) catch {
                    // handle sort errors
                };
                db.ids[create.type - 1] = id;
                utils.write(result, id, j);
                utils.write(result, t.ModifyError.null, j + 4);
                i += create.size;
            },
            .createRing => {
                const create = utils.read(t.ModifyCreateRingHeader, buf, i);
                i += utils.sizeOf(t.ModifyCreateRingHeader);
                const typeEntry = try Node.getType(db, create.type);
                const data: []u8 = buf[i .. i + create.size];
                const nextId = db.ids[create.type - 1] % create.maxNodeId + 1;
                var node = Node.getNode(typeEntry, nextId);
                if (node) |oldNode| {
                    sort.deleteSort(db, create.type, typeEntry, oldNode) catch {
                        // handle sort errors
                    };
                    Node.flushNode(db, typeEntry, oldNode);
                } else {
                    node = try Node.upsertNode(typeEntry, nextId);
                }
                modifyProps(db, typeEntry, node.?, data, items, null) catch {
                    // handle errors
                };
                sort.createSort(db, create.type, typeEntry, node.?) catch {
                    // handle sort errors
                };
                db.ids[create.type - 1] = nextId;
                utils.write(result, nextId, j);
                utils.write(result, t.ModifyError.null, j + 4);
                i += create.size;
            },
            .update => {
                const update = utils.read(t.ModifyUpdateHeader, buf, i);
                i += utils.sizeOf(t.ModifyUpdateHeader);
                const typeEntry = try Node.getType(db, update.type);
                var id = update.id;
                if (update.isTmp) id = utils.read(u32, items, id * resItemSize);
                if (Node.getNode(typeEntry, id)) |node| {
                    const typeSort = Sort.getTypeSortIndexes(db, update.type);
                    const data: []u8 = buf[i .. i + update.size];
                    modifyProps(db, typeEntry, node, data, items, typeSort) catch {
                        // handle errors
                    };
                    utils.write(result, id, j);
                    utils.write(result, t.ModifyError.null, j + 4);
                } else {
                    utils.write(result, id, j);
                    utils.write(result, t.ModifyError.nx, j + 4);
                }
                i += update.size;
            },
            .upsert => {
                const upsert = utils.read(t.ModifyCreateHeader, buf, i);
                i += utils.sizeOf(t.ModifyCreateHeader);
                const target = buf[i .. i + upsert.size];
                i += upsert.size;
                const typeEntry = try Node.getType(db, upsert.type);
                const upsertRes = try upsertTarget(db, upsert.type, typeEntry, target);

                const dataSize = utils.read(u32, buf, i);
                i += 4;
                const data = buf[i .. i + dataSize];
                if (upsertRes.created) {
                    modifyProps(db, typeEntry, upsertRes.node, target, items, null) catch {
                        // handle errors
                    };
                    modifyProps(db, typeEntry, upsertRes.node, data, items, null) catch {
                        // handle errors
                    };
                    sort.createSort(db, upsert.type, typeEntry, upsertRes.node) catch {
                        // handle sort errors
                    };
                } else {
                    const typeSort = Sort.getTypeSortIndexes(db, upsert.type);
                    modifyProps(db, typeEntry, upsertRes.node, data, items, typeSort) catch {
                        // handle errors
                    };
                }
                const id = Node.getNodeId(upsertRes.node);
                utils.write(result, id, j);
                utils.write(result, t.ModifyError.null, j + 4);
                i += dataSize;
            },
            .insert => {
                const insert = utils.read(t.ModifyCreateHeader, buf, i);
                i += utils.sizeOf(t.ModifyCreateHeader);
                const target = buf[i .. i + insert.size];
                i += insert.size;
                const typeEntry = try Node.getType(db, insert.type);
                const upsertRes = try upsertTarget(db, insert.type, typeEntry, target);
                const dataSize = utils.read(u32, buf, i);
                const id = Node.getNodeId(upsertRes.node);
                i += 4;
                if (upsertRes.created) {
                    modifyProps(db, typeEntry, upsertRes.node, target, items, null) catch {
                        // handle errors
                    };
                    modifyProps(db, typeEntry, upsertRes.node, buf[i .. i + dataSize], items, null) catch {
                        // handle errors
                    };
                    sort.createSort(db, insert.type, typeEntry, upsertRes.node) catch {
                        // handle sort errors
                    };
                }
                utils.write(result, id, j);
                utils.write(result, t.ModifyError.null, j + 4);
                i += dataSize;
            },
            .delete => {
                const delete = utils.read(t.ModifyDeleteHeader, buf, i);
                i += utils.sizeOf(t.ModifyDeleteHeader);
                const typeEntry = try Node.getType(db, delete.type);
                var id = delete.id;
                if (delete.isTmp) id = utils.read(u32, items, id * resItemSize);
                utils.write(result, id, j);
                utils.write(result, t.ModifyError.null, j + 4);
                if (Node.getNode(typeEntry, id)) |node| {
                    sort.deleteSort(db, delete.type, typeEntry, node) catch {
                        // handle sort errors
                    };
                    Node.deleteNode(db, typeEntry, node) catch {
                        // handle errors
                    };
                }
            },
        }
        j += resItemSize;
    }

    // TODO remove this (after we verify how dependent is handled)
    expire(db) catch {};
    utils.write(result, j, 0);
    if (j < size) @memset(result[j..size], 0);
}

pub inline fn expire(db: *DbCtx) !void {
    // TODO partials
    while (true) {
        const res = Node.expirePop(db);
        if (res.id == 0) break;
        const typeEntry = try Node.getType(db, res.type);
        if (Node.getNode(typeEntry, res.id)) |node| {
            Node.deleteNode(db, typeEntry, node) catch {};
        }
    }
}
