const std = @import("std");

const Node = struct {
    prefix: []const u8,
    id: ?u32,
    children: []*Node,
};

fn commonPrefixLen(a: []const u8, b: []const u8) usize {
    var i: usize = 0;
    const min_len = @min(a.len, b.len);
    while (i < min_len and a[i] == b[i]) : (i += 1) {}
    return i;
}

fn get1(root: *const Node, key: []const u8) ?u32 {
    var current = root;
    var remaining = key;

    while (true) {
        const match_len = commonPrefixLen(current.prefix, remaining);
        if (match_len < current.prefix.len) return null;
        if (match_len == current.prefix.len and match_len == remaining.len) return current.id;

        remaining = remaining[match_len..];
        var found = false;
        for (current.children) |child| {
            if (child.prefix.len > 0 and child.prefix[0] == remaining[0]) {
                current = child;
                found = true;
                break;
            }
        }
        if (!found) return null;
    }
}

fn get2(root: *const Node, key: []const u8) ?u32 {
    var current = root;
    var remaining = key;

    while (true) {
        if (!std.mem.startsWith(u8, remaining, current.prefix)) return null;
        if (current.prefix.len == remaining.len) return current.id;

        remaining = remaining[current.prefix.len..];
        const c = remaining[0];
        var found = false;
        for (current.children) |child| {
            // Children always have len > 0 string unless it's a root bug, our tree structure prevents it.
            if (child.prefix.len > 0 and child.prefix[0] == c) {
                current = child;
                found = true;
                break;
            }
        }
        if (!found) return null;
    }
}

pub fn main() !void {
    var c1 = Node{ .prefix = "list", .id = 1, .children = &[_]*Node{} };
    var c2 = Node{ .prefix = "create", .id = 2, .children = &[_]*Node{} };
    var children = [_]*Node{ &c1, &c2 };
    var api = Node{ .prefix = "api/users/", .id = null, .children = &children };
    var root_children = [_]*Node{&api};
    var root = Node{ .prefix = "/", .id = null, .children = &root_children };

    const iters: u32 = 10_000_000;
    var sum: u32 = 0;

    var timer = try std.time.Timer.start();
    for (0..iters) |_| {
        if (get1(&root, "/api/users/list")) |v| sum +%= v;
        if (get1(&root, "/api/users/create")) |v| sum +%= v;
        if (get1(&root, "/api/users/missing")) |v| sum +%= v;
    }
    const t1 = timer.lap();

    for (0..iters) |_| {
        if (get2(&root, "/api/users/list")) |v| sum +%= v;
        if (get2(&root, "/api/users/create")) |v| sum +%= v;
        if (get2(&root, "/api/users/missing")) |v| sum +%= v;
    }
    const t2 = timer.lap();

    std.debug.print("get1: {} ns\n", .{t1});
    std.debug.print("get2: {} ns\n", .{t2});
    std.debug.print("Sum: {}\n", .{sum});
}
