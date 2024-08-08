const c = @import("../c.zig");
const std = @import("std");
const db = @import("../db.zig");
const results = @import("./results.zig");

pub const QueryCtx = struct {
    shards: *std.AutoHashMap([5]u8, db.Shard),
    txn: ?*c.MDB_txn,
    results: *std.ArrayList(results.Result),

    // something like - nested refs
    // add a struct that gets filled in later in the reslults
};
