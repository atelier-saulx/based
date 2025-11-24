const std = @import("std");
const napi = @import("../napi.zig");
const selva = @import("../selva/selva.zig").c;
const Db = @import("../selva/db.zig");
const Node = @import("../selva/node.zig");
const Schema = @import("../selva/schema.zig");
const References = @import("../selva/references.zig");
const Modify = @import("common.zig");
const createField = @import("create.zig").createField;
const deleteFieldSortIndex = @import("delete.zig").deleteFieldSortIndex;
const deleteField = @import("delete.zig").deleteField;
const deleteTextLang = @import("delete.zig").deleteTextLang;
const subs = @import("subscription.zig");
const addEmptyToSortIndex = @import("sort.zig").addEmptyToSortIndex;
const addEmptyTextToSortIndex = @import("sort.zig").addEmptyTextToSortIndex;
const utils = @import("../utils.zig");
const Update = @import("update.zig");
const dbSort = @import("../db/sort.zig");
const config = @import("config");
const errors = @import("../errors.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");

const updateField = Update.updateField;
const updatePartialField = Update.updatePartialField;
const increment = Update.increment;
const read = utils.read;
const write = utils.write;
const assert = std.debug.assert;
const ModifyCtx = Modify.ModifyCtx;

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
    const dbCtx = try napi.get(*Db.DbCtx, env, args[1]);
    try dbCtx.threads.modify(batch);
}
//  -----------------------

fn switchType(ctx: *ModifyCtx, typeId: u16) !void {
    ctx.typeId = typeId;
    ctx.typeEntry = try Db.getType(ctx.db, ctx.typeId);
    ctx.typeSortIndex = dbSort.getTypeSortIndexes(ctx.db, ctx.typeId);

    ctx.subTypes = ctx.db.subscriptions.types.get(ctx.typeId);
    if (ctx.subTypes) |st| {
        st.typeModified = true;
    }

    ctx.node = null;
    // TODO This can't be reset because it's still used.
    //ctx.id = 0;
}

fn writeoutPrevNodeId(ctx: *ModifyCtx, resultLen: *u32, prevNodeId: u32, result: []u8) void {
    if (prevNodeId != 0) {
        utils.write(result, prevNodeId, resultLen.*);
        utils.writeAs(u8, result, ctx.err, resultLen.* + 4);
        ctx.err = errors.ClientError.null;
        resultLen.* += 5;
    }
}

fn newNode(ctx: *ModifyCtx) !void {
    const id = ctx.db.ids[ctx.typeId - 1] + 1;

    ctx.node = try Node.upsertNode(ctx, ctx.typeEntry.?, id);
    ctx.id = id;
    ctx.db.ids[ctx.typeId - 1] = id;
    Modify.markDirtyRange(ctx, ctx.typeId, id);
}

fn newNodeRing(ctx: *ModifyCtx, maxId: u32) !void {
    const nextId = ctx.db.ids[ctx.typeId - 1] % maxId + 1;
    ctx.node = Node.getNode(ctx.typeEntry.?, nextId);

    if (ctx.node) |oldNode| {
        Db.flushNode(ctx, ctx.typeEntry.?, oldNode);
    } else {
        ctx.node = try Node.upsertNode(ctx, ctx.typeEntry.?, nextId);
    }

    ctx.id = nextId;
    ctx.db.ids[ctx.typeId - 1] = nextId;
    Modify.markDirtyRange(ctx, ctx.typeId, nextId);
}

fn getLargeRef(db: *Db.DbCtx, node: Node.Node, fs: Schema.FieldSchema, dstId: u32) ?Db.ReferenceLarge {
    if (dstId == 0) { // assume reference
        return References.getSingleReference(node, fs);
    } else { // references
        if (References.getReferences(true, db, node, fs)) |iterator| {
            const refs = iterator.refs;
            const any = References.referencesGet(refs, dstId);
            if (any.type == selva.SELVA_NODE_REFERENCE_LARGE) {
                return any.p.large;
            }
        }
    }
    return null;
}

