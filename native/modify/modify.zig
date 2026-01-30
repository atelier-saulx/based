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

pub fn modifyProps(db: *DbCtx, typeEntry: ?Node.Type, node: Node.Node, data: []u8, items: []t.ModifyResultItem) !void {
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
                .cardinality => {
                    var k: usize = 0;
                    const cardinality = utils.readNext(t.ModifyCardinalityHeader, value, &k);
                    const hll = try Fields.ensurePropTypeString(node, propSchema);
                    selva.c.hll_init(hll, cardinality.precision, cardinality.sparse);
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
                    if (meta.isTmp) {
                        refId = items[refId].id;
                    }

                    if (Node.getNode(refTypeEntry, refId)) |dst| {
                        _ = try References.writeReference(db, node, propSchema, dst);
                        if (meta.size != 0) {
                            const edgeProps = value[k .. k + meta.size];
                            const edgeConstraint = Schema.getEdgeFieldConstraint(propSchema);
                            const edgeType = try Node.getType(db, edgeConstraint.edge_node_type);
                            try modifyProps(db, edgeType, dst, edgeProps, items);
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
                                for (u32Ids) |*id| {
                                    id.* = items[id.*].id;
                                }
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

                                    if (meta.isTmp) {
                                        refId = items[refId].id;
                                    }

                                    if (Node.getNode(refTypeEntry, refId)) |dst| {
                                        const ref = try References.insertReference(db, node, propSchema, dst, meta.index, meta.withIndex);
                                        if (meta.size != 0) {
                                            const edgeProps = refs[x .. x + meta.size];
                                            const edgeConstraint = Schema.getEdgeFieldConstraint(propSchema);
                                            const edgeType = try Node.getType(db, edgeConstraint.edge_node_type);
                                            const edgeNode = try Node.ensureRefEdgeNode(db, node, edgeConstraint, ref.p.large);
                                            try modifyProps(db, edgeType, edgeNode, edgeProps, items);
                                        }
                                    }

                                    x += meta.size;
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

pub fn modify(
    thread: *Thread.Thread,
    buf: []u8,
    db: *DbCtx,
) !void {
    var i: usize = 0;
    var j: u32 = 5 + @alignOf(t.ModifyResultItem);
    const header = utils.readNext(t.ModifyHeader, buf, &i);
    const size = j + header.count * 5;
    const result = try thread.modify.result(size, header.opId, header.opType);
    const alignIndex = thread.modify.index - size + j;
    const offset: u8 = @truncate(alignIndex % @alignOf(t.ModifyResultItem));
    result[4] = @alignOf(t.ModifyResultItem) - offset;
    j -= offset;
    const items = utils.toSlice(t.ModifyResultItem, result[j..]);
    while (i < buf.len) {
        const op: t.Modify = @enumFromInt(buf[i]);
        // std.debug.print("op: {any}\n", .{op});
        switch (op) {
            .create => {
                const create = utils.read(t.ModifyCreateHeader, buf, i);
                i += utils.sizeOf(t.ModifyCreateHeader);
                const typeEntry = try Node.getType(db, create.type);
                const data: []u8 = buf[i .. i + create.size];
                const id = db.ids[create.type - 1] + 1;
                const node = try Node.upsertNode(typeEntry, id);
                // std.debug.print("create id: {any}\n", .{id});
                modifyProps(db, typeEntry, node, data, items) catch {
                    // handle errors
                };
                db.ids[create.type - 1] = id;
                utils.write(result, id, j);
                utils.writeAs(u8, result, t.ModifyError.null, j + 4);
                i += create.size;
                j += 5;
            },
            .update => {
                const update = utils.read(t.ModifyUpdateHeader, buf, i);
                i += utils.sizeOf(t.ModifyUpdateHeader);
                const typeEntry = try Node.getType(db, update.type);
                var id = update.id;
                if (update.isTmp) id = items[id].id;
                utils.write(result, id, j);
                if (Node.getNode(typeEntry, id)) |node| {
                    const data: []u8 = buf[i .. i + update.size];
                    modifyProps(db, typeEntry, node, data, items) catch {
                        // handle errors
                    };
                    utils.writeAs(u8, result, t.ModifyError.null, j + 4);
                } else {
                    utils.writeAs(u8, result, t.ModifyError.nx, j + 4);
                }
                i += update.size;
                j += 5;
            },
            .delete => {
                const delete = utils.read(t.ModifyDeleteHeader, buf, i);
                i += utils.sizeOf(t.ModifyDeleteHeader);
                const typeEntry = try Node.getType(db, delete.type);
                var id = delete.id;
                if (delete.isTmp) id = items[id].id;
                utils.write(result, id, j);
                if (Node.getNode(typeEntry, id)) |node| {
                    Node.deleteNode(db, typeEntry, node) catch {
                        // handle errors
                    };
                    utils.writeAs(u8, result, t.ModifyError.null, j + 4);
                } else {
                    utils.writeAs(u8, result, t.ModifyError.nx, j + 4);
                }
                j += 5;
            },
        }
    }

    Node.expire(db);
    utils.write(result, j, 0);

    if (j < size) @memset(result[j..size], 0);
}
