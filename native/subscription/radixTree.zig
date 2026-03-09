const std = @import("std");

pub const RadixTree = struct {
    const Node = struct {
        prefix: []const u8,
        id: ?u32,
        children: []*Node, // Replaced ArrayList with a raw slice
    };

    memory: []u8,
    cursor: usize,
    root: *Node,

    /// Initialize the tree using a raw byte slice.
    pub fn init(buffer: []u8) !RadixTree {
        var tree = RadixTree{
            .memory = buffer,
            .cursor = 0,
            .root = undefined, // Set immediately below
        };

        // Allocate the root node manually
        tree.root = try tree.allocNode();
        tree.root.* = .{
            .prefix = &[_]u8{},
            .id = null,
            .children = &[_]*Node{},
        };

        return tree;
    }

    /// Returns how many bytes of the `[]u8` block are currently used.
    pub fn usedMemory(self: *const RadixTree) usize {
        return self.cursor;
    }

    // ==========================================
    // CUSTOM BUMP ALLOCATOR LOGIC
    // ==========================================

    fn allocBytes(self: *RadixTree, n: usize) ![]u8 {
        if (self.cursor + n > self.memory.len) return error.OutOfMemory;
        const slice = self.memory[self.cursor .. self.cursor + n];
        self.cursor += n;
        return slice;
    }

    fn dupeBytes(self: *RadixTree, src: []const u8) ![]u8 {
        const dest = try self.allocBytes(src.len);
        @memcpy(dest, src);
        return dest;
    }

    fn allocNode(self: *RadixTree) !*Node {
        // We must align the cursor so the Node struct doesn't cause a CPU alignment panic
        const align_mask = @alignOf(Node) - 1;
        self.cursor = (self.cursor + align_mask) & ~align_mask;

        if (self.cursor + @sizeOf(Node) > self.memory.len) return error.OutOfMemory;

        const ptr = @as(*Node, @ptrCast(@alignCast(&self.memory[self.cursor])));
        self.cursor += @sizeOf(Node);
        return ptr;
    }

    fn allocChildren(self: *RadixTree, n: usize) ![]*Node {
        if (n == 0) return &[_]*Node{};

        const align_mask = @alignOf(*Node) - 1;
        self.cursor = (self.cursor + align_mask) & ~align_mask;

        const bytes_needed = n * @sizeOf(*Node);
        if (self.cursor + bytes_needed > self.memory.len) return error.OutOfMemory;

        const ptr = @as([*]*Node, @ptrCast(@alignCast(&self.memory[self.cursor])));
        self.cursor += bytes_needed;
        return ptr[0..n];
    }

    // ==========================================
    // TREE LOGIC
    // ==========================================

    fn commonPrefixLen(a: []const u8, b: []const u8) usize {
        var i: usize = 0;
        const min_len = @min(a.len, b.len);
        while (i < min_len and a[i] == b[i]) : (i += 1) {}
        return i;
    }

    pub fn get(self: *const RadixTree, key: []const u8) ?u32 {
        var current = self.root;
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

    pub fn insert(self: *RadixTree, key: []const u8, id: u32) !void {
        var current = self.root;
        var remaining = key;

        while (true) {
            const match_len = commonPrefixLen(current.prefix, remaining);

            if (match_len == current.prefix.len and match_len == remaining.len) {
                current.id = id;
                return;
            }

            if (match_len == current.prefix.len) {
                remaining = remaining[match_len..];
                var found = false;
                for (current.children) |child| {
                    if (child.prefix.len > 0 and child.prefix[0] == remaining[0]) {
                        current = child;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    const new_node = try self.allocNode();
                    new_node.* = .{
                        .prefix = try self.dupeBytes(remaining),
                        .id = id,
                        .children = &[_]*Node{},
                    };

                    // Allocate a new slice for children (old slice is abandoned)
                    const old_children = current.children;
                    const new_children = try self.allocChildren(old_children.len + 1);
                    @memcpy(new_children[0..old_children.len], old_children);
                    new_children[old_children.len] = new_node;

                    current.children = new_children;
                    return;
                }
                continue;
            }

            // SPLIT LOGIC
            const split_node = try self.allocNode();
            split_node.* = .{
                .prefix = try self.dupeBytes(current.prefix[match_len..]),
                .id = current.id,
                .children = current.children,
            };

            current.prefix = try self.dupeBytes(current.prefix[0..match_len]);
            current.id = null;

            // Current now only has one child (the split tail)
            current.children = try self.allocChildren(1);
            current.children[0] = split_node;

            const leftover = remaining[match_len..];
            if (leftover.len > 0) {
                const new_node = try self.allocNode();
                new_node.* = .{
                    .prefix = try self.dupeBytes(leftover),
                    .id = id,
                    .children = &[_]*Node{},
                };

                const old_children = current.children;
                const new_children = try self.allocChildren(old_children.len + 1);
                @memcpy(new_children[0..old_children.len], old_children);
                new_children[old_children.len] = new_node;
                current.children = new_children;
            } else {
                current.id = id;
            }
            return;
        }
    }

    pub fn remove(self: *RadixTree, key: []const u8) void {
        _ = self.removeRecursive(self.root, key);
    }

    fn removeRecursive(self: *RadixTree, current: *Node, key: []const u8) bool {
        const match_len = commonPrefixLen(current.prefix, key);

        if (match_len < current.prefix.len) return false;

        if (match_len == current.prefix.len and match_len == key.len) {
            current.id = null;
        } else {
            const remaining = key[match_len..];
            var child_idx: usize = 0;
            var found = false;
            while (child_idx < current.children.len) : (child_idx += 1) {
                const child = current.children[child_idx];
                if (child.prefix.len > 0 and child.prefix[0] == remaining[0]) {
                    if (self.removeRecursive(child, remaining)) {
                        // In-place removal. We just shift the pointers left and shrink the slice.
                        // This costs ZERO memory overhead.
                        for (child_idx..current.children.len - 1) |i| {
                            current.children[i] = current.children[i + 1];
                        }
                        current.children = current.children[0 .. current.children.len - 1];
                    }
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }

        if (current.id == null and current.children.len == 0 and current != self.root) {
            return true;
        }

        if (current.id == null and current.children.len == 1 and current != self.root) {
            const child = current.children[0];

            // To be totally safe without an allocator, we allocate the merged string.
            // (The old strings are left as dead memory in the buffer).
            if (self.allocBytes(current.prefix.len + child.prefix.len)) |merged_prefix| {
                @memcpy(merged_prefix[0..current.prefix.len], current.prefix);
                @memcpy(merged_prefix[current.prefix.len..], child.prefix);

                current.prefix = merged_prefix;
                current.id = child.id;
                current.children = child.children;
            } else |_| {
                // If we run out of memory during a compression merge, we gracefully fail
                // and just leave the nodes un-merged. It still functions perfectly.
            }
        }

        return false;
    }

    // ==========================================
    // DEFRAGMENTATION LOGIC
    // ==========================================

    /// Rebuilds the tree into a new `[]u8` block, abandoning all dead memory.
    pub fn defrag(self: *const RadixTree, new_buffer: []u8) !RadixTree {
        var new_tree = try RadixTree.init(new_buffer);

        // Pre-allocate the root's children array
        new_tree.root.children = try new_tree.allocChildren(self.root.children.len);

        for (self.root.children, 0..) |child, i| {
            new_tree.root.children[i] = try new_tree.cloneNodeRecursive(child);
        }

        return new_tree;
    }

    fn cloneNodeRecursive(self: *RadixTree, src: *Node) !*Node {
        const dest = try self.allocNode();

        dest.* = .{
            .prefix = try self.dupeBytes(src.prefix),
            .id = src.id,
            .children = try self.allocChildren(src.children.len),
        };

        for (src.children, 0..) |child, i| {
            dest.children[i] = try self.cloneNodeRecursive(child);
        }

        return dest;
    }
};

// EXAMPLE
// pub fn main() !void {
//     // 1. You entirely control the memory block. No standard allocators exist here.
//     var memory_block: [4096]u8 = undefined;
//     var tree = try RadixTree.init(&memory_block);

//     try tree.insert("/api/users", 1);
//     try tree.insert("/api/products", 2);

//     std.debug.print("Raw Bytes Used: {}\n", .{tree.usedMemory()});

//     // 2. Remove. Notice how `remove` doesn't even return an error anymore,
//     // because shifting the slice left requires ZERO new bytes.
//     tree.remove("/api/users");

//     // 3. Defrag into a smaller block
//     var compact_block: [1024]u8 = undefined;
//     var compacted_tree = try tree.defrag(&compact_block);

//     std.debug.print("Defrag Bytes Used: {}\n", .{compacted_tree.usedMemory()});
//     std.debug.print("Product Route ID: {?}\n", .{compacted_tree.get("/api/products")});
// }
