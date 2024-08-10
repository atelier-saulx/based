const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const dbSort = @import("../db/sort.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");

const ModifyCtx = Modify.ModifyCtx;
const getShard = Modify.getShard;

pub fn createField(ctx: ModifyCtx, batch: []u8) usize {
    const operationSize = readInt(u32, batch, 0);
    const shard = getShard(ctx);
    if (shard == null) {
        return operationSize + 4;
    }
    db.writeField(ctx.id, batch[4 .. 4 + operationSize], shard) catch {};
    // if (field == 0) {
    //     if (dbSort.hasMainSortIndexes(typePrefix)) {
    //         const s: ?*dbSort.StartSet = dbSort.mainSortIndexes.get(typePrefix);
    //         var it = s.?.*.keyIterator();
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
    //             var indexValue: c.MDB_val = .{
    //                 .mv_size = len,
    //                 .mv_data = data[start .. start + len].ptr,
    //             };
    //             dbSort.writeToSortIndex(
    //                 &indexValue,
    //                 &k,
    //                 sIndex.?.start,
    //                 len,
    //                 sIndex.?.cursor,
    //                 field,
    //             ) catch {};
    //         }
    //     }
    // } else if (currentSortIndex != null) {
    //     dbSort.writeToSortIndex(
    //         &v,
    //         &k,
    //         currentSortIndex.?.start,
    //         currentSortIndex.?.len,
    //         currentSortIndex.?.cursor,
    //         field,
    //     ) catch {};
    // }

    return operationSize + 4;
}
