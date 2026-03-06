const std = @import("std");
const includes = @import("includes.zig");

test "includeInner benchmark and isolation" {
    const testing = std.testing;

    const value = "this is a very long string that we are searching in, hoping to find a small substring hidden somewhere deep inside";
    const query1 = "hidden";
    const query2 = "notfound";
    const query3 = "t";

    // 1. Basic isolation assertions
    try testing.expect(includes.includeInner(false, query1, value) == true);
    try testing.expect(includes.includeInner(false, query2, value) == false);
    try testing.expect(includes.includeInner(false, query3, value) == true);

    // 2. Perform a small benchmark
    var timer = try std.time.Timer.start();
    var count: usize = 0;

    var i: usize = 0;
    while (i < 1_000_000) : (i += 1) {
        if (includes.includeInner(false, query1, value)) count += 1;
        if (includes.includeInner(false, query2, value)) count += 1;
        if (includes.includeInner(false, query3, value)) count += 1;
    }

    const time_taken = timer.read();
    std.debug.print("\nincludeInner (bench): {any}\n", .{std.fmt.fmtDuration(time_taken)});

    // prevent compiler optimization from removing the bit
    try testing.expect(count == 2_000_000);
}
