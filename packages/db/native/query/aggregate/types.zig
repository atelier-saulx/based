const std = @import("std");

pub const GroupedBy = enum(u8) {
    hasGroup = 255,
    none = 0,
};

pub const AggType = enum(u8) { SUM = 1, COUNT = 2, CARDINALITY = 3, STDDEV = 4, AVERAGE = 5, VARIANCE = 6, MAX = 7, MIN = 8, HMEAN = 9 };

pub const IsId = 255;

pub const GroupByHashMap = struct {
    inner: std.StringHashMap([]u8),
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) GroupByHashMap {
        return .{
            .inner = std.StringHashMap([]u8).init(allocator),
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *GroupByHashMap) void {
        var it = self.inner.keyIterator();
        while (it.next()) |key| {
            self.allocator.free(key.*);
        }
        self.inner.deinit();
    }

    pub fn put(self: *GroupByHashMap, key: []const u8, value: []u8) !void {
        const owned_key = try self.allocator.dupe(u8, key);
        errdefer self.allocator.free(owned_key);

        const result = try self.inner.getOrPut(owned_key);

        if (result.found_existing) {
            self.allocator.free(owned_key);
            result.value_ptr.* = value;
        } else {
            result.key_ptr.* = owned_key;
            result.value_ptr.* = value;
        }
    }

    pub fn getOrInsert(self: *GroupByHashMap, key: []const u8, accumulator_size: usize) !struct { value: []u8, is_new: bool } {
        if (self.inner.getEntry(key)) |entry| {
            return .{ .value = entry.value_ptr.*, .is_new = false };
        } else {
            const owned_key = try self.allocator.dupe(u8, key);
            errdefer self.allocator.free(owned_key);
            const result = try self.inner.getOrPut(owned_key);

            const new_accumulator = try self.allocator.alloc(u8, accumulator_size);
            @memset(new_accumulator, 0);

            result.key_ptr.* = owned_key;
            result.value_ptr.* = new_accumulator;
            return .{ .value = new_accumulator, .is_new = true };
        }
    }

    pub fn get(self: *GroupByHashMap, key: []const u8) ?[]u8 {
        return self.inner.get(key);
    }

    pub fn contains(self: *GroupByHashMap, key: []const u8) bool {
        return self.inner.contains(key);
    }

    pub fn remove(self: *GroupByHashMap, key: []const u8) ?[]u8 {
        if (self.inner.fetchRemove(key)) |entry| {
            self.allocator.free(entry.key);
            return entry.value;
        }
        return null;
    }

    pub const Iterator = std.StringHashMap([]u8).Iterator;
    pub fn iterator(self: *GroupByHashMap) Iterator {
        return self.inner.iterator();
    }
};

fn addStep(key: []u8, step: u16) @TypeOf(key) {
    const result = key[0..];

    var carry: u16 = step;
    for (result) |*byte| {
        if (carry == 0) break;

        const sum: u16 = @as(u16, byte.*) + @as(u8, @truncate(carry));
        byte.* = @as(u8, @truncate(sum));
        carry = (carry >> 8) + (sum >> 8);
    }

    return result;
}

fn isInRange(x: []const u8, keyA: []const u8, keyB: []const u8) bool {
    const gte_keyA = switch (compareLittleEndian(x, keyA)) {
        .lt => false,
        .eq, .gt => true,
    };

    const lt_keyB = switch (compareLittleEndian(x, keyB)) {
        .lt => true,
        .eq, .gt => false,
    };
    return gte_keyA and lt_keyB;
}

fn compareLittleEndian(a: []const u8, b: []const u8) std.math.Ordering {
    if (a.len > b.len) return .gt;
    if (a.len < b.len) return .lt;

    var i: usize = a.len;
    while (i > 0) {
        i -= 1;
        const byte_a = a[i];
        const byte_b = b[i];

        if (byte_a > byte_b) return .gt;
        if (byte_a < byte_b) return .lt;
    }
    return .eq;
}
