const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../lmdb/db.zig");
const dbSort = @import("../lmdb/sort.zig");

pub fn modify(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return modifyInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

// MDB_APPEND

fn modifyInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    // format == key: KEY_LEN bytes | size: 2 bytes | content: size bytes
    // [SIZE 2 bytes] | [1 byte operation] | []
    const args = try napi.getArgs(3, env, info);
    const batch = try napi.getBuffer("modifyBatch", env, args[0]);
    const size = try napi.getInt32("batchSize", env, args[1]);

    if (!Envs.dbEnvIsDefined) {
        return error.MDN_ENV_UNDEFINED;
    }
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const allocator = arena.allocator();
    var shards = std.AutoHashMap([6]u8, db.Shard).init(allocator);
    var sortIndexes = std.AutoHashMap([7]u8, dbSort.SortIndex).init(allocator);

    const txn = try db.createTransaction(false);

    var i: usize = 0;
    var keySize: u8 = undefined;
    var field: u8 = undefined;
    var typePrefix: [2]u8 = undefined;
    var id: u32 = undefined;
    var currentShard: [2]u8 = .{ 0, 0 };

    // hasSortIndex {}
    // type has sortIndex
    // field !main has sortIndex
    // main

    var currentSortIndex: ?dbSort.SortIndex = null;
    var sortIndexName: [7]u8 = undefined;
    // sortIndexes

    while (i < size) {
        // delete
        const operation = batch[i];
        if (operation == 0) {
            // SWITCH FIELD
            field = batch[i + 1];
            keySize = batch[i + 2];
            i = i + 1 + 2;
            if (field != 0) {
                sortIndexName = dbSort.createSortName(typePrefix, field, 0);
                if (dbSort.hasReadSortIndex(sortIndexName)) {
                    currentSortIndex = sortIndexes.get(sortIndexName);
                    if (currentSortIndex == null) {
                        currentSortIndex = dbSort.createWriteSortIndex(sortIndexName, 0, 0, txn);
                        try sortIndexes.put(sortIndexName, currentSortIndex.?);
                    }
                } else {
                    currentSortIndex = null;
                }
            } else {
                currentSortIndex = null;
            }
        } else if (operation == 1) {
            // SWITCH KEY
            id = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
            currentShard = @bitCast(db.idToShard(id));
            i = i + 1 + 4;
        } else if (operation == 2) {
            // SWITCH TYPE
            typePrefix[0] = batch[i + 1];
            typePrefix[1] = batch[i + 2];
            i = i + 1 + 2;
        } else if (operation == 3) {
            // CREATE
            const operationSize = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
            const dbiName = db.createDbiName(typePrefix, field, currentShard);
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
                const data = batch[i + 5 .. i + 5 + operationSize];
                var k: c.MDB_val = .{ .mv_size = keySize, .mv_data = &id };
                var v: c.MDB_val = .{ .mv_size = operationSize, .mv_data = data.ptr };
                // TODO: only if 3! c.MDB_APPEND
                errors.mdbCheck(c.mdb_cursor_put(shard.?.cursor, &k, &v, 0)) catch {};
                if (field == 0) {
                    if (dbSort.hasMainSortIndexes(typePrefix)) {
                        const s: ?*dbSort.StartSet = dbSort.mainSortIndexes.get(typePrefix);
                        var it = s.?.*.keyIterator();
                        while (it.next()) |key| {
                            const start = key.*;
                            sortIndexName = dbSort.createSortName(typePrefix, field, start);
                            const readSortIndex = dbSort.getReadSortIndex(sortIndexName);
                            const len = readSortIndex.?.len;
                            var sIndex = sortIndexes.get(sortIndexName);
                            if (sIndex == null) {
                                sIndex = dbSort.createWriteSortIndex(sortIndexName, len, start, txn);
                                try sortIndexes.put(sortIndexName, sIndex.?);
                            }
                            var indexValue: c.MDB_val = .{
                                .mv_size = len,
                                .mv_data = data[start .. start + len].ptr,
                            };
                            dbSort.writeToSortIndex(
                                &indexValue,
                                &k,
                                sIndex.?.start,
                                len,
                                sIndex.?.cursor,
                                field,
                            ) catch {};
                        }
                    }
                } else if (currentSortIndex != null) {
                    dbSort.writeToSortIndex(
                        &v,
                        &k,
                        currentSortIndex.?.start,
                        currentSortIndex.?.len,
                        currentSortIndex.?.cursor,
                        field,
                    ) catch {};
                }
            }
            i = i + operationSize + 1 + 4;
        } else if (operation == 4) {
            // DELETE
            const dbiName = db.createDbiName(typePrefix, field, currentShard);
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
            const dbiName = db.createDbiName(typePrefix, field, currentShard);
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
                var currentData: []u8 = undefined;
                if (v.mv_size != 0) {
                    currentData = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
                    const mergeMain: []u8 = batch[i + 5 .. i + 5 + operationSize];
                    var j: usize = 0;
                    while (j < mergeMain.len) {
                        const start = std.mem.readInt(u16, mergeMain[j..][0..2], .little);
                        // start
                        const len = std.mem.readInt(u16, mergeMain[j..][2..4], .little);
                        @memcpy(currentData[start .. start + len], mergeMain[j + 4 .. j + 4 + len]);
                        j += 4 + len;
                    }
                } else {
                    std.log.err("Main not created for update \n", .{});
                }
            }
            i += operationSize + 7;
        } else if (operation == 6) {
            // UPDATE WHOLE FIELD
            const operationSize = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
            const dbiName = db.createDbiName(typePrefix, field, currentShard);
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
                const data = batch[i + 5 .. i + 5 + operationSize];
                var k: c.MDB_val = .{ .mv_size = keySize, .mv_data = &id };
                var v: c.MDB_val = undefined;
                // TODO: only if 3! c.MDB_APPEND

                //  if (field == 0) {
                //     // --- make fn to reuse
                // } else
                if (currentSortIndex != null) {
                    v = .{ .mv_size = 0, .mv_data = null };
                    errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, 0)) catch {};

                    if (v.mv_size != 0) {
                        const currentData: []u8 = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];

                        std.debug.print("currentData {any} \n", .{currentData});
                    }

                    // const readSortIndex = dbSort.getReadSortIndex(sortIndexName);

                    dbSort.writeToSortIndex(
                        &v,
                        &k,
                        currentSortIndex.?.start,
                        currentSortIndex.?.len,
                        currentSortIndex.?.cursor,
                        field,
                    ) catch {};
                } else {
                    v = .{ .mv_size = operationSize, .mv_data = data.ptr };
                    errors.mdbCheck(c.mdb_cursor_put(shard.?.cursor, &k, &v, 0)) catch {};
                }
            }
            i = i + operationSize + 1 + 4;
        } else {
            std.log.err("Something went wrong, incorrect modify operation\n", .{});
            break;
        }
    }

    // var it = shards.iterator();
    // while (it.next()) |shard| {
    //     db.closeCursor(shard.value_ptr);
    // }
    try errors.mdbCheck(c.mdb_txn_commit(txn));

    return null;
}
