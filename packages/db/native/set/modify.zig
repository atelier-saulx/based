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

    var shards = std.AutoHashMap([5]u8, db.Shard).init(allocator);
    defer {
        var it = shards.iterator();
        while (it.next()) |shard| {
            db.closeDbi(shard.value_ptr);
        }
    }

    const txn = try db.createTransaction(false);

    var i: usize = 0;
    var keySize: u8 = undefined;
    var field: u8 = undefined;
    var type_prefix: [2]u8 = undefined;
    var id: u32 = undefined;
    var currentShard: [2]u8 = .{ 0, 0 };

    while (i < size) {
        // delete
        const operation = batch[i];
        if (operation == 0) {
            // SWITCH FIELD
            field = batch[i + 1];
            keySize = batch[i + 2];
            i = i + 1 + 2;
        } else if (operation == 1) {
            // SWITCH KEY
            id = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
            currentShard = @bitCast(db.idToShard(id));
            i = i + 1 + 4;
        } else if (operation == 2) {
            // SWITCH TYPE
            type_prefix[0] = batch[i + 1];
            type_prefix[1] = batch[i + 2];
            i = i + 1 + 2;
        } else if (operation == 3) {
            // PUT
            const operationSize = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
            const dbiName = db.createDbiName(type_prefix, field, currentShard);

            var shard = shards.get(dbiName);
            if (shard == null) {
                shard = db.openShard(true, dbiName, txn) catch null;
                if (shard != null) {
                    shards.put(dbiName, shard.?) catch {
                        shard = null;
                    };
                }
            }
            if (shard != null) {
                var k: c.MDB_val = .{ .mv_size = keySize, .mv_data = &id };
                var v: c.MDB_val = .{ .mv_size = operationSize, .mv_data = batch[i + 5 .. i + 5 + operationSize].ptr };
                errors.mdbCheck(c.mdb_cursor_put(shard.?.cursor, &k, &v, 0)) catch {};
            }
            i = i + operationSize + 1 + 4;
        } else if (operation == 4) {
            // DELETE
            const dbiName = db.createDbiName(type_prefix, field, currentShard);
            var shard = shards.get(dbiName);
            if (shard == null) {
                shard = db.openShard(true, dbiName, txn) catch null;
                if (shard != null) {
                    shards.put(dbiName, shard.?) catch {
                        shard = null;
                    };
                }
            }
            if (shard != null) {
                var k: c.MDB_val = .{ .mv_size = keySize, .mv_data = &id };
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
                errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {};
                errors.mdbCheck(c.mdb_cursor_del(shard.?.cursor, 0)) catch {};
            }
            i = i + 1;
        } else if (operation == 5) {
            // UPDATE OFFSETS
            const operationSize = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
            const dbiName = db.createDbiName(type_prefix, field, currentShard);
            var shard = shards.get(dbiName);
            if (shard == null) {
                shard = db.openShard(true, dbiName, txn) catch null;
                if (shard != null) {
                    shards.put(dbiName, shard.?) catch {
                        shard = null;
                    };
                }
            }
            if (shard != null) {
                var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
                errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {};
                var mainBuffer: []u8 = undefined;
                if (v.mv_size != 0) {
                    mainBuffer = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
                    const mergeMain: []u8 = batch[i + 5 .. i + 5 + operationSize];
                    var j: usize = 0;
                    while (j < mergeMain.len) {
                        const start = std.mem.readInt(u16, mergeMain[j..][0..2], .little);
                        const len = std.mem.readInt(u16, mergeMain[j..][2..4], .little);

                        var x: usize = 0;
                        while (x < len) {
                            const b = mergeMain[j + 4 + x];
                            x += 1;

                            // const b2 = mainBuffer[start + x];

                            mainBuffer[start + x] = b;

                            // std.debug.print("BYTE:{any} MMAP BYTE:{any} \n", .{ b, b2 });
                        }

                        // @memcpy(mainBuffer[start .. start + len], mergeMain[j + 4 .. j + 4 + len]);
                        j += 4 + len;
                    }
                    // std.debug.print("MAIN BUF NEW {any} MERGE {any} \n", .{ mainBuffer, mergeMain });
                    // errors.mdbCheck(c.mdb_cursor_put(shard.?.cursor, &k, &v, 0)) catch {
                    //     std.log.err("Setting main field in update {d}!\n", .{id});
                    // };
                } else {
                    // include mainLen!
                    std.log.err("No main defined {d}!\n", .{id});
                }
            }
            i = i + operationSize + 1 + 4;
        } else {
            // ADD MERGE (only for MAIN)
            std.log.err("Something went wrong, incorrect modify operation\n", .{});
            break;
        }
    }

    var it = shards.iterator();
    while (it.next()) |shard| {
        db.closeCursor(shard.value_ptr);
    }

    try errors.mdbCheck(c.mdb_txn_commit(txn));

    return null;
}
