const std = @import("std");
const c = @import("../c.zig");
const selva = @import("../selva.zig");
const types = @import("../types.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const Modify = @import("./ctx.zig");
const createField = @import("./create.zig").createField;
const deleteField = @import("./delete.zig").deleteField;
const deleteFieldOnly = @import("./delete.zig").deleteFieldOnly;
const deleteFieldOnlyReal = @import("./delete.zig").deleteFieldOnlyReal;
const addEmptyToSortIndex = @import("./sort.zig").addEmptyToSortIndex;
const readInt = @import("../utils.zig").readInt;
const Update = @import("./update.zig");
const ModifyCtx = Modify.ModifyCtx;
const updateField = Update.updateField;
const updatePartialField = Update.updatePartialField;
const dbSort = @import("../db//sort.zig");
const increment = Update.increment;

pub fn modify(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return modifyInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

fn modifyInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const batch = try napi.get([]u8, env, args[0]);
    const dbCtx = try napi.get(*db.DbCtx, env, args[1]);

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
    };

    var offset: u32 = 0;
    while (i < batch.len) {
        const op: types.ModOp = @enumFromInt(batch[i]);
        const operation: []u8 = batch[i + 1 ..];
        switch (op) {
            types.ModOp.SWITCH_FIELD => {
                // SWITCH FIELD
                ctx.field = operation[0];
                i = i + 2;

                if (ctx.field != 0) {
                    ctx.currentSortIndex = dbSort.getSortIndex(ctx.typeSortIndex, ctx.field, 0);
                } else {
                    ctx.currentSortIndex = null;
                }

                ctx.fieldSchema = try db.getFieldSchema(ctx.field, ctx.typeEntry.?);
                ctx.fieldType = @enumFromInt(ctx.fieldSchema.?.*.type);
                if (ctx.fieldType == types.Prop.REFERENCE) {
                    offset = 1;
                } else {
                    offset = 5;
                }
            },
            types.ModOp.DELETE_NODE => {
                db.deleteNode(ctx.db, ctx.typeEntry.?, ctx.node.?) catch {};
                i = i + 1;
            },
            types.ModOp.CREATE_OR_GET => {
                // create or get
                ctx.id = readInt(u32, operation, 0);
                ctx.node = try db.upsertNode(ctx.id, ctx.typeEntry.?);
                i = i + 5;
            },
            types.ModOp.SWITCH_NODE => {
                // SWITCH ID/NODE
                ctx.id = readInt(u32, operation, 0);
                ctx.node = db.getNode(ctx.id, ctx.typeEntry.?);
                i = i + 5;
            },
            types.ModOp.SWITCH_TYPE => {
                // SWITCH TYPE
                ctx.typeId = readInt(u16, operation, 0);
                ctx.typeEntry = try db.getType(ctx.db, ctx.typeId);
                ctx.typeSortIndex = dbSort.getTypeSortIndexes(ctx.db, ctx.typeId);
                i = i + 3;
            },
            types.ModOp.ADD_EMPTY_SORT => {
                i += try addEmptyToSortIndex(&ctx, operation) + 1;
            },
            types.ModOp.DELETE_PROP_ONLY => {
                i += try deleteFieldOnly(&ctx) + 1;
            },
            types.ModOp.DELETE_PROP_ONLY_REAL => {
                i += try deleteFieldOnlyReal(&ctx) + 1;
            },
            types.ModOp.DELETE_PROP => {
                // special case
                i += try deleteField(&ctx) + 1;
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
            else => {
                std.log.err("Something went wrong, incorrect modify operation. At i: {d} len: {d}\n", .{ i, batch.len });
                break;
            },
        }
    }

    return null;
}
