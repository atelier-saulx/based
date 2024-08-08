const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const std = @import("std");
const db = @import("./db.zig");

pub const SortIndex = struct { dbi: c.MDB_dbi, key: [7]u8, cursor: ?*c.MDB_cursor, queryId: u32 };

pub var sortIndexes = std.AutoHashMap([7]u8, SortIndex).init(db.allocator);

fn createSortIndex(name: [7]u8, shard: db.Shard, start: u16, len: u16) !void {
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;
    const txn = try db.createTransaction(false);
    // integer key depends..
    // also need type...
    var flags: c_uint = c.MDB_INTEGERKEY;
    flags |= c.MDB_CREATE;
    flags |= c.MDB_DUPSORT;
    flags |= c.MDB_DUPFIXED;
    flags |= c.MDB_INTEGERDUP;
    try errors.mdbCheck(c.mdb_dbi_open(txn, &name, flags, &dbi));
    try errors.mdbCheck(c.mdb_cursor_open(txn, dbi, &cursor));
    var first: bool = true;
    var end: bool = false;
    var flag: c_uint = c.MDB_FIRST;
    while (!end) {
        var k: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
        errors.mdbCheck(c.mdb_cursor_get(shard.cursor, &k, &v, flag)) catch {
            end = true;
            break;
        };
        if (len > 0) {
            const mainValue = @as([*]u8, @ptrCast(v.mv_data))[start .. start + len];
            var selectiveValue: c.MDB_val = .{ .mv_size = len, .mv_data = mainValue.ptr };
            try errors.mdbCheck(c.mdb_cursor_put(cursor, &selectiveValue, &k, 0));
        } else {
            try errors.mdbCheck(c.mdb_cursor_put(cursor, &v, &k, 0));
        }
        if (first) {
            first = false;
            flag = c.MDB_NEXT;
        }
    }
    try errors.mdbCheck(c.mdb_txn_commit(txn));
}

fn createReadSortIndex(name: [7]u8, queryId: u32) !SortIndex {
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;
    _ = c.mdb_txn_reset(db.readTxn);
    _ = c.mdb_txn_renew(db.readTxn);
    try errors.mdbCheck(c.mdb_dbi_open(db.readTxn, &name, 0, &dbi));
    try errors.mdbCheck(c.mdb_cursor_open(db.readTxn, dbi, &cursor));
    return .{
        .dbi = dbi,
        .key = name,
        .queryId = queryId,
        .cursor = cursor,
    };
}

pub fn createOrGetSortIndex(typePrefix: [2]u8, field: u8, start: u16, len: u16, queryId: u32) ?SortIndex {
    var startCasted: [2]u8 = @bitCast(start);
    if (startCasted[0] == 0 and startCasted[1] != 0) {
        startCasted[0] = 255;
        startCasted[1] = 255 - startCasted[1];
    }
    const name: [7]u8 = .{
        254,
        typePrefix[0],
        typePrefix[1],
        field + 1,
        startCasted[0],
        startCasted[1],
        0,
    };
    var s = sortIndexes.get(name);
    if (s == null) {
        const origin = db.createDbiName(typePrefix, field, .{ 0, 0 });
        const shard = db.getReadShard(origin, queryId);
        if (shard == null) {
            return null;
        }
        createSortIndex(name, shard.?, start, len) catch |err| {
            std.log.err("Cannot create writeSortIndex name: {any} err: {any} \n", .{ name, err });
            return null;
        };
        const newSortIndex = createReadSortIndex(name, queryId) catch |err| {
            std.log.err("Cannot create readSortIndex  name: {any} err: {any} \n", .{ name, err });
            return null;
        };
        sortIndexes.put(name, newSortIndex) catch {};
        return newSortIndex;
    }
    if (s.?.queryId != queryId) {
        _ = c.mdb_cursor_renew(db.readTxn, s.?.cursor);
        s.?.queryId = queryId;
    }
    return s;
}
