const std = @import("std");
const napi = @import("../napi.zig");
const selva = @import("../selva/selva.zig");
const Schema = @import("../selva/schema.zig");
const Node = @import("../selva/node.zig");
const Fields = @import("../selva/fields.zig");
const References = @import("../selva/references.zig");
const Modify = @import("common.zig");
const createField = @import("create.zig").createField;
const deleteFieldSortIndex = @import("delete.zig").deleteFieldSortIndex;
const deleteField = @import("delete.zig").deleteField;
const deleteTextLang = @import("delete.zig").deleteTextLang;
const addEmptyToSortIndex = @import("sort.zig").addEmptyToSortIndex;
const addEmptyTextToSortIndex = @import("sort.zig").addEmptyTextToSortIndex;
const utils = @import("../utils.zig");
const Update = @import("update.zig");
const dbSort = @import("../sort/sort.zig");
const config = @import("config");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

const updateField = Update.updateField;
const updatePartialField = Update.updatePartialField;
const increment = Update.increment;
const read = utils.read;
const write = utils.write;
const assert = std.debug.assert;
const ModifyCtx = Modify.ModifyCtx;

const subs = @import("subscription.zig");

pub const subscription = subs.suscription;

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
//  -----------------------

fn switchType(ctx: *ModifyCtx, typeId: u16) !void {
    ctx.typeId = typeId;
    ctx.typeEntry = try Node.getType(ctx.db, ctx.typeId);
    ctx.typeSortIndex = dbSort.getTypeSortIndexes(ctx.db, ctx.typeId);
    // ctx.subTypes = ctx.thread.subscriptions.types.get(ctx.typeId);
    // if (ctx.subTypes) |st| {
    //     st.typeModified = true;
    // }
    ctx.node = null;
}

fn writeoutPrevNodeId(ctx: *ModifyCtx, resultLen: *u32, prevNodeId: u32, result: []u8) void {
    if (prevNodeId != 0) {
        utils.write(result, prevNodeId, resultLen.*);
        utils.writeAs(u8, result, ctx.err, resultLen.* + 4);
        ctx.err = t.ModifyError.null;
        resultLen.* += 5;
    }
}

fn newNode(ctx: *ModifyCtx) !void {
    const id = ctx.db.ids[ctx.typeId - 1] + 1;
    ctx.node = try Node.upsertNode(ctx, ctx.typeEntry.?, id);
    ctx.id = id;
    ctx.db.ids[ctx.typeId - 1] = id;
    selva.markDirty(ctx, ctx.typeId, id);
}

fn newNodeRing(ctx: *ModifyCtx, maxId: u32) !void {
    const nextId = ctx.db.ids[ctx.typeId - 1] % maxId + 1;
    ctx.node = Node.getNode(ctx.typeEntry.?, nextId);

    if (ctx.node) |oldNode| {
        Node.flushNode(ctx, ctx.typeEntry.?, oldNode);
    } else {
        ctx.node = try Node.upsertNode(ctx, ctx.typeEntry.?, nextId);
    }

    ctx.id = nextId;
    ctx.db.ids[ctx.typeId - 1] = nextId;
    selva.markDirty(ctx, ctx.typeId, nextId);
}

fn getLargeRef(db: *DbCtx, node: Node.Node, fs: Schema.FieldSchema, dstId: u32) ?References.ReferenceLarge {
    if (dstId == 0) { // assume reference
        return References.getReference(node, fs);
    } else { // references
        if (References.getReferences(false, true, db, node, fs)) |iterator| {
            const refs = iterator.refs;
            const any = References.referencesGet(refs, dstId);
            if (any.type == selva.c.SELVA_NODE_REFERENCE_LARGE) {
                return any.p.large;
            }
        }
    }
    return null;
}

