const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const createField = @import("./create.zig").createField;
const deleteField = @import("./delete.zig").deleteField;
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
    const batch = try napi.getBuffer("modifyBatch", env, args[0]);
    const size = try napi.getInt32("batchSize", env, args[1]);

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const allocator = arena.allocator();

    const txn = try db.createTransaction(false);

    var i: usize = 0;

    var ctx: ModifyCtx = .{
        .field = undefined,
        .typeId = undefined,
        .id = undefined,
        .currentShard = 0,
        .txn = txn.?,
        .currentSortIndex = null,
        .shards = db.Shards.init(allocator),
        .sortIndexes = sort.Indexes.init(allocator),
    };

    while (i < size) {
        // delete
        const operationType = batch[i];
        const operation = batch[i + 1 ..];
        if (operationType == 0) {
            // SWITCH FIELD
            ctx.field = operation[0];
            i = i + 2;
            if (ctx.field != 0) {
                ctx.currentSortIndex = try getSortIndex(&ctx, 0);
            } else {
                ctx.currentSortIndex = null;
            }
        } else if (operationType == 1) {
            // SWITCH KEY
            ctx.id = readInt(u32, operation, 0);
            ctx.currentShard = db.idToShard(ctx.id);
            i = i + 5;
        } else if (operationType == 2) {
            // SWITCH TYPE
            ctx.typeId[0] = batch[i + 1];
            ctx.typeId[1] = batch[i + 2];
            i = i + 3;
        } else if (operationType == 3) {
            i += try createField(&ctx, operation) + 1;
        } else if (operationType == 4) {
            i += try deleteField(&ctx) + 1;
        } else if (operationType == 5) {
            i += try updatePartialField(&ctx, operation) + 1;
        } else if (operationType == 6) {
            i += try updateField(&ctx, operation) + 1;
        } else {
            std.log.err("Something went wrong, incorrect modify operation\n", .{});
            break;
        }
    }

    try db.commitTxn(txn);

    return null;
}
