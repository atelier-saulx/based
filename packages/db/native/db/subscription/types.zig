const std = @import("std");

pub const IdSubs = std.AutoHashMap(u32, []u8);

pub const TypeSubscriptionCtx = struct {
    idBitSet: []u1,
    idSubs: IdSubs,
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    singleIdMarked: []u8,
    lastIdMarked: u32,
};

pub const BLOCK_SIZE = 100_000;
