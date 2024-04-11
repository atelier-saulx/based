const c = @import("./c.zig");
const errors = @import("./errors.zig");
const Envs = @import("./env/env.zig");
const std = @import("std");

pub fn createTransaction(comptime readOnly: bool) !?*c.MDB_txn {
    var txn: ?*c.MDB_txn = null;
    if (readOnly == true) {
        try errors.mdbCheck(c.mdb_txn_begin(Envs.env, null, c.MDB_RDONLY, &txn));
    } else {
        try errors.mdbCheck(c.mdb_txn_begin(Envs.env, null, 0, &txn));
    }
    return txn;
}

// shard needs to be [2]u8
pub fn createDbiName(type_prefix: *[2]u8, field: u8, shard: u8) ![5]u8 {
    var all_together: [5]u8 = undefined;
    return std.fmt.bufPrint(all_together[0..5], "{s}{c}{c}{s}", .{ type_prefix, field, shard + 48, "0" });
}

pub fn openDbi(name: []u8, txn: ?*c.MDB_txn) !c.MDB_dbi {
    var dbi: c.MDB_dbi = 0;
    try errors.mdbCheck(c.mdb_dbi_open(txn, @ptrCast(name), c.MDB_INTEGERKEY, &dbi));
    return dbi;
}
