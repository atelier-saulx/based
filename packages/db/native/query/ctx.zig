const c = @import("../c.zig");
const std = @import("std");
const db = @import("../db.zig");
const results = @import("./results.zig");

pub const QueryCtx = struct { id: *u32, fromId: ?u32, include: []u8, includeSingleRefs: []u8, includeMain: []u8, type_prefix: [2]u8, mainLen: usize, currentShard: u16, shards: *std.AutoHashMap([5]u8, db.Shard), txn: ?*c.MDB_txn, results: *std.ArrayList(results.Result) };
