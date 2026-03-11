const std = @import("std");

fn commonPrefixLen(a: []const u8, b: []const u8) usize {
    var i: usize = 0;
    const min_len = @min(a.len, b.len);
    while (i < min_len and a[i] == b[i]) : (i += 1) {}
    return i;
}

pub fn main() !void {
    const a = "hello world this is a test string";
    const b = "hello world this is a test struct";

    var timer = try std.time.Timer.start();
    var sum: usize = 0;
    for (0..10_000_000) |_| {
        sum += commonPrefixLen(a, b);
    }
    const t1 = timer.lap();

    for (0..10_000_000) |_| {
        // std.mem.indexOfDiff(u8, a, b) orelse @min(a.len, b.len);
        sum += std.mem.indexOfDiff(u8, a, b) orelse @min(a.len, b.len);
    }
    const t2 = timer.lap();

    std.debug.print("commonPrefixLen: {} ns\n", .{t1});
    std.debug.print("indexOfDiff(): {} ns\n", .{t2});
    std.debug.print("Sum: {}\n", .{sum});
}
