const c = @import("../c.zig");
const errors = @import("../errors.zig");
const std = @import("std");

pub const DbName = [6]u8;
pub const TypeId = [2]u8;
pub const Shard = struct { dbi: c.MDB_dbi, key: DbName, cursor: ?*c.MDB_cursor, queryId: ?u32 };
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

// TODO: make u16
// pub var mainSortIndexes = std.AutoHashMap([2]u8, *StartSet).init(db.allocator);

// var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
// pub const allocator = arena.allocator();
// pub var readShards = Shards.init(allocator);
// pub var readTxn: *c.MDB_txn = undefined;
// var txnCreated: bool = false;

pub const DbCtx = struct {
    allocator: ?std.mem.Allocator,
    readShards: ?Shards,
    readTxn: *c.MDB_txn,
    txnCreated: bool,
    env: *c.MDB_env,
    sortIndexes: ?Indexes,
    mainSortIndexes: ?std.AutoHashMap([2]u8, *StartSet),
};

// global

pub var dbCtx: DbCtx = .{
    .txnCreated = false,
};
