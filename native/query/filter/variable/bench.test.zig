const std = @import("std");
const includes = @import("includes.zig");
const like = @import("like.zig");

// const includes2 = @import("includesLcase.zig");

inline fn runBench(comptime case: includes.Case, query: []const u8, value: []const u8, name: []const u8) void {
    const repeat: comptime_int = 10;
    const itAmount = 1_000;
    var count: usize = 0;

    std.mem.doNotOptimizeAway(query);
    std.mem.doNotOptimizeAway(value);

    // flush L1 and L2 cache (approximate with a large enough array read/write)
    var cache_flush: [1024 * 1024]u8 = undefined; // 1MB should flush L2 cache
    var flush_idx: usize = 0;
    var flush_sum: usize = 0;
    while (flush_idx < cache_flush.len) : (flush_idx += 1) {
        cache_flush[flush_idx] = @intCast(flush_idx % 256);
        flush_sum +%= cache_flush[flush_idx];
    }
    std.mem.doNotOptimizeAway(flush_sum);

    var j: usize = 0;
    var totalTime: i128 = 0;

    while (j < repeat) : (j += 1) {
        var time = std.time.nanoTimestamp();
        var i: usize = 0;
        while (i < itAmount) : (i += 1) {
            if (includes.includeInner(case, query, value)) count += 1;
            std.mem.doNotOptimizeAway(&count);
        }
        time = std.time.nanoTimestamp() - time;
        totalTime += time;
    }

    const d: comptime_int = 1000;
    std.debug.print("{s} {s}: {any} micro seconds matched: {any} \n", .{
        name,
        if (case != .default) "lcase" else "     ",
        @divExact(@divExact(totalTime, repeat), d),
        count,
    });
}

test "compare benchmark" {
    // const shortValue = "mrflApperdE@co";
    // const medium = " find mrflApperdE@co a small substring derp derp";

    const value = "this is a very long string {\"flap\": 100} that we are searching in, hoping to find a small substring hidden somewhere deep inside" ** 2245;
    const query1 = "de@dec";

    runBench(.default, query1, value, "medium");
    runBench(.lowerFast, query1, value, "medium");
    // runBench(false, query1, shortValue, "short");
    // runBench(true, query1, shortValue, "short");
}
