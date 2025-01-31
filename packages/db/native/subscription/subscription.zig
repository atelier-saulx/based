const std = @import("std");
const db = @import("../db/db.zig");

pub const Subscription = struct {
    id: u32,
    inProgess: bool,
    props: []u8,
    main: []u16,
    // SORT // FILTER ETC
};

pub const 

pub const TypeSubscriptions = struct {
    // allocator: std.mem.Allocator,
    // arena: std.heap.ArenaAllocator,
};

pub fn addSubscription() Subscription {}

pub fn removeSubscription() void {}

pub fn getSubscription() ?Subscription {}

pub fn execStagedSubscriptions() ?Subscription {}
