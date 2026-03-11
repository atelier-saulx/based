const std = @import("std");

pub fn main() !void {
    const a = "hello world";
    const b = "hello buddy";
    const diff = std.mem.indexOfDiff(u8, a, b);
    std.debug.print("Diff: {any}\n", .{diff});
}
