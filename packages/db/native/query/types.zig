const std = @import("std");
const results = @import("./results.zig");
const db = @import("../db/db.zig");
const types = @import("../types.zig");

pub const QueryCtx = struct {
    results: std.array_list.Managed(results.Result),
    size: usize,
    totalResults: usize,
    aggResult: ?u32,
    allocator: std.mem.Allocator,
    db: *db.DbCtx,
};

pub const FilterType = enum(u8) {
    none = 0,
    simple = 1,
    default = 2,
};
