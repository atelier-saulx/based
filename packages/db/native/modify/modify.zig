const assert = std.debug.assert;
const std = @import("std");
const selva = @import("../selva.zig").c;
const types = @import("../types.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const Modify = @import("./ctx.zig");
const createField = @import("./create.zig").createField;
const deleteFieldSortIndex = @import("./delete.zig").deleteFieldSortIndex;
const deleteField = @import("./delete.zig").deleteField;
const deleteTextLang = @import("./delete.zig").deleteTextLang;
const subs = @import("./subscription.zig");

const addEmptyToSortIndex = @import("./sort.zig").addEmptyToSortIndex;
const addEmptyTextToSortIndex = @import("./sort.zig").addEmptyTextToSortIndex;
const utils = @import("../utils.zig");
const Update = @import("./update.zig");
const ModifyCtx = Modify.ModifyCtx;
const updateField = Update.updateField;
const updatePartialField = Update.updatePartialField;
const dbSort = @import("../db/sort.zig");
const increment = Update.increment;
const config = @import("config");
const read = utils.read;
const writeInt = utils.writeInt;
const errors = @import("../errors.zig");

pub fn modify(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    var result: napi.Value = undefined;
    var resCount: u32 = 0;
    modifyInternalNapi(env, info, &resCount) catch undefined;
    _ = napi.c.napi_create_uint32(env, resCount * 5, &result);
    return result;
}

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
    const dbCtx = try napi.get(*db.DbCtx, env, args[1]);
    try dbCtx.threads.modify(batch);
}

fn switchType(ctx: *ModifyCtx, typeId: u16) !void {
    ctx.typeId = typeId;
    ctx.typeEntry = try db.getType(ctx.db, ctx.typeId);
    ctx.typeSortIndex = dbSort.getTypeSortIndexes(ctx.db, ctx.typeId);

    ctx.subTypes = ctx.db.subscriptions.types.get(ctx.typeId);
    if (ctx.subTypes) |st| {
        st.typeModified = true;
    }

    ctx.node = null;
    // TODO This can't be reset because it's still used.
    //ctx.id = 0;
}

fn writeoutPrevNodeId(ctx: *ModifyCtx, resCount: *u32, prevNodeId: u32) void {
    if (prevNodeId != 0) {
        writeInt(u32, ctx.batch, resCount.* * 5, prevNodeId);
        writeInt(u8, ctx.batch, resCount.* * 5 + 4, @intFromEnum(ctx.err));
        ctx.err = errors.ClientError.null;
        resCount.* += 1;
    }
}

fn newNode(ctx: *ModifyCtx) !void {
    const id = ctx.db.ids[ctx.typeId - 1] + 1;

    ctx.node = try db.upsertNode(ctx, ctx.typeEntry.?, id);
    ctx.id = id;
    ctx.db.ids[ctx.typeId - 1] = id;
    Modify.markDirtyRange(ctx, ctx.typeId, id);
}

fn newNodeRing(ctx: *ModifyCtx, maxId: u32) !void {
    const nextId = ctx.db.ids[ctx.typeId - 1] % maxId + 1;
    ctx.node = db.getNode(ctx.typeEntry.?, nextId);

    if (ctx.node) |oldNode| {
        db.flushNode(ctx, ctx.typeEntry.?, oldNode);
    } else {
        ctx.node = try db.upsertNode(ctx, ctx.typeEntry.?, nextId);
    }

    ctx.id = nextId;
    ctx.db.ids[ctx.typeId - 1] = nextId;
    Modify.markDirtyRange(ctx, ctx.typeId, nextId);
}

fn getLargeRef(node: db.Node, fs: db.FieldSchema, dstId: u32) ?db.ReferenceLarge {
    if (dstId == 0) { // assume reference
        return db.getSingleReference(node, fs);
    } else { // references
        const refs = db.getReferences(node, fs);
        const any = db.referencesGet(refs, dstId);
        if (any.type == selva.SELVA_NODE_REFERENCE_LARGE) {
            return any.p.large;
        } else {
            return null;
        }
    }
}