fn switchEdgeId(ctx: *ModifyCtx, srcId: u32, dstId: u32, refField: u8) !u32 {
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
        switchType(ctx, efc.edge_node_type) catch {
            return 0;
        };
        const edgeNode = Node.ensureRefEdgeNode(ctx, ctx.node.?, efc, ref) catch {
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

pub fn modify(
    // comptime isSubscriptionWorker: bool,
    threadCtx: *Thread.DbThread,
    batch: []u8,
    dbCtx: *Db.DbCtx,
    opType: t.OpType,
) !void {
    // utils.readNext(t.QueryDefaultHeader, q, &index);
    // var i/: usize = 0;
    const modifyId = read(u32, batch, 0);
    const nodeCount = read(u32, batch, 13);
    var i: usize = 13 + 4; // 5 for id + type and 8 for schema checksum + 4 for operation count
    // currentOffset chek threadCtx.current
    var ctx: ModifyCtx = .{
        .field = undefined,
        .typeId = 0,
        .id = 0,
        .currentSortIndex = null,
        .typeSortIndex = null,
        .node = null,
        .typeEntry = null,
        .fieldSchema = null,
        .fieldType = t.PropType.null,
        .db = dbCtx,
        .dirtyRanges = std.AutoArrayHashMap(u64, f64).init(dbCtx.allocator),
        .batch = batch,
        .err = errors.ClientError.null,
        .idSubs = null,
        .subTypes = null,
        .threadCtx = threadCtx,
    };

    defer ctx.dirtyRanges.deinit();
    var offset: u32 = 0;
    const expectedLen = 4 + nodeCount * 5; // len(4)+res(5)n
    const result = try Thread.newResult(false, threadCtx, expectedLen, modifyId, opType);
    var resultLen: u32 = 4; // reserve for writing result len

    while (i < batch.len) {
        const op: t.ModOp = @enumFromInt(batch[i]);
        const operation: []u8 = batch[i + 1 ..];
        switch (op) {
            t.ModOp.padding => {
                i = i + 1;
            },
            t.ModOp.switchProp => {
                ctx.field = operation[0];
                i = i + 3;
                ctx.fieldSchema = try Schema.getFieldSchema(ctx.typeEntry.?, ctx.field);
                ctx.fieldType = @enumFromInt(operation[1]);
                // TODO move this logic to the actual handlers (createProp, updateProp, etc)
                if (ctx.fieldType == t.PropType.reference) {
                    offset = 1;
                } else if (ctx.fieldType == t.PropType.cardinality) {
                    offset = 7;
                } else {
                    offset = 5;
                }
                if (ctx.field != 0) {
                    ctx.currentSortIndex = dbSort.getSortIndex(
                        ctx.typeSortIndex,
                        ctx.field,
                        0,
                        t.LangCode.NONE,
                    );
                } else {
                    ctx.currentSortIndex = null;
                }
            },
            t.ModOp.deleteNode => {
                if (ctx.node) |node| {
                    subs.stage(&ctx, subs.Op.deleteNode);
                    Db.deleteNode(&ctx, ctx.typeEntry.?, node) catch {};
                    ctx.node = null;
                }
                i = i + 1;
            },
            t.ModOp.deleteTextField => {
                const lang: t.LangCode = @enumFromInt(operation[0]);
                deleteTextLang(&ctx, lang);
                i = i + 2;
            },
            t.ModOp.switchIdCreate => {
                writeoutPrevNodeId(&ctx, &resultLen, ctx.id, result);
                try newNode(&ctx);
                i = i + 1;
            },
            t.ModOp.switchIdCreateRing => {
                writeoutPrevNodeId(&ctx, &resultLen, ctx.id, result);
                const maxNodeId = read(u32, operation, 0);
                try newNodeRing(&ctx, maxNodeId);
                i = i + 5;
            },
            t.ModOp.switchIdCreateUnsafe => {
                writeoutPrevNodeId(&ctx, &resultLen, ctx.id, result);
                ctx.id = read(u32, operation, 0);
                if (ctx.id > dbCtx.ids[ctx.typeId - 1]) {
                    dbCtx.ids[ctx.typeId - 1] = ctx.id;
                }
                ctx.node = try Node.upsertNode(&ctx, ctx.typeEntry.?, ctx.id);
                Modify.markDirtyRange(&ctx, ctx.typeId, ctx.id);
                i = i + 5;
            },
            t.ModOp.switchIdUpdate => {
                const id = read(u32, operation, 0);
                if (id != 0) {
                    writeoutPrevNodeId(&ctx, &resultLen, ctx.id, result);
                    // if its zero then we don't want to switch (for upsert)
                    ctx.id = id;
                    ctx.node = Node.getNode(ctx.typeEntry.?, ctx.id);
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
            t.ModOp.switchEdgeId => {
                const srcId = read(u32, operation, 0);
                const dstId = read(u32, operation, 4);
                const refField = read(u8, operation, 8);
                const prevNodeId = try switchEdgeId(&ctx, srcId, dstId, refField);
                writeoutPrevNodeId(&ctx, &resultLen, prevNodeId, result);
                i = i + 10;
            },
            t.ModOp.upsert => {
                const writeIndex = read(u32, operation, 0);
                const updateIndex = read(u32, operation, 4);
                var nextIndex: u32 = writeIndex;
                var j: u32 = 8;
                while (j < writeIndex) {
                    const prop = read(u8, operation, j);
                    const len = read(u32, operation, j + 1);
                    const val = operation[j + 5 .. j + 5 + len];
                    if (Db.getAliasByName(ctx.typeEntry.?, prop, val)) |node| {
                        write(operation, Node.getNodeId(node), updateIndex + 1);
                        nextIndex = updateIndex;
                        break;
                    }
                    j = j + 5 + len;
                }
                i = i + nextIndex + 1;
            },
            t.ModOp.insert => {
                const writeIndex = read(u32, operation, 0);
                const endIndex = read(u32, operation, 4);
                var nextIndex: u32 = writeIndex;
                var j: u32 = 8;
                while (j < writeIndex) {
                    const prop = read(u8, operation, j);
                    const len = read(u32, operation, j + 1);
                    const val = operation[j + 5 .. j + 5 + len];
                    if (Db.getAliasByName(ctx.typeEntry.?, prop, val)) |node| {
                        const id = Node.getNodeId(node);
                        write(batch, id, resultLen);
                        write(batch, errors.ClientError.null, resultLen + 4);
                        resultLen += 5;
                        nextIndex = endIndex;
                        break;
                    }
                    j = j + 5 + len;
                }
                i = i + nextIndex + 1;
            },
            t.ModOp.switchType => {
                try switchType(&ctx, read(u16, operation, 0));
                i = i + 3;
            },
            t.ModOp.addEmptySort => {
                i += try addEmptyToSortIndex(&ctx, operation) + 1;
            },
            t.ModOp.addEmptySortText => {
                i += try addEmptyTextToSortIndex(&ctx, operation) + 1;
            },
            t.ModOp.delete => {
                i += try deleteField(&ctx) + 1;
            },
            t.ModOp.deleteSortIndex => {
                i += try deleteFieldSortIndex(&ctx) + 1;
            },
            t.ModOp.createProp => {
                i += try createField(&ctx, operation) + offset;
            },
            t.ModOp.updateProp => {
                i += try updateField(&ctx, operation) + offset;
            },
            t.ModOp.updatePartial => {
                i += try updatePartialField(&ctx, operation) + offset;
            },
            t.ModOp.increment, t.ModOp.decrement => {
                i += try increment(&ctx, operation, op) + 1;
            },
            t.ModOp.expire => {
                Db.expireNode(&ctx, ctx.typeId, ctx.id, std.time.timestamp() + read(u32, operation, 0));
                i += 5;
            },
        }
    }

    Db.expire(&ctx);
    writeoutPrevNodeId(&ctx, &resultLen, ctx.id, result);
    write(result, resultLen, 0);

    if (resultLen < expectedLen) {
        @memset(result[resultLen..expectedLen], 0);
    }

    const newDirtyRanges = ctx.dirtyRanges.values();
    const dirtyRangesSize: u32 = @truncate(newDirtyRanges.len * 8);

    var blocksOffset = resultLen + 4;
    blocksOffset = 7 - (blocksOffset % 8);
    const blockSlice = try Thread.sliceFromResult(false, threadCtx, 4 + blocksOffset + dirtyRangesSize);
    const newDirtySlice: []u8 = std.mem.sliceAsBytes(newDirtyRanges);
    write(blockSlice, dirtyRangesSize, 0);
    utils.copy(u8, blockSlice, newDirtySlice, 4 + blocksOffset);
}
