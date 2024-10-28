const std = @import("std");
const c = @import("../c.zig");
const selva = @import("../selva.zig");
const types = @import("../types.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const createField = @import("./create.zig").createField;
const deleteField = @import("./delete.zig").deleteField;
const deleteFieldOnly = @import("./delete.zig").deleteFieldOnly;
const deleteFieldOnlyReal = @import("./delete.zig").deleteFieldOnlyReal;
const addEmptyToSortIndex = @import("./sort.zig").addEmptyToSortIndex;
const readInt = @import("../utils.zig").readInt;
const Update = @import("./update.zig");
const ModifyCtx = Modify.ModifyCtx;
const getShard = Modify.getShard;
const getSortIndex = Modify.getSortIndex;
const updateField = Update.updateField;
const updatePartialField = Update.updatePartialField;

pub fn modify(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return modifyInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

fn modifyInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(3, env, info);
    const batch = try napi.get([]u8, env, args[0]);
    const dbCtx = try napi.get(*db.DbCtx, env, args[1]);
    const state = try napi.get([]u32, env, args[2]);
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const allocator = arena.allocator();
    var i: usize = 0;
    var ctx: ModifyCtx = .{
        .field = undefined,
        .typeId = undefined,
        .id = undefined,
        .sortWriteTxn = null,
        .currentSortIndex = null,
        .sortIndexes = sort.Indexes.init(allocator),
        .node = null,
        .typeEntry = null,
        .fieldSchema = null,
        .fieldType = types.Prop.NULL,
        .db = dbCtx,
    };

    var offset: u32 = 0;

    while (i < batch.len) {
        // delete
        const op: types.ModOp = @enumFromInt(batch[i]);
        const operation: []u8 = batch[i + 1 ..];

        // std.debug.print("- op: {d}, fieldType: {any}, field: {d}\n", .{ op, ctx.fieldType, ctx.field });
        switch (op) {
            types.ModOp.SWITCH_FIELD => {
                // SWITCH FIELD
                ctx.field = operation[0];
                i = i + 2;
                if (ctx.field != 0) {
                    ctx.currentSortIndex = try getSortIndex(&ctx, 0);
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
                db.deleteNode(ctx.db, ctx.node.?, ctx.typeEntry.?) catch {};
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
                i = i + 3;
            },
            types.ModOp.ADD_EMPTY_SORT => {
                i += try addEmptyToSortIndex(&ctx, operation) + 1;
            },
            types.ModOp.DELETE_PROP_ONLY => {
                i += try deleteFieldOnly(&ctx) + 1;
            },
            types.ModOp.DELETE_PROP_ONLY_REAL => {
                // std.debug.print("delete field: {d}\n", .{ctx.field});
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
            else => {
                std.log.err("Something went wrong, incorrect modify operation\n", .{});
                break;
            },
        }

        state[0] = @intCast(i);
    }

    if (ctx.sortWriteTxn != null) {
        try sort.commitTxn(ctx.sortWriteTxn);
    }

    return null;
}
