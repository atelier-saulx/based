const std = @import("std");

pub const TypeSubscriptionCtx = struct {
    idsList: []u32,
    idBitSet: []u1,
    lastId: u32,
    ids: [][]u8,
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionMarked = std.AutoHashMap([2]u32, void);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    singleIdMarked: []u8,
    lastIdMarked: u32,
};

pub const BLOCK_SIZE = 100_000;
