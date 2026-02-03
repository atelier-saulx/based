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

pub const subscription = subs.suscription;
const resItemSize = utils.sizeOf(t.ModifyResultItem);
inline fn applyInc(comptime T: type, current: []u8, value: []u8, start: u16, op: t.ModifyIncrement) void {
    const curr = utils.read(T, current, start);
    const inc = utils.read(T, value, 0);
    const res = switch (op) {
        .increment => if (@typeInfo(T) == .float) curr + inc else curr +% inc,
        .decrement => if (@typeInfo(T) == .float) curr - inc else curr -% inc,
        else => return,
    };
    utils.write(value, res, 0);
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

pub fn modifyProps(db: *DbCtx, typeEntry: Node.Type, node: Node.Node, data: []u8, items: []u8) !void {
    var j: usize = 0;
    while (j < data.len) {
        const propId = data[j];
        const propSchema = try Schema.getFieldSchema(typeEntry, propId);
        if (propId == 0) {
            // main handling
            const main = utils.readNext(t.ModifyMainHeader, data, &j);
            const current = Fields.get(typeEntry, node, propSchema, t.PropType.microBuffer);
            const size = main.type.size();
            const value = data[j .. j + size];
            if (main.increment != .none) {
                switch (main.type) {
                    .number => applyInc(f64, current, value, main.start, main.increment),
                    .timestamp => applyInc(i64, current, value, main.start, main.increment),
                    .int8, .uint8 => applyInc(u8, current, value, main.start, main.increment),
                    .int16, .uint16 => applyInc(u16, current, value, main.start, main.increment),
                    .int32, .uint32 => applyInc(u32, current, value, main.start, main.increment),
                    else => {},
                }
            }
            utils.copy(u8, current, value, main.start);
            j += size;
        } else {
            // separate handling
            const prop = utils.readNext(t.ModifyPropHeader, data, &j);
            const value = data[j .. j + prop.size];
            switch (prop.type) {
                .text => {
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
                    if (value.len == 0) continue;
                    const id = Node.getNodeId(node);
                    const old = try Fields.setAlias(typeEntry, id, prop.id, value);
                    // std.debug.print("value {any} {any} {d} {d} {any}\n", .{ node, value, id, prop.id, old });
                    // if (Fields.getAliasByName(typeEntry, prop.id, value)) |node2| {
                    //     const res = Fields.get(
                    //         typeEntry,
                    //         node,
                    //         propSchema,
                    //         prop.type,
                    //     );
                    //     std.debug.print("node {any} {any} {any}\n", .{ node, node2, res });
                    // }
                    if (old > 0) {
                        // TODO sort for everything
                        // if (ctx.currentSortIndex != null) {
                        //     sort.remove(ctx.thread.decompressor, ctx.currentSortIndex.?, slice, Node.getNode(ctx.typeEntry.?, old).?);
                        // }
                        const typeId = Node.getNodeTypeId(node);
                        selva.markDirty(db, typeId, old);
                    }
                },
                .cardinality => {
                    var k: usize = 0;
                    const cardinality = utils.readNext(t.ModifyCardinalityHeader, value, &k);
                    var hll = selva.c.selva_fields_get_selva_string(node, propSchema);
                    if (hll == null) {
                        hll = try Fields.ensurePropTypeString(node, propSchema);
                        selva.c.hll_init(hll, cardinality.precision, cardinality.sparse);
                    }
                    while (k < value.len) {
                        const hash = utils.read(u64, value, k);
                        selva.c.hll_add(hll, hash);
                        k += 8;
                    }
                },
                .reference => {
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
                                    try modifyProps(db, edgeType, edgeNode, edgeProps, items);
                                } // TODO else error?
                            }
                        }
                    }
                },
                .references => {
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
                                const count = utils.read(u32, refs, 0);
                                var x: usize = 4;
                                _ = selva.c.selva_fields_prealloc_refs(db.selva, node, propSchema, count);
                                while (x < refs.len) {
                                    const meta = utils.readNext(t.ModifyReferencesMetaHeader, refs, &x);
                                    var refId = meta.id;
                                    if (meta.isTmp) refId = utils.read(u32, items, refId * resItemSize);
                                    if (Node.getNode(refTypeEntry, refId)) |dst| {
                                        const ref = try References.insertReference(db, node, propSchema, dst, meta.index, meta.withIndex);
                                        if (meta.size != 0) {
                                            const edgeProps = refs[x .. x + meta.size];
                                            const edgeConstraint = Schema.getEdgeFieldConstraint(propSchema);
                                            if (Node.getEdgeNode(db, edgeConstraint, ref.p.large)) |edgeNode| {
                                                const edgeType = try Node.getType(db, edgeConstraint.edge_node_type);
                                                try modifyProps(db, edgeType, edgeNode, edgeProps, items);
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
                else => {
                    try Fields.set(node, propSchema, value);
                },
            }

            j += prop.size;
        }
    }
}

const UpsertResult = struct {
    node: Node.Node,
    created: bool,
};

inline fn upsertTarget(db: *DbCtx, typeId: u8, typeEntry: Node.Type, data: []u8) !UpsertResult {
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
                modifyProps(db, typeEntry, node, data, items) catch {
                    // handle errors
                };
                db.ids[create.type - 1] = id;
                utils.write(result, id, j);
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
                    const data: []u8 = buf[i .. i + update.size];
                    modifyProps(db, typeEntry, node, data, items) catch {
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
                if (upsertRes.created) {
                    try modifyProps(db, typeEntry, upsertRes.node, target, items);
                }
                const dataSize = utils.read(u32, buf, i);
                i += 4;
                const data = buf[i .. i + dataSize];
                modifyProps(db, typeEntry, upsertRes.node, data, items) catch {
                    // handle errors
                };
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
                i += 4;
                if (upsertRes.created) {
                    try modifyProps(db, typeEntry, upsertRes.node, target, items);
                    const data = buf[i .. i + dataSize];
                    modifyProps(db, typeEntry, upsertRes.node, data, items) catch {
                        // handle errors
                    };
                }
                const id = Node.getNodeId(upsertRes.node);
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
                if (Node.getNode(typeEntry, id)) |node| {
                    Node.deleteNode(db, typeEntry, node) catch {
                        // handle errors
                    };
                    utils.write(result, id, j);
                    utils.write(result, t.ModifyError.null, j + 4);
                } else {
                    utils.write(result, id, j);
                    utils.write(result, t.ModifyError.nx, j + 4);
                }
            },
        }
        j += resItemSize;
    }

    Node.expire(db);
    utils.write(result, j, 0);
    if (j < size) @memset(result[j..size], 0);
}