pub fn switchEdgeId(ctx: *ModifyCtx, srcId: u32, dstId: u32, refField: u8) anyerror!u32 {
    var prevNodeId: u32 = 0;
    if (srcId == 0 or ctx.node == null) {
        return 0;
    }
    const fs = Schema.getFieldSchema(ctx.typeEntry, refField) catch {
        return 0;
    };
    ctx.fieldSchema = fs;
    if (getLargeRef(ctx.db, ctx.node.?, fs, dstId)) |ref| {
        const efc = Schema.getEdgeFieldConstraint(fs);

        const edgeNode = Node.ensureRefEdgeNode(ctx, ctx.node.?, efc, ref) catch {
            return 0;
        };

        const edgeId = ref.*.edge;

        // if its zero then we don't want to switch (for upsert)
        prevNodeId = ctx.id;

        switchType(ctx, efc.edge_node_type) catch {
            return 0;
        };
        ctx.id = edgeId;
        ctx.node = edgeNode;
        if (ctx.node == null) {
            ctx.err = t.ModifyError.nx;
        } else {
            // try subs.checkId(ctx);
            // It would be even better if we'd mark it dirty only in the case
            // something was actually changed.
            selva.markDirty(ctx, ctx.typeId, ctx.id);
        }
    }

    return prevNodeId;
}

pub fn writeData(ctx: *ModifyCtx, buf: []u8) anyerror!usize {
    var i: usize = 0;
    while (i < buf.len) {
        const op: t.ModOp = @enumFromInt(buf[i]);
        // TODO set i += 1; HERE and remove from each individual thing
        const data: []u8 = buf[i + 1 ..];

        switch (op) {
            .padding => {
                i += 1;
            },
            .switchProp => {
                ctx.field = data[0];
                i += 3;
                ctx.fieldSchema = try Schema.getFieldSchema(ctx.typeEntry.?, ctx.field);
                ctx.fieldType = @enumFromInt(data[1]);
                if (ctx.field != 0) {
                    ctx.currentSortIndex = dbSort.getSortIndex(
                        ctx.typeSortIndex,
                        ctx.field,
                        0,
                        t.LangCode.none,
                    );
                } else {
                    ctx.currentSortIndex = null;
                }
            },
            .deleteNode => {
                if (ctx.node) |node| {
                    // subs.stage(ctx, subs.Op.deleteNode);
                    Node.deleteNode(ctx, ctx.typeEntry.?, node) catch {};
                    ctx.node = null;
                }
                i += 1;
            },
            .deleteTextField => {
                const lang: t.LangCode = @enumFromInt(data[0]);
                deleteTextLang(ctx, lang);
                i += 2;
            },
            .switchIdCreate => {
                writeoutPrevNodeId(ctx, &ctx.resultLen, ctx.id, ctx.result);
                try newNode(ctx);
                i += 1;
            },
            .switchIdCreateRing => {
                writeoutPrevNodeId(ctx, &ctx.resultLen, ctx.id, ctx.result);
                const maxNodeId = read(u32, data, 0);
                try newNodeRing(ctx, maxNodeId);
                i += 5;
            },
            .switchIdCreateUnsafe => {
                writeoutPrevNodeId(ctx, &ctx.resultLen, ctx.id, ctx.result);
                ctx.id = read(u32, data, 0);
                if (ctx.id > ctx.db.ids[ctx.typeId - 1]) {
                    ctx.db.ids[ctx.typeId - 1] = ctx.id;
                }
                ctx.node = try Node.upsertNode(ctx, ctx.typeEntry.?, ctx.id);
                selva.markDirty(ctx, ctx.typeId, ctx.id);
                i += 5;
            },
            .switchIdUpdate => {
                const id = read(u32, data, 0);
                if (id != 0) {
                    writeoutPrevNodeId(ctx, &ctx.resultLen, ctx.id, ctx.result);
                    // if its zero then we don't want to switch (for upsert)
                    ctx.id = id;
                    ctx.node = Node.getNode(ctx.typeEntry.?, ctx.id);
                    if (ctx.node == null) {
                        ctx.err = t.ModifyError.nx;
                    } else {
                        // try subs.checkId(ctx);
                        // It would be even better if we'd mark it dirty only in the case
                        // something was actually changed.
                        selva.markDirty(ctx, ctx.typeId, ctx.id);
                    }
                }
                i += 5;
            },
            // .switchEdgeId => {
            //     const srcId = read(u32, data, 0);
            //     const dstId = read(u32, data, 4);
            //     const refField = read(u8, data, 8);
            //     const prevNodeId = try switchEdgeId(ctx, srcId, dstId, refField);
            //     writeoutPrevNodeId(ctx, &ctx.resultLen, prevNodeId, ctx.result);
            //     i += 10;
            // },
            .upsert => {
                const writeIndex = read(u32, data, 0);
                const updateIndex = read(u32, data, 4);
                var nextIndex: u32 = writeIndex;
                var j: u32 = 8;
                while (j < writeIndex) {
                    const prop = read(u8, data, j);
                    const len = read(u32, data, j + 1);
                    const val = data[j + 5 .. j + 5 + len];
                    if (Fields.getAliasByName(ctx.typeEntry.?, prop, val)) |node| {
                        write(data, Node.getNodeId(node), updateIndex + 1);
                        nextIndex = updateIndex;
                        break;
                    }
                    j = j + 5 + len;
                }
                i += nextIndex + 1;
            },
            .insert => {
                const writeIndex = read(u32, data, 0);
                const endIndex = read(u32, data, 4);
                var nextIndex: u32 = writeIndex;
                var j: u32 = 8;
                while (j < writeIndex) {
                    const prop = read(u8, data, j);
                    const len = read(u32, data, j + 1);
                    const val = data[j + 5 .. j + 5 + len];
                    if (Fields.getAliasByName(ctx.typeEntry.?, prop, val)) |node| {
                        const id = Node.getNodeId(node);
                        write(buf, id, ctx.resultLen);
                        write(buf, t.ModifyError.null, ctx.resultLen + 4);
                        ctx.resultLen += 5;
                        nextIndex = endIndex;
                        break;
                    }
                    j = j + 5 + len;
                }
                i += nextIndex + 1;
            },
            .switchType => {
                try switchType(ctx, read(u16, data, 0));
                i += 3;
            },
            .addEmptySort => {
                i += try addEmptyToSortIndex(ctx, data) + 1;
            },
            .addEmptySortText => {
                i += try addEmptyTextToSortIndex(ctx, data) + 1;
            },
            .delete => {
                i += try deleteField(ctx) + 1;
            },
            .deleteSortIndex => {
                i += try deleteFieldSortIndex(ctx) + 1;
            },
            .createProp => {
                i += try createField(ctx, data) + 1;
            },
            .updateProp => {
                i += try updateField(ctx, data) + 1;
            },
            .updatePartial => {
                i += try updatePartialField(ctx, data) + 1;
            },
            .increment, .decrement => {
                i += try increment(ctx, data, op) + 1;
            },
            .expire => {
                Node.expireNode(ctx, ctx.typeId, ctx.id, std.time.timestamp() + read(u32, data, 0));
                i += 5;
            },
            .end => {
                i += 1;
                break;
            },
        }
    }
    return i;
}

