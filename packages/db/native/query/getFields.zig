const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");

pub const Result = struct { id: ?u32, field: u8, val: ?c.MDB_val };

pub fn getFields(results: *std.ArrayList(Result), id: *u32, include: []u8, type_prefix: [2]u8, selectiveMain: bool, includeSingleRefsBool: bool, mainLen: usize, currentShard: u16, shards: *std.AutoHashMap([3]u8, db.Shard), txn: ?*c.MDB_txn) !usize {
    var size: usize = 0;

    // make this into a fn
    var includeIterator: u8 = 0;
    // collect all in s
    includeField: while (includeIterator < include.len) {
        const field: u8 = include[includeIterator];
        includeIterator += 1;

        const shardKey = db.getShardKey(field, @bitCast(currentShard));
        var shard = shards.get(shardKey);
        if (shard == null) {
            shard = db.openShard(true, type_prefix, shardKey, txn) catch null;
            if (shard != null) {
                try shards.put(shardKey, shard.?);
            }
        }

        // lots of double getting here...
        var k: c.MDB_val = .{ .mv_size = 4, .mv_data = id };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

        errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
            continue :includeField;
        };

        if (includeIterator == 1) {
            size += 1 + 4;
            const s: Result = .{ .id = id.*, .field = field, .val = v };
            try results.append(s);
        } else {
            const s: Result = .{ .id = null, .field = field, .val = v };
            try results.append(s);
        }

        if (field != 0) {
            size += (v.mv_size + 1 + 2);
        } else {
            if (includeSingleRefsBool) {
                // main

                std.debug.print("yo yo yo", .{});

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
