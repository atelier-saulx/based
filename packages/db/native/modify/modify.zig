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
const errors = @import("../errors.zig");

pub fn modify(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return modifyInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

fn modifyInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(4, env, info);
    const batch = try napi.get([]u8, env, args[0]);
    const typeInfo = try napi.get([]u8, env, args[1]);
    const dbCtx = try napi.get(*db.DbCtx, env, args[2]);
    const dirtyRanges = try napi.get([]f64, env, args[3]);

    var i: usize = 0;
    var ctx: ModifyCtx = .{
        .field = undefined,
        .typeId = undefined,
        .id = undefined,
        .currentSortIndex = null,
        .typeSortIndex = null,
        .node = null,
        .typeEntry = null,
        .fieldSchema = null,
        .fieldType = types.Prop.NULL,
        .db = dbCtx,
        .typeInfo = typeInfo,
        .dirtyRanges = std.AutoArrayHashMap(u64, f64).init(dbCtx.allocator),
    };
    defer ctx.dirtyRanges.deinit();

    var offset: u32 = 0;
    var idOffset: u32 = 0;

    while (i < batch.len) {
        const op: types.ModOp = @enumFromInt(batch[i]);
        const operation: []u8 = batch[i + 1 ..];

        switch (op) {
            types.ModOp.SWITCH_FIELD => {
                // Wrongly here.. lets find it...
                ctx.field = operation[0];
                i = i + 3;
                ctx.fieldSchema = try db.getFieldSchema(ctx.field, ctx.typeEntry.?);
                ctx.fieldType = @enumFromInt(operation[1]);
                if (ctx.fieldType == types.Prop.REFERENCE) {
                    offset = 1;
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
                    db.deleteNode(ctx.db, ctx.typeEntry.?, node) catch {};
                    ctx.node = null;
                }
                i = i + 1;
            },
            types.ModOp.CREATE_OR_GET => {
                // dont want upsert
                if (config.enable_debug) {
                    // Only assert this on DEBUG scince it makes it a lot slower
                    ctx.id = std.math.add(u32, read(u32, operation, 0), idOffset) catch |err| {
                        std.log.err("Overflow ID error (modify create or get) id: {d} offset: {d} in modify", .{ read(u32, operation, 0), idOffset });
                        return err;
                    };
                    if (ctx.id == 0) {
                        std.log.err("ID == 0 error (modify create or get) id: {d} offset: {d} in modify", .{ read(u32, operation, 0), idOffset });
                        return errors.SelvaError.SELVA_EINVAL;
                    }
                }
                ctx.id = read(u32, operation, 0) + idOffset;
                // we can put get here
                ctx.node = try db.upsertNode(ctx.id, ctx.typeEntry.?);
                i = i + 5;
            },
            types.ModOp.SWITCH_NODE => {
                ctx.id = read(u32, operation, 0);
                ctx.node = db.getNode(ctx.id, ctx.typeEntry.?);
                i = i + 5;
            },
            types.ModOp.SWITCH_TYPE => {
                ctx.typeId = read(u16, operation, 0);
                ctx.typeEntry = try db.getType(ctx.db, ctx.typeId);
                ctx.typeSortIndex = dbSort.getTypeSortIndexes(ctx.db, ctx.typeId);
                // store offset for this type
                idOffset = Modify.getIdOffset(&ctx, ctx.typeId);
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
                selva.selva_expire_node(dbCtx.selva, ctx.typeId, ctx.id, std.time.timestamp() + read(u32, operation, 0));
                i += 5;
            },
            else => {
                std.log.err("Something went wrong, incorrect modify operation. At i: {d} len: {d}\n", .{ i, batch.len });
                break;
            },
        }
    }

    // Pass back newly discovered dirty blocks
    const newDirtyRanges = ctx.dirtyRanges.values();
    assert(newDirtyRanges.len < dirtyRanges.len);
    _ = c.memcpy(dirtyRanges.ptr, newDirtyRanges.ptr, newDirtyRanges.len * 8);
    dirtyRanges[newDirtyRanges.len] = 0.0;
    selva.selva_db_expire_tick(dbCtx.selva, std.time.timestamp());
    // mark dirty bussiness

    return null;
}
