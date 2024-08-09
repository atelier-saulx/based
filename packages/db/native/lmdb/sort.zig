const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const std = @import("std");
const db = @import("./db.zig");

// flags: c_uint
pub const SortIndex = struct { dbi: c.MDB_dbi, cursor: ?*c.MDB_cursor, queryId: u32, len: u16, start: u16 };

pub var sortIndexes = std.AutoHashMap([7]u8, SortIndex).init(db.allocator);

//   ['timestamp', 1],
//   ['created', 2],
//   ['updated', 3],
//   ['number', 4],
//   ['integer', 5],
//   ['boolean', 6],
//   ['reference', 7],
//   ['enum', 8],
//   ['string', 9],
//   ['references', 10],

pub fn createSortName(
    typePrefix: [2]u8,
    field: u8,
    start: u16,
) [7]u8 {
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
    return name;
}

pub fn writeToSortIndex(
    value: [*c]c.MDB_val,
    key: [*c]c.MDB_val,
    start: u16,
    len: u16,
    cursor: ?*c.MDB_cursor,
    field: u8,
) !void {
    if (len > 0) {
        const mainValue = @as([*]u8, @ptrCast(value.*.mv_data))[start .. start + len];
        var selectiveValue: c.MDB_val = .{ .mv_size = len, .mv_data = mainValue.ptr };
        try errors.mdbCheck(c.mdb_cursor_put(cursor, &selectiveValue, key, 0));
    } else if (field != 0 and value.*.mv_size > 16) {
        const fieldValue = @as([*]u8, @ptrCast(value.*.mv_data))[0..16];
        var selectiveValue: c.MDB_val = .{ .mv_size = 16, .mv_data = fieldValue.ptr };
        try errors.mdbCheck(c.mdb_cursor_put(cursor, &selectiveValue, key, 0));
    } else {
        try errors.mdbCheck(c.mdb_cursor_put(cursor, value, key, 0));
    }
}

fn createSortIndex(
    name: [7]u8,
    start: u16,
    len: u16,
    field: u8,
    fieldType: u8,
    lastId: u32,
    queryId: u32,
) !void {
    const txn = try db.createTransaction(false);
    const typePrefix = .{ name[1], name[2] };

    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;
    var flags: c_uint = c.MDB_CREATE;
    flags |= c.MDB_DUPSORT;
    flags |= c.MDB_DUPFIXED;
    flags |= c.MDB_INTEGERDUP;
    if (fieldType == 5 or fieldType == 4 or fieldType == 1) {
        flags |= c.MDB_INTEGERKEY;
    }
    try errors.mdbCheck(c.mdb_dbi_open(txn, &name, flags, &dbi));
    try errors.mdbCheck(c.mdb_cursor_open(txn, dbi, &cursor));

    const maxShards = db.idToShard(lastId);
    var currentShard: u16 = 0;

    shardLoop: while (currentShard <= maxShards) {
        const origin = db.createDbiName(typePrefix, field, @bitCast(currentShard));
        const shard = db.getReadShard(origin, queryId);
        var first: bool = true;
        var end: bool = false;
        currentShard += 1;
        if (shard == null) {
            continue :shardLoop;
        }
        var flag: c_uint = c.MDB_FIRST;
        while (!end) {
            var key: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
            var value: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
            errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &key, &value, flag)) catch {
                end = true;
                continue :shardLoop;
            };

            try writeToSortIndex(&value, &key, start, len, cursor, field);

            if (first) {
                first = false;
                flag = c.MDB_NEXT;
            }
        }
    }
    try errors.mdbCheck(c.mdb_txn_commit(txn));
}

fn createReadSortIndex(name: [7]u8, queryId: u32, len: u16, start: u16) !SortIndex {
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;
    _ = c.mdb_txn_reset(db.readTxn);
    _ = c.mdb_txn_renew(db.readTxn);
    try errors.mdbCheck(c.mdb_dbi_open(db.readTxn, &name, 0, &dbi));
    try errors.mdbCheck(c.mdb_cursor_open(db.readTxn, dbi, &cursor));
    return .{
        .dbi = dbi,
        .queryId = queryId,
        .cursor = cursor,
        .len = len,
        .start = start,
    };
}

pub fn createOrGetSortIndex(
    typePrefix: [2]u8,
    field: u8,
    start: u16,
    len: u16,
    queryId: u32,
    fieldType: u8,
    lastId: u32,
) ?SortIndex {
    const name = createSortName(typePrefix, field, start);
    var s = sortIndexes.get(name);
    if (s == null) {
        createSortIndex(name, start, len, field, fieldType, lastId, queryId) catch |err| {
            std.log.err("Cannot create writeSortIndex name: {any} err: {any} \n", .{ name, err });
            return null;
        };
        const newSortIndex = createReadSortIndex(name, queryId, len, start) catch |err| {
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

pub fn getReadSortIndex(name: [7]u8) ?SortIndex {
    return sortIndexes.get(name);
}

pub fn hasReadSortIndex(name: [7]u8) bool {
    return sortIndexes.contains(name);
}

pub fn createWriteSortIndex(name: [7]u8, len: u16, start: u16, txn: ?*c.MDB_txn) ?SortIndex {
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;
    errors.mdbCheck(c.mdb_dbi_open(txn, &name, 0, &dbi)) catch {
        return null;
    };
    errors.mdbCheck(c.mdb_cursor_open(txn, dbi, &cursor)) catch {
        return null;
    };
    const writeIndex = .{ .dbi = dbi, .cursor = cursor, .queryId = 0, .len = len, .start = start };
    return writeIndex;
}
