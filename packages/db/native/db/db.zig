const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const std = @import("std");

pub const DbName = [6]u8;

pub const TypeId = [2]u8;

pub const Shard = struct { dbi: c.MDB_dbi, key: DbName, cursor: ?*c.MDB_cursor, queryId: ?u32 };

pub const WriteShards = std.AutoHashMap(DbName, Shard);

// READ SHARDS
var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
pub const allocator = arena.allocator();
pub var readShards = std.AutoHashMap(DbName, Shard).init(allocator);
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
        try errors.mdb(c.mdb_txn_begin(Envs.env, null, c.MDB_RDONLY, &txn));
    } else {
        try errors.mdb(c.mdb_txn_begin(Envs.env, null, 0, &txn));
    }
    return txn;
}

pub inline fn getName(typeId: TypeId, field: u8, shard: u16) DbName {
    const s: TypeId = @bitCast(shard);
    if (s[0] == 0 and s[1] != 0) {
        return .{ typeId[0], typeId[1], field + 1, 255, 255 - s[1], 0 };
    }
    return .{ typeId[0], typeId[1], field + 1, s[0], s[1], 0 };
}

pub fn openDbi(comptime create: bool, name: [6]u8, txn: ?*c.MDB_txn) !c.MDB_dbi {
    var dbi: c.MDB_dbi = 0;
    var flags: c_uint = c.MDB_INTEGERKEY;
    if (create) {
        flags |= c.MDB_CREATE;
    }
    try errors.mdb(c.mdb_dbi_open(txn, &name, flags, &dbi));
    return dbi;
}

pub fn getReadShard(dbiName: DbName, queryId: u32) ?Shard {
    var s = readShards.get(dbiName);
    if (s == null) {
        var cursor: ?*c.MDB_cursor = null;
        const dbi = openDbi(false, dbiName, readTxn) catch {
            return null;
        };
        errors.mdb(c.mdb_cursor_open(readTxn, dbi, &cursor)) catch |err| {
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

pub fn openShard(comptime create: bool, dbiName: DbName, txn: ?*c.MDB_txn) !Shard {
    const dbi = try openDbi(create, dbiName, txn);
    var cursor: ?*c.MDB_cursor = null;
    try errors.mdb(c.mdb_cursor_open(txn, dbi, &cursor));
    errdefer c.mdb_cursor_close(cursor);
    const s: Shard = .{ .dbi = dbi, .key = dbiName, .cursor = cursor, .queryId = null };
    return s;
}

pub inline fn closeShard(shard: *Shard) void {
    c.mdb_cursor_close(shard.cursor);
}

pub inline fn closeCursor(shard: *Shard) void {
    c.mdb_cursor_close(shard.cursor);
}

pub inline fn idToShard(id: u32) u16 {
    return @truncate(@divTrunc(id, 1_000_000));
}

pub inline fn data(v: c.MDB_val) []u8 {
    return @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
}

pub inline fn dataPart(v: c.MDB_val, start: u16, len: u16) []u8 {
    return @as([*]u8, @ptrCast(v.mv_data))[start .. len + start];
}

pub inline fn readField(id: u32, shard: ?Shard) []u8 {
    var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
    errors.mdb(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
        return &.{};
    };
    return @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
}

pub fn getField(id: u32, field: u8, typeId: TypeId, currentShard: u16, queryId: u32) []u8 {
    const dbiName = getName(typeId, field, @bitCast(currentShard));
    const shard = getReadShard(dbiName, queryId);
    if (shard == null) {
        return &.{};
    }
    return readField(id, shard);
}

pub fn writeField(id: u32, buf: []u8, shard: ?Shard) !void {
    var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    var v: c.MDB_val = .{ .mv_size = buf.len, .mv_data = buf.ptr };
    try errors.mdb(c.mdb_cursor_put(shard.?.cursor, &k, &v, 0));
}

pub fn deleteField(id: u32, shard: ?Shard) !void {
    var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
    try errors.mdb(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET));
    try errors.mdb(c.mdb_cursor_del(shard.?.cursor, 0));
}

pub fn commitTxn(txn: ?*c.MDB_txn) !void {
    try errors.mdb(c.mdb_txn_commit(txn));
}

var lastQueryId: u32 = 0;
pub fn getQueryId() u32 {
    lastQueryId += 1;
    if (lastQueryId > 4_000_000_000_000) {
        lastQueryId = 0;
    }
    return lastQueryId;
}
