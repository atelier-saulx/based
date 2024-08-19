const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const std = @import("std");
const db = @import("./db.zig");
const readInt = @import("../utils.zig").readInt;

pub const SortDbiName = [7]u8;
pub const SortIndex = struct {
    field: u8,
    dbi: c.MDB_dbi,
    cursor: ?*c.MDB_cursor,
    queryId: u32,
    len: u16,
    start: u16,
};

pub const Indexes = std.AutoHashMap(SortDbiName, SortIndex);
pub var sortIndexes = Indexes.init(db.allocator);
pub const StartSet = std.AutoHashMap(u16, u8);

// TODO: make u16
pub var mainSortIndexes = std.AutoHashMap([2]u8, *StartSet).init(db.allocator);

// TYPE BYTE (make into enum)
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

pub fn getSortName(
    typePrefix: db.TypeId,
    field: u8,
    start: u16,
) SortDbiName {
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

pub fn writeField(id: u32, buf: []u8, sortIndex: SortIndex) !void {
    const field: u8 = sortIndex.field;
    const len = sortIndex.len;
    const start = sortIndex.start;
    var key: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    if (len > 0) {
        var selectiveValue: c.MDB_val = .{
            .mv_size = len,
            .mv_data = buf[start .. start + len].ptr,
        };
        try errors.mdb(c.mdb_cursor_put(sortIndex.cursor, &selectiveValue, &key, 0));
    } else if (field != 0 and buf.len > 16) {
        var selectiveValue: c.MDB_val = .{ .mv_size = 16, .mv_data = buf[0..16].ptr };
        try errors.mdb(c.mdb_cursor_put(sortIndex.cursor, &selectiveValue, &key, 0));
    } else {
        var value: c.MDB_val = .{ .mv_size = buf.len, .mv_data = buf.ptr };
        try errors.mdb(c.mdb_cursor_put(sortIndex.cursor, &value, &key, 0));
    }
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
        try errors.mdb(c.mdb_cursor_put(cursor, &selectiveValue, key, 0));
    } else if (field != 0 and value.*.mv_size > 16) {
        const fieldValue = @as([*]u8, @ptrCast(value.*.mv_data))[0..16];
        var selectiveValue: c.MDB_val = .{ .mv_size = 16, .mv_data = fieldValue.ptr };
        try errors.mdb(c.mdb_cursor_put(cursor, &selectiveValue, key, 0));
    } else {
        try errors.mdb(c.mdb_cursor_put(cursor, value, key, 0));
    }
}

fn createSortIndex(
    name: SortDbiName,
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

    try errors.mdb(c.mdb_dbi_open(txn, &name, flags, &dbi));
    try errors.mdb(c.mdb_cursor_open(txn, dbi, &cursor));

    const maxShards = db.idToShard(lastId);
    var currentShard: u16 = 0;

    shardLoop: while (currentShard <= maxShards) {
        const origin = db.getName(typePrefix, field, currentShard);
        const shard = try db.getReadShard(origin, queryId);
        var first: bool = true;
        var end: bool = false;
        currentShard += 1;
        var flag: c_uint = c.MDB_FIRST;
        while (!end) {
            var key: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
            var value: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
            errors.mdb(c.mdb_cursor_get(shard.cursor, &key, &value, flag)) catch {
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

    try errors.mdb(c.mdb_txn_commit(txn));

    if (len > 0) {
        if (!mainSortIndexes.contains(typePrefix)) {
            const startSet = try db.allocator.create(StartSet);
            startSet.* = StartSet.init(db.allocator);
            try mainSortIndexes.put(typePrefix, startSet);
        }
        const s: ?*StartSet = mainSortIndexes.get(typePrefix);
        try s.?.*.put(start, 0);
    }
}

fn createReadSortIndex(name: SortDbiName, queryId: u32, len: u16, start: u16) !SortIndex {
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;
    _ = c.mdb_txn_reset(db.readTxn);
    _ = c.mdb_txn_renew(db.readTxn);
    try errors.mdb(c.mdb_dbi_open(db.readTxn, &name, 0, &dbi));
    try errors.mdb(c.mdb_cursor_open(db.readTxn, dbi, &cursor));
    return .{
        .field = name[3] - 1,
        .dbi = dbi,
        .queryId = queryId,
        .cursor = cursor,
        .len = len,
        .start = start,
    };
}

pub fn getOrCreateReadSortIndex(
    typePrefix: [2]u8,
    sort: []u8,
    queryId: u32,
    lastId: u32,
) !SortIndex {
    const field: u8 = sort[0];
    const fieldType: u8 = sort[1];
    var start: u16 = undefined;
    var len: u16 = undefined;

    if (sort.len == 6) {
        start = readInt(u16, sort, 2);
        len = readInt(u16, sort, 4);
    } else {
        start = 0;
        len = 0;
    }

    const name = getSortName(typePrefix, field, start);
    var s = sortIndexes.get(name);
    if (s == null) {
        createSortIndex(name, start, len, field, fieldType, lastId, queryId) catch |err| {
            std.log.err("Cannot create writeSortIndex name: {any} err: {any} \n", .{ name, err });
            return err;
        };
        const newSortIndex = createReadSortIndex(name, queryId, len, start) catch |err| {
            std.log.err("Cannot create readSortIndex  name: {any} err: {any} \n", .{ name, err });
            return err;
        };
        try sortIndexes.put(name, newSortIndex);
        return newSortIndex;
    }
    if (s.?.queryId != queryId) {
        _ = c.mdb_cursor_renew(db.readTxn, s.?.cursor);
        s.?.queryId = queryId;
    }
    return s.?;
}

pub fn getReadSortIndex(name: [7]u8) ?SortIndex {
    return sortIndexes.get(name);
}

pub fn hasReadSortIndex(name: [7]u8) bool {
    return sortIndexes.contains(name);
}

pub fn hasMainSortIndexes(typePrefix: [2]u8) bool {
    return mainSortIndexes.contains(typePrefix);
}

pub fn createWriteSortIndex(name: SortDbiName, txn: ?*c.MDB_txn) !SortIndex {
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;
    var len: u16 = 0;
    const field = name[3] - 1;
    const startBytes: [2]u8 = .{ name[4], name[5] };
    const start: u16 = @bitCast(startBytes);
    if (field == 0) {
        len = getReadSortIndex(name).?.len;
    }
    try errors.mdb(c.mdb_dbi_open(txn, &name, 0, &dbi));
    try errors.mdb(c.mdb_cursor_open(txn, dbi, &cursor));
    const writeIndex = .{
        .dbi = dbi,
        .cursor = cursor,
        .queryId = 0,
        .len = len,
        .start = start,
        .field = field,
    };
    return writeIndex;
}

pub fn deleteField(id: u32, d: []u8, sortIndex: SortIndex) !void {
    var data: []u8 = d;
    if (data.len == 0) {
        return;
    }
    if (sortIndex.len > 0) {
        data = data[sortIndex.start .. sortIndex.start + sortIndex.len];
    }
    var sortValue: c.MDB_val = .{ .mv_size = data.len, .mv_data = data.ptr };
    var sortKey: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    if (data.len > 16) {
        sortValue.mv_data = data[0..16].ptr;
    }
    try errors.mdb(c.mdb_cursor_get(sortIndex.cursor, &sortValue, &sortKey, c.MDB_GET_BOTH));
    try errors.mdb(c.mdb_cursor_del(sortIndex.cursor, 0));
}
