const std = @import("std");
const RadixTree = @import("native/subscription/radix.zig").RadixTree;

pub fn main() !void {
    var memory_block: [1024 * 1024]u8 align(64) = undefined;
    var tree = try RadixTree.init(&memory_block);

    const paths = [_][]const u8{
        "/api/users/list",
        "/api/users/create",
        "/api/users/delete",
        "/api/users/update",
        "/api/users/view",
        "/api/products/list",
        "/api/products/create",
        "/api/products/delete",
        "/api/products/update",
        "/api/products/view",
        "/api/orders/list",
        "/api/orders/create",
        "/api/orders/delete",
        "/api/orders/update",
        "/api/orders/view",
        "/auth/login",
        "/auth/logout",
        "/auth/register",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/config/settings",
        "/config/features",
        "/config/plans",
        "/health",
        "/metrics",
    };

    for (paths, 1..) |path, i| {
        try tree.insert(path, @as(u32, @intCast(i)));
    }

    var timer = try std.time.Timer.start();
    var sum: u32 = 0;
    
    for (0..1_000_000) |_| {
        for (paths) |path| {
            sum +%= @as(u32, @intCast(tree.get(path).len));
        }
    }
    const t_get = timer.lap();

    std.debug.print("Get time: {} ms\n", .{t_get / std.time.ns_per_ms});
    std.debug.print("Sum: {}\n", .{sum});
}
