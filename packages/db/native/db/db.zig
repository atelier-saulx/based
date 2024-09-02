const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");

const selva = @import("../selva.zig");

pub const DbName = [6]u8;

pub const TypeId = [2]u8;

pub const Shard = struct {
    dbi: c.MDB_dbi,
    key: DbName,
    cursor: ?*c.MDB_cursor,
    queryId: ?u32,
};

pub const Shards = std.AutoHashMap(DbName, Shard);

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

pub const StartSet = std.AutoHashMap(u16, u8);

pub const DbCtx = struct {
    initialized: bool,
    allocator: std.mem.Allocator,
    readShards: Shards,
    readTxn: *c.MDB_txn,
    readTxnCreated: bool,
    env: ?*c.MDB_env,
    sortIndexes: Indexes,
    mainSortIndexes: std.AutoHashMap([2]u8, *StartSet),
    readOnly: bool,
    selva: ?*selva.SelvaDb,
};

var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
const allocator = arena.allocator();
const readShards = Shards.init(allocator);
const sortIndexes = Indexes.init(allocator);
const mainSortIndexes = std.AutoHashMap([2]u8, *StartSet).init(allocator);

pub var ctx: DbCtx = .{
    .allocator = allocator,
    .readShards = readShards,
    .readTxn = undefined,
    .env = undefined,
    .sortIndexes = sortIndexes,
    .mainSortIndexes = mainSortIndexes,
    .readTxnCreated = false,
    .initialized = false,
    .readOnly = false,
    .selva = null,
};

pub fn initReadTxn() !*c.MDB_txn {
    if (ctx.readTxnCreated) {
        return ctx.readTxn;
    }
    ctx.readTxnCreated = true;
    const tmpTxn = try createTransaction(true);
    ctx.readTxn = tmpTxn.?;
    return ctx.readTxn;
}

