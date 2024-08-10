const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const dbSort = @import("../db/sort.zig");
const ModifyCtx = @import("./ctx.zig").ModifyCtx;

pub fn updateField(ctx: ModifyCtx, i: usize, batch: []u8) usize {
    // UPDATE WHOLE FIELD
    const operationSize = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
    const dbiName = db.createDbiName(ctx.typeId, ctx.field, ctx.currentShard);
    var shard = ctx.shards.get(dbiName);
    if (shard == null) {
        shard = db.openShard(true, dbiName, ctx.txn) catch null;
        if (shard != null) {
            ctx.shards.put(dbiName, shard.?) catch {
                shard = null;
            };
        }
    }
    if (shard != null) {
        const data = batch[i + 5 .. i + 5 + operationSize];
        var k: c.MDB_val = .{ .mv_size = ctx.keySize, .mv_data = @constCast(&ctx.id) };
        var v: c.MDB_val = .{ .mv_size = data.len, .mv_data = data.ptr };
        // if (field == 0) {
        //     if (dbSort.hasMainSortIndexes(typePrefix)) {
        //         var currentValue: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        //         const s: ?*dbSort.StartSet = dbSort.mainSortIndexes.get(typePrefix);
        //         var it = s.?.*.keyIterator();
        //         errors.mdb(c.mdb_cursor_get(shard.?.cursor, &k, &currentValue, c.MDB_SET)) catch {};
        //         const currentData: []u8 = @as([*]u8, @ptrCast(currentValue.mv_data))[0..currentValue.mv_size];
        //         while (it.next()) |key| {
        //             const start = key.*;
        //             sortIndexName = dbSort.createSortName(typePrefix, field, start);
        //             const readSortIndex = dbSort.getReadSortIndex(sortIndexName);
        //             const len = readSortIndex.?.len;
        //             var sIndex = sortIndexes.get(sortIndexName);
        //             if (sIndex == null) {
        //                 sIndex = dbSort.createWriteSortIndex(sortIndexName, len, start, txn);
        //                 try sortIndexes.put(sortIndexName, sIndex.?);
        //             }
        //             var sortValue: c.MDB_val = .{ .mv_size = len, .mv_data = currentData[start .. start + len].ptr };
        //             var sortKey: c.MDB_val = .{ .mv_size = k.mv_size, .mv_data = k.mv_data };
        //             errors.mdb(c.mdb_cursor_get(sIndex.?.cursor, &sortValue, &sortKey, c.MDB_GET_BOTH)) catch {};
        //             errors.mdb(c.mdb_cursor_del(sIndex.?.cursor, 0)) catch {};
        //             dbSort.writeToSortIndex(
        //                 &v,
        //                 &k,
        //                 start,
        //                 len,
        //                 sIndex.?.cursor,
        //                 field,
        //             ) catch {};
        //         }
        //     }
        // } else if (currentSortIndex != null) {
        //     var currentValue: c.MDB_val = .{
        //         .mv_size = 0,
        //         .mv_data = null,
        //     };
        //     errors.mdb(c.mdb_cursor_get(shard.?.cursor, &k, &currentValue, c.MDB_SET)) catch {};
        //     if (v.mv_size != 0) {
        //         const currentData: []u8 = @as([*]u8, @ptrCast(currentValue.mv_data))[0..currentValue.mv_size];
        //         var sortValue: c.MDB_val = .{ .mv_size = currentValue.mv_size, .mv_data = currentData.ptr };
        //         var sortKey: c.MDB_val = .{ .mv_size = k.mv_size, .mv_data = k.mv_data };
        //         if (currentData.len > 16) {
        //             sortValue.mv_data = currentData[0..16].ptr;
        //         }
        //         errors.mdb(c.mdb_cursor_get(currentSortIndex.?.cursor, &sortValue, &sortKey, c.MDB_GET_BOTH)) catch {};
        //         errors.mdb(c.mdb_cursor_del(currentSortIndex.?.cursor, 0)) catch {};
        //     }
        //     dbSort.writeToSortIndex(
        //         &v,
        //         &k,
        //         currentSortIndex.?.start,
        //         currentSortIndex.?.len,
        //         currentSortIndex.?.cursor,
        //         field,
        //     ) catch {};
        // }

        errors.mdb(c.mdb_cursor_put(shard.?.cursor, &k, &v, 0)) catch {};
    }
    return operationSize + 1 + 4;
}

pub fn updatePartialField(ctx: ModifyCtx, i: usize, batch: []u8) usize {
    // UPDATE OFFSETS
    const operationSize = std.mem.readInt(u32, batch[i + 1 ..][0..4], .little);
    const dbiName = db.createDbiName(ctx.typeId, ctx.field, ctx.currentShard);
    var shard = ctx.shards.get(dbiName);
    if (shard == null) {
        shard = db.openShard(true, dbiName, ctx.txn) catch null;
        if (shard != null) {
            ctx.shards.put(dbiName, shard.?) catch {
                shard = null;
            };
        }
    }
    if (shard != null) {
        var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&ctx.id) };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        errors.mdb(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {};
        var currentData: []u8 = undefined;
        if (v.mv_size != 0) {
            currentData = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
            const mergeOperation: []u8 = batch[i + 5 .. i + 5 + operationSize];
            var j: usize = 0;
            while (j < mergeOperation.len) {
                const start = std.mem.readInt(u16, mergeOperation[j..][0..2], .little);
                const len = std.mem.readInt(u16, mergeOperation[j..][2..4], .little);
                // field === 0
                // if (dbSort.hasMainSortIndexes(typePrefix)) {
                //     sortIndexName = dbSort.createSortName(typePrefix, field, start);
                //     if (dbSort.hasReadSortIndex(sortIndexName)) {
                //         var sIndex = sortIndexes.get(sortIndexName);
                //         if (sIndex == null) {
                //             sIndex = dbSort.createWriteSortIndex(sortIndexName, len, start, txn);
                //             try sortIndexes.put(sortIndexName, sIndex.?);
                //         }
                //         var sortValue: c.MDB_val = .{ .mv_size = len, .mv_data = currentData[start .. start + len].ptr };
                //         var sortKey: c.MDB_val = .{ .mv_size = k.mv_size, .mv_data = k.mv_data };
                //         errors.mdb(c.mdb_cursor_get(sIndex.?.cursor, &sortValue, &sortKey, c.MDB_GET_BOTH)) catch {};
                //         errors.mdb(c.mdb_cursor_del(sIndex.?.cursor, 0)) catch {};
                //         var indexValue: c.MDB_val = .{ .mv_size = len, .mv_data = mergeOperation[j + 4 .. j + 4 + len].ptr };
                //         dbSort.writeToSortIndex(
                //             &indexValue,
                //             &k,
                //             start,
                //             0,
                //             sIndex.?.cursor,
                //             field,
                //         ) catch {};
                //     }
                // }
                // later
                @memcpy(currentData[start .. start + len], mergeOperation[j + 4 .. j + 4 + len]);
                j += 4 + len;
            }
        } else {
            std.log.err("Main not created for update \n", .{});
        }
    }
    return operationSize + 7;
}
