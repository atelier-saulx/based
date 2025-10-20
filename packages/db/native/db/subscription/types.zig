const std = @import("std");
const vectorLen = std.simd.suggestVectorLength(u8).?;

pub const IdSubs = std.AutoHashMap(u32, []u8); // [24] [24] [24] [4 4] [16 bytes]

pub const TypeSubscriptionCtx = struct {
    idBitSet: []u1,
    idSubs: IdSubs,
    maxId: u32,
    minId: u32,
    bitSetSize: u32,
    bitSetMin: u32,
    bitSetRatio: u32,
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    singleIdMarked: []u8,
    lastIdMarked: u32,
};

pub const BLOCK_SIZE = 100_000;

pub const SUB_SIZE = vectorLen + 8;

pub const MAX_BIT_SET_SIZE = 10_000_000; // 5mb

pub const SubStatus = enum(u8) {
    all = 255,
    marked = 254,
    noMatch = 253,
};
