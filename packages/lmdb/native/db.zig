const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("env.zig");
const std = @import("std");

pub fn createTransaction() !*c.MDB_txn {
    var txn: ?*c.MDB_txn = null;
    try error.mdbThrow(c.mdb_txn_begin(Envs.env, null, c.MDB_RDONLY, &txn));
    return txn;
}

pub fn getDbiName(type_prefix: *[2]u8, field: u8, shard: u8) ![5]u8 {
    var all_together: [5]u8 = undefined;
    // last char can go away....
    return std.fmt.bufPrint(all_together[0..5], "{s}{c}{c}{s}", .{ type_prefix, field, shard + 48, "0" });
}
