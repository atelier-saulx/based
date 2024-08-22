const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const napi = @import("../napi.zig");

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
};

pub fn init(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return initInternal(napi_env, info) catch return null;
}

fn initInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, napi_env, info);
    const path = try napi.getStringFixedLength("createEnv", 256, napi_env, args[0]);

    // might need this...
    //   const startSet = try dbCtx.ctx.allocator.create(dbCtx.StartSet);

    try errors.mdb(c.mdb_env_create(&ctx.env));
    errdefer c.mdb_env_close(ctx.env);
    try errors.mdb(c.mdb_env_set_mapsize(ctx.env, 1000 * 1000 * 1000 * 100));
    try errors.mdb(c.mdb_env_set_maxdbs(ctx.env, 20_000_000));
    try errors.mdb(c.mdb_env_set_maxreaders(ctx.env, 126));

    var flags: c_uint = 0;

    // flags |= c.MDB_RDONLY; // very nice for read shard

    // only 1 writer per db
    flags |= c.MDB_NOLOCK;

    // no sync
    flags |= c.MDB_NOSYNC;

    // no meta sync
    flags |= c.MDB_NOMETASYNC;

    // writable mmap
    flags |= c.MDB_WRITEMAP;

    errors.mdb(c.mdb_env_open(ctx.env, &path, flags, 0o664)) catch |err| {
        std.log.err("Open lmdb env {any}", .{err});
    };

    return null;
}
