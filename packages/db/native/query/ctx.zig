const std = @import("std");
const results = @import("./results.zig");

pub const QueryCtx = struct {
    results: *std.ArrayList(results.Result),
    id: u32,
};
