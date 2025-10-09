const std = @import("std");

// maybe just dont use the arraylist...
// []ju8
// pub const IdsSubs = std.ArrayList([]u8);

pub const TypeSubscriptionCtx = struct {
    idsList: []u32,
    idBitSet: []u1,
    lastId: u32,
    ids: [][]u8, // pointers...
    singleIdMarked: []u8,
    lastIdMarked: u32,
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionMarked = std.AutoHashMap([2]u32, void);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    // subscriptionsMarked: SubscriptionMarked,
    // hasMarkedSubscriptions: bool,
};

// can make this smaller
pub const BLOCK_SIZE = 10_000;