fn switchEdgeId(ctx: *ModifyCtx, srcId: u32, dstId: u32, refField: u8) !u32 {
    var prevNodeId: u32 = 0;

    if (srcId == 0 or ctx.node == null) {
        return 0;
    }

    const fs = db.getFieldSchema(ctx.typeEntry, refField) catch {
        return 0;
    };
    ctx.fieldSchema = fs;

    if (getLargeRef(ctx.node.?, fs, dstId)) |ref| {
        const efc = db.getEdgeFieldConstraint(fs);
        switchType(ctx, efc.edge_node_type) catch {
            return 0;
        };
        const edgeNode = db.ensureRefEdgeNode(ctx, ctx.node.?, efc, ref) catch {
            return 0;
        };
        const edgeId = ref.*.edge;

        // if its zero then we don't want to switch (for upsert)
        prevNodeId = ctx.id;
        ctx.id = edgeId;
        ctx.node = edgeNode;
        if (ctx.node == null) {
            ctx.err = errors.ClientError.nx;
        } else {
            try subs.checkId(ctx);
            // It would be even better if we'd mark it dirty only in the case
            // something was actually changed.
            Modify.markDirtyRange(ctx, ctx.typeId, ctx.id);
        }
    }

    return prevNodeId;
}

fn modifyInternalNapi(env: napi.Env, info: napi.Info, resCount: *u32) !void {
    const args = try napi.getArgs(4, env, info);
    const batch = try napi.get([]u8, env, args[0]);
    const dbCtx = try napi.get(*db.DbCtx, env, args[1]);
    const dirtyRanges = try napi.get([]f64, env, args[2]);
    try modifyInternal(batch, dbCtx, dirtyRanges, resCount);
}

