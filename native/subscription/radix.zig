const std = @import("std");

pub const RadixTree = struct {
    const Node = struct {
        prefix: []const u8,
        ids: []u32,
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
            .ids = &[_]u32{},
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

    fn alignCursor(self: *RadixTree, comptime alignment: usize) void {
        const cur_addr = @intFromPtr(self.memory.ptr) + self.cursor;
        const aligned_addr = std.mem.alignForward(usize, cur_addr, alignment);
        self.cursor += (aligned_addr - cur_addr);
    }

    fn allocNode(self: *RadixTree) !*Node {
        self.alignCursor(@alignOf(Node));

        if (self.cursor + @sizeOf(Node) > self.memory.len) return error.OutOfMemory;

        const ptr = @as(*Node, @ptrCast(@alignCast(&self.memory[self.cursor])));
        self.cursor += @sizeOf(Node);
        return ptr;
    }

    fn allocIds(self: *RadixTree, n: usize) ![]u32 {
        if (n == 0) return &[_]u32{};

        self.alignCursor(@alignOf(u32));

        const bytes_needed = n * @sizeOf(u32);
        if (self.cursor + bytes_needed > self.memory.len) return error.OutOfMemory;

        const ptr = @as([*]u32, @ptrCast(@alignCast(&self.memory[self.cursor])));
        self.cursor += bytes_needed;
        return ptr[0..n];
    }

    fn allocChildren(self: *RadixTree, n: usize) ![]*Node {
        if (n == 0) return &[_]*Node{};

        self.alignCursor(@alignOf(*Node));

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
        return std.mem.indexOfDiff(u8, a, b) orelse @min(a.len, b.len);
    }

    pub fn get(self: *const RadixTree, key: []const u8) []const u32 {
        var current = self.root;
        var remaining = key;

        while (true) {
            if (!std.mem.startsWith(u8, remaining, current.prefix)) return &[_]u32{};
            if (current.prefix.len == remaining.len) return current.ids;

            remaining = remaining[current.prefix.len..];
            const c = remaining[0];
            var found = false;
            for (current.children) |child| {
                // Radix nodes (except root) always have prefix.len > 0
                if (child.prefix[0] == c) {
                    current = child;
                    found = true;
                    break;
                }
            }
            if (!found) return &[_]u32{};
        }
    }

    fn appendId(self: *RadixTree, current_ids: []u32, id: u32) ![]u32 {
        for (current_ids) |existing| {
            if (existing == id) return current_ids;
        }

        const new_ids = try self.allocIds(current_ids.len + 1);
        @memcpy(new_ids[0..current_ids.len], current_ids);
        new_ids[current_ids.len] = id;
        return new_ids;
    }

    pub fn insert(self: *RadixTree, key: []const u8, id: u32) !void {
        var current = self.root;
        var remaining = key;

        while (true) {
            const match_len = commonPrefixLen(current.prefix, remaining);

            if (match_len == current.prefix.len and match_len == remaining.len) {
                current.ids = try self.appendId(current.ids, id);
                return;
            }

            if (match_len == current.prefix.len) {
                remaining = remaining[match_len..];
                var found = false;
                for (current.children) |child| {
                    if (child.prefix[0] == remaining[0]) {
                        current = child;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    const new_node = try self.allocNode();
                    new_node.* = .{
                        .prefix = try self.dupeBytes(remaining),
                        .ids = try self.appendId(&[_]u32{}, id),
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
                // Prefix is already in the bump buffer; we can just slice it! No allocation needed.
                .prefix = current.prefix[match_len..],
                .ids = current.ids,
                .children = current.children,
            };

            current.prefix = current.prefix[0..match_len];
            current.ids = &[_]u32{};

            // Current now only has one child (the split tail)
            current.children = try self.allocChildren(1);
            current.children[0] = split_node;

            const leftover = remaining[match_len..];
            if (leftover.len > 0) {
                const new_node = try self.allocNode();
                new_node.* = .{
                    .prefix = try self.dupeBytes(leftover),
                    .ids = try self.appendId(&[_]u32{}, id),
                    .children = &[_]*Node{},
                };

                const old_children = current.children;
                const new_children = try self.allocChildren(old_children.len + 1);
                @memcpy(new_children[0..old_children.len], old_children);
                new_children[old_children.len] = new_node;
                current.children = new_children;
            } else {
                current.ids = try self.appendId(current.ids, id);
            }
            return;
        }
    }

    pub fn remove(self: *RadixTree, key: []const u8, id: u32) void {
        _ = self.removeRecursive(self.root, key, id);
    }

    fn removeRecursive(self: *RadixTree, current: *Node, key: []const u8, id: u32) bool {
        const match_len = commonPrefixLen(current.prefix, key);

        if (match_len < current.prefix.len) return false;

        if (match_len == current.prefix.len and match_len == key.len) {
            // Unset the ID by sliding
            var found_idx: ?usize = null;
            for (current.ids, 0..) |v, i| {
                if (v == id) {
                    found_idx = i;
                    break;
                }
            }

            if (found_idx) |idx| {
                for (idx..current.ids.len - 1) |i| {
                    current.ids[i] = current.ids[i + 1];
                }
                current.ids = current.ids[0 .. current.ids.len - 1];
            }
        } else {
            const remaining = key[match_len..];
            var child_idx: usize = 0;
            var found = false;
            while (child_idx < current.children.len) : (child_idx += 1) {
                const child = current.children[child_idx];
                if (child.prefix[0] == remaining[0]) {
                    if (self.removeRecursive(child, remaining, id)) {
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

        if (current.ids.len == 0 and current.children.len == 0 and current != self.root) {
            return true;
        }

        if (current.ids.len == 0 and current.children.len == 1 and current != self.root) {
            const child = current.children[0];

            // To be totally safe without an allocator, we allocate the merged string.
            // (The old strings are left as dead memory in the buffer).
            if (self.allocBytes(current.prefix.len + child.prefix.len)) |merged_prefix| {
                @memcpy(merged_prefix[0..current.prefix.len], current.prefix);
                @memcpy(merged_prefix[current.prefix.len..], child.prefix);

                current.prefix = merged_prefix;
                current.ids = child.ids;
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
            .ids = try self.allocIds(src.ids.len),
            .children = try self.allocChildren(src.children.len),
        };
        @memcpy(dest.ids, src.ids);

        for (src.children, 0..) |child, i| {
            dest.children[i] = try self.cloneNodeRecursive(child);
        }

        return dest;
    }
};

// EXAMPLE
// pub fn main() !void {
//     // 1. You entirely control the memory block. No standard allocators exist here.
//     var memory_block: [4096]u8 align(8) = undefined;
//     var tree = try RadixTree.init(&memory_block);

//     try tree.insert("/api/users", 1);
//     try tree.insert("/api/products", 2);

//     // 2. Lookup (.get) example
//     if (tree.get("/api/users")) |id| {
//         std.debug.print("Found User Route ID: {d}\n", .{id});
//     }

//     std.debug.print("Raw Bytes Used: {}\n", .{tree.usedMemory()});

//     // 3. Remove. Notice how `remove` doesn't even return an error anymore,
//     // because shifting the slice left requires ZERO new bytes.
//     tree.remove("/api/users");

//     // 4. Defrag into a smaller block
//     var compact_block: [1024]u8 align(8) = undefined;
//     var compacted_tree = try tree.defrag(&compact_block);

//     std.debug.print("Defrag Bytes Used: {}\n", .{compacted_tree.usedMemory()});
//     std.debug.print("Product Route ID: {?}\n", .{compacted_tree.get("/api/products")});
// }
