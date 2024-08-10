const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const dbSort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const readInt = @import("../utils.zig").readInt;

const ModifyCtx = Modify.ModifyCtx;
const getShard = Modify.getShard;

pub fn updateField(ctx: ModifyCtx, batch: []u8) usize {
    // UPDATE WHOLE FIELD
    const operationSize = readInt(u32, batch, 0);
    const size = operationSize + 4;
    const shard = getShard(ctx);
    if (shard == null) {
        return size;
    }
    db.writeField(ctx.id, batch[4..size], shard) catch {};
    return size;

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

}

pub fn updatePartialField(ctx: ModifyCtx, batch: []u8) usize {
    const operationSize = readInt(u32, batch, 0);
    const size = operationSize + 6;
    const shard = getShard(ctx);
    if (shard == null) {
        return size;
    }
    var currentData = db.readField(ctx.id, shard);

    if (currentData.len != 0) {
        const mergeOperation: []u8 = batch[4 .. 4 + operationSize];
        var j: usize = 0;
        while (j < mergeOperation.len) {
            const start = readInt(u16, mergeOperation[j..], 0);
            const len = readInt(u16, mergeOperation[j..], 2);

            // if (dbSort.hasMainSortIndexes(ctx.typeId)) {
            //     sortIndexName = dbSort.createSortName(typePrefix, field, start);
            //     if (dbSort.hasReadSortIndex(sortIndexName)) {
            //         var sIndex = sortIndexes.get(sortIndexName);
            //         if (sIndex == null) {
            //             sIndex = dbSort.createWriteSortIndex(sortIndexName, len, start, txn);
            //             try sortIndexes.put(sortIndexName, sIndex.?);
            //         }
            //         var sortValue: c.MDB_val = .{ .mv_size = len, .mv_data = currentData[start .. start + len].ptr };
            //         var sortKey: c.MDB_val = .{ .mv_size = k.mv_size, .mv_data = k.mv_data };
            //         errors.mdbCheck(c.mdb_cursor_get(sIndex.?.cursor, &sortValue, &sortKey, c.MDB_GET_BOTH)) catch {};
            //         errors.mdbCheck(c.mdb_cursor_del(sIndex.?.cursor, 0)) catch {};
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

            @memcpy(currentData[start .. start + len], mergeOperation[j + 4 .. j + 4 + len]);
            j += 4 + len;
        }
    }

    return operationSize + 6;
}