pub fn modifyInternal(batch: []u8, dbCtx: *db.DbCtx, _: []f64, resCount: *u32) !void {
    var i: usize = 0;
    var ctx: ModifyCtx = .{
        .field = undefined,
        .typeId = 0,
        .id = 0,
        .currentSortIndex = null,
        .typeSortIndex = null,
        .node = null,
        .typeEntry = null,
        .fieldSchema = null,
        .fieldType = types.Prop.NULL,
        .db = dbCtx,
        .dirtyRanges = std.AutoArrayHashMap(u64, f64).init(dbCtx.allocator),
        .batch = batch,
        .err = errors.ClientError.null,
        .idSubs = null,
        .subTypes = null,
    };

    defer ctx.dirtyRanges.deinit();
    var offset: u32 = 0;

    while (i < batch.len) {
        const op: types.ModOp = @enumFromInt(batch[i]);
        const operation: []u8 = batch[i + 1 ..];
        switch (op) {
            types.ModOp.PADDING => {
                i = i + 1;
            },
            types.ModOp.SWITCH_FIELD => {
                ctx.field = operation[0];
                i = i + 3;
                ctx.fieldSchema = try db.getFieldSchema(ctx.typeEntry.?, ctx.field);
                ctx.fieldType = @enumFromInt(operation[1]);
                if (ctx.fieldType == types.Prop.REFERENCE) {
                    offset = 1;
                } else if (ctx.fieldType == types.Prop.CARDINALITY) {
                    offset = 7;
                } else {
                    offset = 5;
                }
                if (ctx.field != 0) {
                    ctx.currentSortIndex = dbSort.getSortIndex(
                        ctx.typeSortIndex,
                        ctx.field,
                        0,
                        types.LangCode.NONE,
                    );
                } else {
                    ctx.currentSortIndex = null;
                }
            },
            types.ModOp.DELETE_NODE => {
                if (ctx.node) |node| {
                    subs.stage(&ctx, subs.Op.deleteNode);
                    db.deleteNode(&ctx, ctx.typeEntry.?, node) catch {};
                    ctx.node = null;
                }
                i = i + 1;
            },
            types.ModOp.DELETE_TEXT_FIELD => {
                const lang: types.LangCode = @enumFromInt(operation[0]);
                deleteTextLang(&ctx, lang);
                i = i + 2;
            },
            types.ModOp.SWITCH_ID_CREATE => {
                writeoutPrevNodeId(&ctx, resCount, ctx.id);
                try newNode(&ctx);
                i = i + 1;
            },
            types.ModOp.SWITCH_ID_CREATE_RING => {
                writeoutPrevNodeId(&ctx, resCount, ctx.id);
                const maxNodeId = read(u32, operation, 0);
                try newNodeRing(&ctx, maxNodeId);
                i = i + 5;
            },
            types.ModOp.SWITCH_ID_CREATE_UNSAFE => {
                writeoutPrevNodeId(&ctx, resCount, ctx.id);
                ctx.id = read(u32, operation, 0);
                if (ctx.id > dbCtx.ids[ctx.typeId - 1]) {
                    dbCtx.ids[ctx.typeId - 1] = ctx.id;
                }
                ctx.node = try db.upsertNode(&ctx, ctx.typeEntry.?, ctx.id);
                Modify.markDirtyRange(&ctx, ctx.typeId, ctx.id);
                i = i + 5;
            },
            types.ModOp.SWITCH_ID_UPDATE => {
                const id = read(u32, operation, 0);
                if (id != 0) {
                    writeoutPrevNodeId(&ctx, resCount, ctx.id);
                    // if its zero then we don't want to switch (for upsert)
                    ctx.id = id;
                    ctx.node = db.getNode(ctx.typeEntry.?, ctx.id);
                    if (ctx.node == null) {
                        ctx.err = errors.ClientError.nx;
                    } else {
                        try subs.checkId(&ctx);
                        // It would be even better if we'd mark it dirty only in the case
                        // something was actually changed.
                        Modify.markDirtyRange(&ctx, ctx.typeId, ctx.id);
                    }
                }
                i = i + 5;
            },
            types.ModOp.SWITCH_EDGE_ID => {
                const srcId = read(u32, operation, 0);
                const dstId = read(u32, operation, 4);
                const refField = read(u8, operation, 8);
                const prevNodeId = try switchEdgeId(&ctx, srcId, dstId, refField);
                writeoutPrevNodeId(&ctx, resCount, prevNodeId);
                i = i + 10;
            },
            types.ModOp.UPSERT => {
                const writeIndex = read(u32, operation, 0);
                const updateIndex = read(u32, operation, 4);
                var nextIndex: u32 = writeIndex;
                var j: u32 = 8;
                while (j < writeIndex) {
                    const prop = read(u8, operation, j);
                    const len = read(u32, operation, j + 1);
                    const val = operation[j + 5 .. j + 5 + len];
                    if (db.getAliasByName(ctx.typeEntry.?, prop, val)) |node| {
                        // write the id into the operation
                        writeInt(u32, operation, updateIndex + 1, db.getNodeId(node));
                        nextIndex = updateIndex;
                        break;
                    }
                    j = j + 5 + len;
                }
                i = i + nextIndex + 1;
            },
            types.ModOp.INSERT => {
                const writeIndex = read(u32, operation, 0);
                const endIndex = read(u32, operation, 4);
                var nextIndex: u32 = writeIndex;
                var j: u32 = 8;
                while (j < writeIndex) {
                    const prop = read(u8, operation, j);
                    const len = read(u32, operation, j + 1);
                    const val = operation[j + 5 .. j + 5 + len];
                    if (db.getAliasByName(ctx.typeEntry.?, prop, val)) |node| {
                        const id = db.getNodeId(node);
                        writeInt(u32, batch, resCount.* * 5, id);
                        writeInt(u8, batch, resCount.* * 5 + 4, @intFromEnum(errors.ClientError.null));
                        resCount.* += 1;
                        nextIndex = endIndex;
                        break;
                    }
                    j = j + 5 + len;
                }
                i = i + nextIndex + 1;
            },
            types.ModOp.SWITCH_TYPE => {
                try switchType(&ctx, read(u16, operation, 0));
                i = i + 3;
            },
            types.ModOp.ADD_EMPTY_SORT => {
                i += try addEmptyToSortIndex(&ctx, operation) + 1;
            },
            types.ModOp.ADD_EMPTY_SORT_TEXT => {
                i += try addEmptyTextToSortIndex(&ctx, operation) + 1;
            },
            types.ModOp.DELETE => {
                i += try deleteField(&ctx) + 1;
            },
            types.ModOp.DELETE_SORT_INDEX => {
                i += try deleteFieldSortIndex(&ctx) + 1;
            },
            types.ModOp.CREATE_PROP => {
                i += try createField(&ctx, operation) + offset;
            },
            types.ModOp.UPDATE_PROP => {
                i += try updateField(&ctx, operation) + offset;
            },
            types.ModOp.UPDATE_PARTIAL => {
                // fires too often!
                // std.debug.print("PARTIAL TIMES! \n", .{});
                i += try updatePartialField(&ctx, operation) + offset;
            },
            types.ModOp.INCREMENT, types.ModOp.DECREMENT => {
                // std.debug.print("INCREMENT TIMES! \n", .{});
                i += try increment(&ctx, operation, op) + 1;
            },
            types.ModOp.EXPIRE => {
                db.expireNode(&ctx, ctx.typeId, ctx.id, std.time.timestamp() + read(u32, operation, 0));
                i += 5;
            },
            else => {
                std.log.err("Something went wrong, incorrect modify operation. At i: {d} len: {d}\n", .{ i, batch.len });
                break;
            },
        }
    }

    db.expire(&ctx);

    // const newDirtyRanges = ctx.dirtyRanges.values();
    // assert(newDirtyRanges.len < dirtyRanges.len);
    // _ = napi.c.memcpy(dirtyRanges.ptr, newDirtyRanges.ptr, newDirtyRanges.len * 8);
    // dirtyRanges[newDirtyRanges.len] = 0.0;
    writeoutPrevNodeId(&ctx, resCount, ctx.id);
}