pub fn createTransaction(comptime readOnly: bool) !?*c.MDB_txn {
    var txn: ?*c.MDB_txn = null;
    if (readOnly == true) {
        try errors.mdb(c.mdb_txn_begin(ctx.env, null, c.MDB_RDONLY, &txn));
    } else {
        try errors.mdb(c.mdb_txn_begin(ctx.env, null, 0, &txn));
    }
    return txn.?;
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

pub fn getReadShard(dbiName: DbName, queryId: u32) !Shard {
    var s = ctx.readShards.get(dbiName);
    if (s == null) {
        var cursor: ?*c.MDB_cursor = null;
        const dbi = try openDbi(false, dbiName, ctx.readTxn);
        errors.mdb(c.mdb_cursor_open(ctx.readTxn, dbi, &cursor)) catch |err| {
            std.log.err("Cannot open cursor {any}\n", .{err});
            return err;
        };
        s = .{ .dbi = dbi, .key = dbiName, .cursor = cursor, .queryId = queryId };
        ctx.readShards.put(dbiName, s.?) catch |err| {
            std.log.err("Shard cannot be created name: {any} err: {any}\n", .{ dbiName, err });
            return err;
        };
    } else if (s.?.queryId != queryId) {
        errors.mdb(c.mdb_cursor_renew(ctx.readTxn, s.?.cursor)) catch |err| {
            std.debug.print("Cannot renew {any} shard.queryId:{any} queryId:{any} \n", .{ err, s.?.queryId, queryId });
            return s.?;
        };
        s.?.queryId = queryId;
    }
    return s.?;
}

pub fn openShard(comptime create: bool, dbiName: DbName, txn: ?*c.MDB_txn) !Shard {
    const dbi = try openDbi(create, dbiName, txn);
    var cursor: ?*c.MDB_cursor = null;
    try errors.mdb(c.mdb_cursor_open(txn, dbi, &cursor));
    errdefer c.mdb_cursor_close(cursor);
    const s: Shard = .{ .dbi = dbi, .key = dbiName, .cursor = cursor, .queryId = null };
    return s;
}

pub inline fn closeShard(shard: Shard) void {
    c.mdb_cursor_close(shard.cursor);
}

pub inline fn closeCursor(shard: Shard) void {
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

pub inline fn readField(id: u32, shard: Shard) []u8 {
    var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
    errors.mdb(c.mdb_cursor_get(shard.cursor, &k, &v, c.MDB_SET)) catch {
        return &.{};
    };
    return @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
}

pub fn getField(id: u32, field: u8, typeId: TypeId, currentShard: u16, queryId: u32) []u8 {
    const dbiName = getName(typeId, field, @bitCast(currentShard));
    const shard = getReadShard(dbiName, queryId) catch {
        return &.{};
    };
    return readField(id, shard);
}

pub fn writeField(id: u32, buf: []u8, shard: Shard) !void {
    var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    var v: c.MDB_val = .{ .mv_size = buf.len, .mv_data = buf.ptr };
    try errors.mdb(c.mdb_cursor_put(shard.cursor, &k, &v, 0));
}

pub fn deleteField(id: u32, shard: Shard) ![]u8 {
    var k: c.MDB_val = .{ .mv_size = 4, .mv_data = @constCast(&id) };
    var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
    try errors.mdb(c.mdb_cursor_get(shard.cursor, &k, &v, c.MDB_SET));
    try errors.mdb(c.mdb_cursor_del(shard.cursor, 0));
    return @as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size];
}

pub inline fn commitTxn(txn: ?*c.MDB_txn) !void {
    try errors.mdb(c.mdb_txn_commit(txn));
}

pub inline fn resetTxn(txn: ?*c.MDB_txn) void {
    c.mdb_txn_reset(txn);
}

var lastQueryId: u32 = 0;
pub fn getQueryId() u32 {
    lastQueryId += 1;
    if (lastQueryId > 4_000_000_000_000) {
        lastQueryId = 0;
    }
    return lastQueryId;
}

// SELVA WRAPPERS
pub fn getSelvaTypeEntry(typePrefix: [2]u8) !*selva.SelvaTypeEntry {
    // make fn getSelvaTypeIndex
    const selvaTypeEntry: ?*selva.SelvaTypeEntry = selva.selva_get_type_by_index(
        ctx.selva.?,
        @bitCast(typePrefix),
    );

    if (selvaTypeEntry == null) {
        return errors.SelvaError.SELVA_EINTYPE;
    }

    return selvaTypeEntry.?;
}

pub fn selvaGetFieldSchema(field: u8, typeEntry: ?*selva.SelvaTypeEntry) !*selva.SelvaFieldSchema {
    const s: ?*selva.SelvaFieldSchema = selva.selva_get_fs_by_ns_field(
        selva.selva_get_ns_by_te(typeEntry.?),
        @bitCast(field),
    );
    if (s == null) {
        return errors.SelvaError.SELVA_EINVAL;
    }
    return s.?;
}

pub fn selvaGetField(node: *selva.SelvaNode, selvaFieldSchema: *selva.SelvaFieldSchema) []u8 {
    const result: selva.SelvaFieldsPointer = selva.selva_fields_get_raw(node, selvaFieldSchema);
    return @as([*]u8, @ptrCast(result.ptr))[result.off .. result.len + result.off];
}

pub fn selvaWriteField(d: []u8, selvaNode: *selva.SelvaNode, selvaFieldSchema: *selva.SelvaFieldSchema) !void {
    try errors.selva(selva.selva_fields_set(
        ctx.selva,
        selvaNode,
        selvaFieldSchema,
        d.ptr,
        d.len,
    ));
}

pub fn selvaDeleteNode(selvaNode: *selva.SelvaNode, typeEntry: ?*selva.SelvaTypeEntry) !void {
    selva.selva_del_node(
        ctx.selva,
        typeEntry,
        selvaNode,
    );
}
