const std = @import("std");
const results = @import("./results.zig");
const db = @import("../db//db.zig");

pub const QueryCtx = struct {
    results: std.ArrayList(results.Result),
    id: u32,
    size: usize,
    totalResults: usize,
    allocator: std.mem.Allocator,
    db: *db.DbCtx,
};
