const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const dbSort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const createField = @import("./create.zig").createField;
const deleteField = @import("./delete.zig").deleteField;
const Update = @import("./update.zig");

const ModifyCtx = Modify.ModifyCtx;
const getShard = Modify.getShard;

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
    var shards = std.AutoHashMap([6]u8, db.Shard).init(allocator);
    // var sortIndexes = std.AutoHashMap([7]u8, dbSort.SortIndex).init(allocator);

    const txn = try db.createTransaction(false);

    var i: usize = 0;

    // var currentSortIndex: ?dbSort.SortIndex = null;
    // var sortIndexName: [7]u8 = undefined;

    var ctx: ModifyCtx = .{
        .field = undefined,
        .typeId = undefined,
        .id = undefined,
        .currentShard = 0,
        .shards = &shards,
        .txn = txn.?,
    };

    while (i < size) {
        // delete
        const operationType = batch[i];
        const operation = batch[i + 1 ..];
        if (operationType == 0) {
            // SWITCH FIELD
            ctx.field = operation[0];
            i = i + 2;
            // if (field != 0) {
            //     sortIndexName = dbSort.createSortName(typePrefix, field, 0);
            //     if (dbSort.hasReadSortIndex(sortIndexName)) {
            //         currentSortIndex = sortIndexes.get(sortIndexName);
            //         if (currentSortIndex == null) {
            //             currentSortIndex = dbSort.createWriteSortIndex(sortIndexName, 0, 0, txn);
            //             try sortIndexes.put(sortIndexName, currentSortIndex.?);
            //         }
            //     } else {
            //         currentSortIndex = null;
            //     }
            // } else {
            //     currentSortIndex = null;
            // }
        } else if (operationType == 1) {
            // SWITCH KEY
            ctx.id = std.mem.readInt(u32, operation[0..4], .little);
            ctx.currentShard = db.idToShard(ctx.id);
            i = i + 5;
        } else if (operationType == 2) {
            // SWITCH TYPE
            ctx.typeId[0] = batch[i + 1];
            ctx.typeId[1] = batch[i + 2];
            i = i + 3;
        } else if (operationType == 3) {
            i += createField(ctx, operation) + 1;
        } else if (operationType == 4) {
            i += deleteField(ctx) + 1;
        } else if (operationType == 5) {
            i += updatePartialField(ctx, operation) + 1;
        } else if (operationType == 6) {
            i += updateField(ctx, operation) + 1;
        } else {
            std.log.err("Something went wrong, incorrect modify operation\n", .{});
            break;
        }
    }

    try errors.mdb(c.mdb_txn_commit(txn));

    return null;
}
