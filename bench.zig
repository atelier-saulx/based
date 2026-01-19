const bench = @import("native/query/filter/bench.zig");

pub fn main() !void {
    try bench.main();
}
