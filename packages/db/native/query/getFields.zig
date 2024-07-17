const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");

pub const Result = struct { id: ?u32, field: u8, val: ?c.MDB_val, fromId: ?u32 };

pub fn getFields(results: *std.ArrayList(Result), id: *u32, fromId: ?u32, include: []u8, type_prefix: [2]u8, selectiveMain: bool, includeSingleRefsBool: bool, includeSingleRefs: []u8, mainLen: usize, currentShard: u16, shards: *std.AutoHashMap([5]u8, db.Shard), txn: ?*c.MDB_txn) !usize {
    var size: usize = 0;

    // make this into a fn
    var includeIterator: u8 = 0;
    // collect all in s
    includeField: while (includeIterator < include.len) {
        const field: u8 = include[includeIterator];
        includeIterator += 1;

        const dbiName = db.createDbiName(type_prefix, field, @bitCast(currentShard));

        var shard = shards.get(dbiName);
        if (shard == null) {
            shard = db.openShard(true, dbiName, txn) catch null;
            if (shard != null) {
                try shards.put(dbiName, shard.?);
            }
        }

        var k: c.MDB_val = .{ .mv_size = 4, .mv_data = id };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
            continue :includeField;
        };

        if (includeIterator == 1 and fromId == null) {
            size += 1 + 4;
            const s: Result = .{ .id = id.*, .field = field, .val = v, .fromId = fromId };
            try results.append(s);
        } else {
            const s: Result = .{ .id = null, .field = field, .val = v, .fromId = fromId };
            try results.append(s);
        }

        if (field != 0) {
            size += (v.mv_size + 1 + 2);
        } else {
            if (includeSingleRefsBool and v.mv_size > 0) {
                // main

                std.debug.print("yo yo yo {any} FROMID: {any}\n", .{ includeSingleRefs, fromId });

                var refI: usize = 0;
                // const totalLen =

                // refLoop:
                while (refI < includeSingleRefs.len) {
                    const len = std.mem.readInt(u16, includeSingleRefs[refI..][0..2], .little);
                    const t: [2]u8 = .{ includeSingleRefs[refI + 2], includeSingleRefs[refI + 3] };

                    const start = std.mem.readInt(u16, includeSingleRefs[refI + 4 ..][0..2], .little);

                    const mainSlice = @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];

                    const refId = std.mem.readInt(u32, mainSlice[start..][0..4], .little);

                    std.debug.print("yo yo yo REAd LEN: {d} t: {any} start: {d} len: {d} refId: {d}  id: {d} \n", .{ len, t, start, mainSlice.len, refId, id[0..1] });

                    refI += len + 6;
                    // refI +=   ;
                    // getFields(results, id, true, )

                }

                // get id

                // buffer copy for single ref selection

                // then main

                // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][0] | [0][255][offset][offset][len][len][0]) [1][2]
                //
                // put while loop
            }

            if (selectiveMain) {
                size += (mainLen + 1);
            } else {
                size += (v.mv_size + 1);
            }
        }
    }

    return size;
}
