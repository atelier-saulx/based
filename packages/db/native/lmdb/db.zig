const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const std = @import("std");

pub const Shard = struct { dbi: c.MDB_dbi, key: [6]u8, cursor: ?*c.MDB_cursor, queryId: ?u32 };

// READ SHARDS
var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
pub const allocator = arena.allocator();
pub var readShards = std.AutoHashMap([6]u8, Shard).init(allocator);
pub var readTxn: *c.MDB_txn = undefined;

var txnCreated: bool = false;
pub fn initReadTxn() !*c.MDB_txn {
    if (txnCreated) {
        return readTxn;
    }
    txnCreated = true;
    const x = try createTransaction(true);
    readTxn = x.?;
    return readTxn;
}

pub fn createTransaction(comptime readOnly: bool) !?*c.MDB_txn {
    var txn: ?*c.MDB_txn = null;
    if (readOnly == true) {
        try errors.mdbCheck(c.mdb_txn_begin(Envs.env, null, c.MDB_RDONLY, &txn));
    } else {
        try errors.mdbCheck(c.mdb_txn_begin(Envs.env, null, 0, &txn));
    }
    return txn;
}

// TODO: add ZERO
pub fn createDbiName(type_prefix: [2]u8, field: u8, shard: [2]u8) [6]u8 {
    if (shard[0] == 0 and shard[1] != 0) {
        return .{ type_prefix[0], type_prefix[1], field + 1, 255, 255 - shard[1], 0 };
    }
    return .{ type_prefix[0], type_prefix[1], field + 1, shard[0], shard[1], 0 };
}

pub fn openDbi(comptime create: bool, name: [6]u8, txn: ?*c.MDB_txn) !c.MDB_dbi {
    var dbi: c.MDB_dbi = 0;
    var flags: c_uint = c.MDB_INTEGERKEY;
    if (create) {
        flags |= c.MDB_CREATE;
    }
    try errors.mdbCheck(c.mdb_dbi_open(txn, &name, flags, &dbi));
    return dbi;
}

pub fn getReadShard(dbiName: [6]u8, queryId: u32) ?Shard {
    var s = readShards.get(dbiName);
    if (s == null) {
        var cursor: ?*c.MDB_cursor = null;
        const dbi = openDbi(false, dbiName, readTxn) catch {
            return null;
        };
        errors.mdbCheck(c.mdb_cursor_open(readTxn, dbi, &cursor)) catch |err| {
            std.log.err("Cannot open cursor {any}\n", .{err});
            return null;
        };
        s = .{ .dbi = dbi, .key = dbiName, .cursor = cursor, .queryId = queryId };
        readShards.put(dbiName, s.?) catch |err| {
            std.log.err("Shard cannot be created name: {any} err: {any}\n", .{ dbiName, err });
        };
    } else if (s.?.queryId != queryId) {
        _ = c.mdb_cursor_renew(readTxn, s.?.cursor);
        s.?.queryId = queryId;
    }
    return s;
}

pub fn openShard(comptime create: bool, dbiName: [6]u8, txn: ?*c.MDB_txn) !Shard {
    const dbi = try openDbi(create, dbiName, txn);
    var cursor: ?*c.MDB_cursor = null;
    try errors.mdbCheck(c.mdb_cursor_open(txn, dbi, &cursor));
    errdefer c.mdb_cursor_close(cursor);
    const s: Shard = .{ .dbi = dbi, .key = dbiName, .cursor = cursor, .queryId = null };
    return s;
}

pub fn closeShard(shard: *Shard) void {
    c.mdb_cursor_close(shard.cursor);
}

pub fn closeCursor(shard: *Shard) void {
    c.mdb_cursor_close(shard.cursor);
}

pub fn idToShard(id: u32) u16 {
    return @truncate(@divTrunc(id, 1_000_000));
}
