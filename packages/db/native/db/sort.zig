const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const db = @import("./db.zig");
const readInt = @import("../utils.zig").readInt;

pub const EMPTY_CHAR: [1]u8 = .{0};
pub const EMPTY_CHAR_SLICE = @constCast(&EMPTY_CHAR)[0..1];

pub inline fn commitTxn(txn: ?*c.MDB_txn) !void {
    try errors.mdb(c.mdb_txn_commit(txn));
}

pub inline fn renewTx(txn: ?*c.MDB_txn) void {
    errors.mdb(c.mdb_txn_renew(txn)) catch {};
}

pub inline fn resetTxn(txn: ?*c.MDB_txn) void {
    c.mdb_txn_reset(txn);
}

pub inline fn readDataPart(v: c.MDB_val, start: u16, len: u16) []u8 {
    return @as([*]u8, @ptrCast(v.mv_data))[start .. len + start];
}

pub inline fn readData(v: c.MDB_val) []u8 {
    return @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
}

pub const SortDbiName = [6]u8;

pub const SortIndex = struct {
    field: u8,
    dbi: c.MDB_dbi,
    cursor: ?*c.MDB_cursor,
    queryId: u32,
    len: u16,
    start: u16,
};

pub const Indexes = std.AutoHashMap(SortDbiName, SortIndex);

pub fn createTransaction(comptime readOnly: bool) !?*c.MDB_txn {
    var txn: ?*c.MDB_txn = null;
    if (readOnly == true) {
        try errors.mdb(c.mdb_txn_begin(db.ctx.env, null, c.MDB_RDONLY, &txn));
    } else {
        try errors.mdb(c.mdb_txn_begin(db.ctx.env, null, 0, &txn));
    }
    return txn.?;
}

pub fn initReadTxn() !*c.MDB_txn {
    if (db.ctx.readTxnCreated) {
        return db.ctx.readTxn;
    }
    db.ctx.readTxnCreated = true;
    const tmpTxn = try createTransaction(true);
    db.ctx.readTxn = tmpTxn.?;
    return db.ctx.readTxn;
}

pub fn getPrefix(typeId: db.TypeId) [2]u8 {
    // potential make it 3 bytes
    var typePrefix: [2]u8 = @bitCast(typeId);
    if (typePrefix[0] == 0) {
        typePrefix[0] = 255;
    }
    if (typePrefix[1] == 0) {
        typePrefix[1] = 255;
    }
    return typePrefix;
}

pub fn getSortName(
    typeId: db.TypeId,
    field: u8,
    start: u16,
) SortDbiName {
    var startCasted: [2]u8 = @bitCast(start);
    if (startCasted[0] == 0 and startCasted[1] != 0) {
        startCasted[0] = 255;
        startCasted[1] = 255 - startCasted[1];
    }
    const typePrefix = getPrefix(typeId);

    const name: SortDbiName = .{
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

pub fn writeDataToSortIndex(
    id: u32,
    data: []u8,
    start: u16,
    len: u16,
    cursor: ?*c.MDB_cursor,
    field: u8,
) !void {
    var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    var v: c.MDB_val = .{ .mv_size = data.len, .mv_data = data.ptr };
    try writeToSortIndex(&v, &k, start, len, cursor, field);
}

fn createSortIndex(
    name: SortDbiName,
    start: u16,
    len: u16,
    field: u8,
    fieldType: u8,
    lastId: u32,
) !void {
    const txn = try createTransaction(false);
    const typePrefix: [2]u8 = .{ name[1], name[2] };
    const typeId: u16 = @bitCast(typePrefix);

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

    const typeEntry = try db.getType(typeId);
    const fieldSchema = try db.getFieldSchema(field, typeEntry);

    var i: u32 = 0;
    while (i <= lastId) : (i += 1) {
        const node = db.getNode(i, typeEntry);
        if (node == null) {
            continue;
        }
        const data = db.getField(node.?, fieldSchema);
        try writeDataToSortIndex(i, data, start, len, cursor, field);
    }

    try commitTxn(txn);

    if (len > 0) {
        if (!db.ctx.mainSortIndexes.contains(typePrefix)) {
            const startSet = try db.ctx.allocator.create(db.StartSet);
            startSet.* = db.StartSet.init(db.ctx.allocator);
            try db.ctx.mainSortIndexes.put(typePrefix, startSet);
        }
        const s: ?*db.StartSet = db.ctx.mainSortIndexes.get(typePrefix);
        try s.?.*.put(start, 0);
    }
}

pub fn createReadSortIndex(name: SortDbiName, queryId: u32, len: u16, start: u16) !SortIndex {
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;

    // TODO: optmize calling this at the start BUT after the creation of a write TXN (else it crashes)
    _ = try initReadTxn();

    resetTxn(db.ctx.readTxn);

    try errors.mdb(c.mdb_txn_renew(db.ctx.readTxn));
    try errors.mdb(c.mdb_dbi_open(db.ctx.readTxn, &name, 0, &dbi));
    try errors.mdb(c.mdb_cursor_open(db.ctx.readTxn, dbi, &cursor));

    return .{
        .field = name[2] - 1,
        .dbi = dbi,
        .queryId = queryId,
        .cursor = cursor,
        .len = len,
        .start = start,
    };
}

pub fn getOrCreateReadSortIndex(
    typeId: db.TypeId,
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

    const name = getSortName(typeId, field, start);
    var s = db.ctx.sortIndexes.get(name);
    if (s == null) {
        createSortIndex(name, start, len, field, fieldType, lastId) catch |err| {
            std.log.err("Cannot create writeSortIndex name: {any} err: {any} \n", .{ name, err });
            return err;
        };
        const newSortIndex = createReadSortIndex(name, queryId, len, start) catch |err| {
            std.log.err("Cannot create readSortIndex  name: {any} err: {any} \n", .{ name, err });
            return err;
        };
        try db.ctx.sortIndexes.put(name, newSortIndex);
        return newSortIndex;
    }
    if (s.?.queryId != queryId) {
        _ = c.mdb_cursor_renew(db.ctx.readTxn, s.?.cursor);
        s.?.queryId = queryId;
    }
    return s.?;
}

pub fn getReadSortIndex(name: SortDbiName) ?SortIndex {
    return db.ctx.sortIndexes.get(name);
}

pub fn hasReadSortIndex(name: SortDbiName) bool {
    return db.ctx.sortIndexes.contains(name);
}

pub fn hasMainSortIndexes(typeId: db.TypeId) bool {
    return db.ctx.mainSortIndexes.contains(getPrefix(typeId));
}

pub fn createWriteSortIndex(name: SortDbiName, txn: ?*c.MDB_txn) !SortIndex {
    var dbi: c.MDB_dbi = 0;
    var cursor: ?*c.MDB_cursor = null;
    var len: u16 = 0;
    const field = name[2] - 1;
    const startBytes: [2]u8 = .{ name[3], name[4] };
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