pub fn modifyProps(db: *DbCtx, typeEntry: ?Node.Type, node: Node.Node, data: []u8, items: []t.ModifyResultItem) !void {
    var j: usize = 0;
    while (j < data.len) {
        const propId = data[j];
        const propSchema = try Schema.getFieldSchema(typeEntry, propId);
        if (propId == 0) {
            // main handling
            const main = utils.readNext(t.ModifyMainHeader, data, &j);
            const value = data[j .. j + main.size];
            const current = Fields.get(typeEntry, node, propSchema, t.PropType.microBuffer);
            utils.copy(u8, current, value, main.start);
            j += main.size;
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
                        const hash = read(u64, value, k);
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
                                const u32Ids = read([]u32, refs[4 - offset .. refs.len - offset], 0);
                                try References.putReferences(db, node, propSchema, u32Ids);
                            },
                            .tmpIds => {
                                const offset = utils.alignLeft(u32, refs);
                                const u32Ids = read([]u32, refs[4 - offset .. refs.len - offset], 0);
                                for (u32Ids) |*id| {
                                    id.* = items[id.*].id;
                                }
                                try References.putReferences(db, node, propSchema, u32Ids);
                            },
                            .idsWithMeta => {
                                const refTypeId = Schema.getRefTypeIdFromFieldSchema(propSchema);
                                const refTypeEntry = try Node.getType(db, refTypeId);
                                const count = read(u32, refs, 0);
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
                utils.writeAs(u8, result, t.ModifyError.null, j + 4);
                i += create.size;
                j += 5;
            },
            .update => {
                const update = utils.read(t.ModifyUpdateHeader, buf, i);
                i += utils.sizeOf(t.ModifyUpdateHeader);
                const typeEntry = try Node.getType(db, update.type);
                utils.write(result, update.id, j);
                if (Node.getNode(typeEntry, update.id)) |node| {
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
                utils.write(result, delete.id, j);
                if (Node.getNode(typeEntry, delete.id)) |node| {
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
