const assert = std.debug.assert;
const std = @import("std");
const c = @import("../c.zig");
const selva = @import("../selva.zig");
const types = @import("../types.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const Modify = @import("./ctx.zig");
const createField = @import("./create.zig").createField;
const deleteFieldSortIndex = @import("./delete.zig").deleteFieldSortIndex;
const deleteField = @import("./delete.zig").deleteField;
const deleteTextLang = @import("./delete.zig").deleteTextLang;

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

pub fn modify(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    var result: c.napi_value = undefined;
    var resCount: u32 = 0;
    modifyInternal(env, info, &resCount) catch undefined;
    _ = c.napi_create_uint32(env, resCount * 5, &result);
    return result;
}

fn modifyInternal(env: c.napi_env, info: c.napi_callback_info, resCount: *u32) !void {
    const args = try napi.getArgs(4, env, info);
    const batch = try napi.get([]u8, env, args[0]);
    const dbCtx = try napi.get(*db.DbCtx, env, args[1]);
    const dirtyRanges = try napi.get([]f64, env, args[2]);

    var i: usize = 0;
    var ctx: ModifyCtx = .{ .field = undefined, .typeId = 0, .id = 0, .currentSortIndex = null, .typeSortIndex = null, .node = null, .typeEntry = null, .fieldSchema = null, .fieldType = types.Prop.NULL, .db = dbCtx, .dirtyRanges = std.AutoArrayHashMap(u64, f64).init(dbCtx.allocator), .batch = batch };

    defer ctx.dirtyRanges.deinit();
    var offset: u32 = 0;

    while (i < batch.len) {
        const op: types.ModOp = @enumFromInt(batch[i]);
        const operation: []u8 = batch[i + 1 ..];
        // std.debug.print("op: {any}\n", .{op});
        switch (op) {
            types.ModOp.PADDING => {
                i = i + 1;
            },
            types.ModOp.SWITCH_FIELD => {
                // Wrongly here.. lets find it...
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
                    db.deleteNode(&ctx, ctx.typeEntry.?, node) catch {};
                    // no other side handled
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
                if (ctx.id != 0) {
                    writeInt(u32, batch, resCount.* * 5, ctx.id);
                    resCount.* += 1;
                }
                ctx.id = dbCtx.ids[ctx.typeId - 1] + 1;
                dbCtx.ids[ctx.typeId - 1] = ctx.id;
                ctx.node = try db.upsertNode(&ctx, ctx.typeEntry.?,  ctx.id);
                Modify.markDirtyRange(&ctx, ctx.typeId, ctx.id);
                i = i + 1;
            },
            types.ModOp.SWITCH_ID_CREATE_UNSAFE => {
                if (ctx.id != 0) {
                    writeInt(u32, batch, resCount.* * 5, ctx.id);
                    resCount.* += 1;
                }
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
                    if (ctx.id != 0) {
                        writeInt(u32, batch, resCount.* * 5, ctx.id);
                        resCount.* += 1;
                    }
                    // if its zero then we don't want to switch (for upsert)
                    ctx.id = id;
                    ctx.node = db.getNode(ctx.typeEntry.?, ctx.id);
                    if (ctx.node != null) {
                        // It would be even better if we'd mark it dirty only in the case
                        // something was actually changed.
                        Modify.markDirtyRange(&ctx, ctx.typeId, ctx.id);
                    }
                }
                i = i + 5;
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
                        resCount.* += 1;
                        nextIndex = endIndex;
                        break;
                    }
                    j = j + 5 + len;
                }
                i = i + nextIndex + 1;
            },
            types.ModOp.SWITCH_TYPE => {
                ctx.typeId = read(u16, operation, 0);
                ctx.typeEntry = try db.getType(ctx.db, ctx.typeId);
                ctx.typeSortIndex = dbSort.getTypeSortIndexes(ctx.db, ctx.typeId);
                // RFE shouldn't we technically unset .id and .node now?
                ctx.node = null;
                // TODO This can't be reset because it's used just at the end of the function.
                //ctx.id = 0;
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
                i += try updatePartialField(&ctx, operation) + offset;
            },
            types.ModOp.INCREMENT, types.ModOp.DECREMENT => {
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

    const newDirtyRanges = ctx.dirtyRanges.values();
    assert(newDirtyRanges.len < dirtyRanges.len);
    _ = c.memcpy(dirtyRanges.ptr, newDirtyRanges.ptr, newDirtyRanges.len * 8);
    dirtyRanges[newDirtyRanges.len] = 0.0;
    if (ctx.id != 0) {
        writeInt(u32, batch, resCount.* * 5, ctx.id);
        resCount.* += 1;
    }
}
