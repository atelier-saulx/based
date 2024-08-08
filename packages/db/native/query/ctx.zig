const c = @import("../c.zig");
const std = @import("std");
const db = @import("../db.zig");
const results = @import("./results.zig");

pub const QueryCtx = struct {
    results: *std.ArrayList(results.Result),
    id: u32,
};
