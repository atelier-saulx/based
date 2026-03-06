const std = @import("std");
pub const bench = @import("query/filter/variable/bench.test.zig");

test "run bench" {
    std.testing.refAllDecls(bench);
}
