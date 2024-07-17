const c = @import("./c.zig");
const errors = @import("./errors.zig");
const Envs = @import("./env/env.zig");
const std = @import("std");

pub const Shard = struct { dbi: c.MDB_dbi, key: [5]u8, cursor: ?*c.MDB_cursor };

pub fn createTransaction(comptime readOnly: bool) !?*c.MDB_txn {
    var txn: ?*c.MDB_txn = null;
    if (readOnly == true) {
        try errors.mdbCheck(c.mdb_txn_begin(Envs.env, null, c.MDB_RDONLY, &txn));
    } else {
        try errors.mdbCheck(c.mdb_txn_begin(Envs.env, null, 0, &txn));
    }
    return txn;
}

pub fn createDbiName(type_prefix: [2]u8, field: u8, shard: [2]u8) [5]u8 {
    if (shard[0] == 0 and shard[1] != 0) {
        return .{ type_prefix[0], type_prefix[1], field, 255, 255 - shard[1] };
    }
    return .{ type_prefix[0], type_prefix[1], field, shard[0], shard[1] };
}

pub fn openDbi(comptime create: bool, name: [5]u8, txn: ?*c.MDB_txn) !c.MDB_dbi {
    var dbi: c.MDB_dbi = 0;
    var flags: c_uint = c.MDB_INTEGERKEY;
    if (create) {
        flags |= c.MDB_CREATE;
    }
    try errors.mdbCheck(c.mdb_dbi_open(txn, &name, flags, &dbi));
    return dbi;
}

pub fn openShard(comptime create: bool, dbiName: [5]u8, txn: ?*c.MDB_txn) !Shard {
    const dbi = try openDbi(create, dbiName, txn);
    errdefer c.mdb_dbi_close(Envs.env, dbi);
    var cursor: ?*c.MDB_cursor = null;
    try errors.mdbCheck(c.mdb_cursor_open(txn, dbi, &cursor));
    errdefer c.mdb_cursor_close(cursor);
    const s: Shard = .{ .dbi = dbi, .key = dbiName, .cursor = cursor };
    return s;
}

pub fn closeShard(shard: *Shard) void {
    c.mdb_cursor_close(shard.cursor);
    c.mdb_dbi_close(Envs.env, shard.dbi);
}

pub fn closeDbi(shard: *Shard) void {
    c.mdb_dbi_close(Envs.env, shard.dbi);
}

pub fn closeCursor(shard: *Shard) void {
    c.mdb_cursor_close(shard.cursor);
}
