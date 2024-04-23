const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const globals = @import("../globals.zig");
const napi = @import("../napi.zig");
const db = @import("../db.zig");

pub fn modify(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return modifyInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

fn modifyInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    // format == key: KEY_LEN bytes | size: 2 bytes | content: size bytes
    // [SIZE 2 bytes] | [1 byte operation] | []

    const args = try napi.getArgs(2, env, info);
    const batch = try napi.getBuffer("modifyBatch", env, args[0]);
    const size = try napi.getInt32("batchSize", env, args[1]);

    if (!Envs.dbEnvIsDefined) {
        return error.MDN_ENV_UNDEFINED;
    }

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    var shards = std.AutoHashMap([3]u8, db.Shard).init(allocator);
    defer {
        var it = shards.iterator();
        while (it.next()) |shard| {
            db.closeShard(shard.value_ptr);
        }
    }
    const txn = try db.createTransaction(false);

    var i: usize = 0;
    var keySize: u8 = undefined;
    var field: u8 = undefined;
    var type_prefix: *[2]u8 = undefined;
    var id: u32 = undefined;

    // type_prefix: [2]u8, field: u8, shard: u8

    while (i < size) {
        const operation = batch[i];

        if (operation == 2) {
            // SWITCH TYPE
            type_prefix = batch[i + 1 ..][0..2];
            std.debug.print("got type selection type: {any}\n", .{type_prefix});
            i = i + 1 + 2;
        } else if (operation == 1) {
            // SWITCH KEY
            id = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
            std.debug.print("got id selection id: '{d}'\n", .{id});
            i = i + 1 + 4;
        } else if (operation == 0) {
            // SWITCH FIELD
            field = batch[i + 1];
            keySize = batch[i + 2];
            std.debug.print("got field selection keysize: {d} field: {d}\n", .{ keySize, field });
            i = i + 1 + 2;
        } else {
            const operationSize = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);

            std.debug.print("got operation size {d}\n", .{operationSize});

            i = i + operationSize + 1 + 4;
        }

        // const key = batch[i .. i + KEY_LEN];
        // const value = batch[i + KEY_LEN + SIZE_BYTES .. i + KEY_LEN + SIZE_BYTES + @as(usize, value_size)];
        // var k: c.MDB_val = .{ .mv_size = KEY_LEN, .mv_data = key.ptr };
        // var v: c.MDB_val = .{ .mv_size = value_size, .mv_data = value.ptr };
        // try mdbCheck(c.mdb_cursor_put(cursor, &k, &v, 0));
    }

    try errors.mdbCheck(c.mdb_txn_commit(txn));
    return null;
}
