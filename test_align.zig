const std = @import("std");
const RadixTree = @import("native/subscription/radix.zig").RadixTree;

test "radix align panic" {
    // deliberately unaligned buffer
    var big_block: [4096]u8 align(64) = undefined;
    const unaligned_block = big_block[1..4000];

    var tree = try RadixTree.init(unaligned_block);
    try tree.insert("/api/users", 1);
    
    try std.testing.expectEqual(@as(?u32, 1), tree.get("/api/users"));
}
