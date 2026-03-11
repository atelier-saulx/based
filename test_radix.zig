const std = @import("std");
const RadixTree = @import("native/subscription/radix.zig").RadixTree;

test "radix basic operations" {
    var memory_block: [4096]u8 align(8) = undefined;
    var tree = try RadixTree.init(&memory_block);

    try tree.insert("/api/users", 1);
    try tree.insert("/api/products", 2);
    try tree.insert("/api/users", 3); // Append a second one to the set

    const u_ids = tree.get("/api/users");
    try std.testing.expectEqual(u_ids.len, 2);
    try std.testing.expectEqual(@as(u32, 1), u_ids[0]);
    try std.testing.expectEqual(@as(u32, 3), u_ids[1]);

    const p_ids = tree.get("/api/products");
    try std.testing.expectEqual(p_ids.len, 1);
    try std.testing.expectEqual(@as(u32, 2), p_ids[0]);

    const m_ids = tree.get("/api/missing");
    try std.testing.expectEqual(m_ids.len, 0);

    tree.remove("/api/users", 1);
    const u_ids2 = tree.get("/api/users");
    try std.testing.expectEqual(u_ids2.len, 1);
    try std.testing.expectEqual(@as(u32, 3), u_ids2[0]);

    tree.remove("/api/users", 3);
    const u_ids3 = tree.get("/api/users");
    try std.testing.expectEqual(u_ids3.len, 0);

    var compact_block: [1024]u8 align(8) = undefined;
    var compacted_tree = try tree.defrag(&compact_block);

    try std.testing.expectEqual(compacted_tree.get("/api/users").len, 0);
    try std.testing.expectEqual(compacted_tree.get("/api/products").len, 1);
    try std.testing.expectEqual(@as(u32, 2), compacted_tree.get("/api/products")[0]);
}
