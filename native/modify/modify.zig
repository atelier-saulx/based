const std = @import("std");
const napi = @import("../napi.zig");
const selva = @import("../selva/selva.zig").c;
const Schema = @import("../selva/schema.zig");
const Node = @import("../selva/node.zig");
const Fields = @import("../selva/fields.zig");
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
const dbSort = @import("../sort/sort.zig");
const config = @import("config");
const errors = @import("../errors.zig");
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
    const buf = try napi.get([]u8, env, args[0]);
    const dbCtx = try napi.get(*DbCtx, env, args[1]);
    try dbCtx.threads.modify(buf);
}
//  -----------------------

fn switchType(ctx: *ModifyCtx, typeId: u16) !void {
    ctx.typeId = typeId;
    ctx.typeEntry = try Node.getType(ctx.db, ctx.typeId);
    ctx.typeSortIndex = dbSort.getTypeSortIndexes(ctx.db, ctx.typeId);

    ctx.subTypes = ctx.thread.subscriptions.types.get(ctx.typeId);
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
        Node.flushNode(ctx, ctx.typeEntry.?, oldNode);
    } else {
        ctx.node = try Node.upsertNode(ctx, ctx.typeEntry.?, nextId);
    }

    ctx.id = nextId;
    ctx.db.ids[ctx.typeId - 1] = nextId;
    Modify.markDirtyRange(ctx, ctx.typeId, nextId);
}

fn getLargeRef(db: *DbCtx, node: Node.Node, fs: Schema.FieldSchema, dstId: u32) ?References.ReferenceLarge {
    if (dstId == 0) { // assume reference
        return References.getReference(node, fs);
    } else { // references
        if (References.getReferences(false, true, db, node, fs)) |iterator| {
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

pub fn writeData(ctx: *ModifyCtx, buf: []u8) !usize {
    var i: usize = 0;
    while (i < buf.len) {
        const op: t.ModOp = @enumFromInt(buf[i]);
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
                    subs.stage(ctx, subs.Op.deleteNode);
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
                Modify.markDirtyRange(ctx, ctx.typeId, ctx.id);
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
                        ctx.err = errors.ClientError.nx;
                    } else {
                        try subs.checkId(ctx);
                        // It would be even better if we'd mark it dirty only in the case
                        // something was actually changed.
                        Modify.markDirtyRange(ctx, ctx.typeId, ctx.id);
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
                        write(buf, errors.ClientError.null, ctx.resultLen + 4);
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
        }
    }
    return i;
}

pub fn modify(
    // comptime isSubscriptionWorker: bool,
    thread: *Thread.Thread,
    buf: []u8,
    dbCtx: *DbCtx,
    opType: t.OpType,
) !void {
    const modifyId = read(u32, buf, 0);
    const nodeCount = read(u32, buf, 13);
    const expectedLen = 4 + nodeCount * 5; // len(4)+res(5)n
    var ctx: ModifyCtx = .{
        .result = try thread.modify.result(expectedLen, modifyId, opType),
        .resultLen = 4,
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
        .buf = buf,
        .err = errors.ClientError.null,
        .idSubs = null,
        .subTypes = null,
        .thread = thread,
    };

    defer ctx.dirtyRanges.deinit();
    _ = try writeData(&ctx, buf[13 + 4 ..]);
    Node.expire(&ctx);
    writeoutPrevNodeId(&ctx, &ctx.resultLen, ctx.id, ctx.result);
    write(ctx.result, ctx.resultLen, 0);

    if (ctx.resultLen < expectedLen) {
        @memset(ctx.result[ctx.resultLen..expectedLen], 0);
    }

    const newDirtyRanges = ctx.dirtyRanges.values();
    const dirtyRangesSize: u32 = @truncate(newDirtyRanges.len * 8);
    const blockSlice = try thread.modify.slice(4 + dirtyRangesSize);
    const newDirtySlice: []u8 = std.mem.sliceAsBytes(newDirtyRanges);
    write(blockSlice, dirtyRangesSize, 0);
    utils.copy(u8, blockSlice, newDirtySlice, 4);
}
