const std = @import("std");

pub const IdSubs = std.AutoHashMap(u32, []u8); // [24] [24] [24] [4 4] [16 bytes]

pub const TypeSubscriptionCtx = struct {
    idBitSet: []u1,
    idSubs: IdSubs,
    maxId: u32,
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    singleIdMarked: []u8,
    lastIdMarked: u32,
};

pub const BLOCK_SIZE = 100_000;
