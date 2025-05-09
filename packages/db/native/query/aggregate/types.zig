const std = @import("std");

pub const GroupedBy = enum(u8) {
    hasGroup = 255,
    none = 0,
};

pub const AggType = enum(u8) { SUM = 1, COUNT = 2, _ };

pub const IsId = 255;

pub const GroupByHashMap = struct {
    // AutoHashMap do not allow slicing (required to variable key sizes), this wrapper addresses that.
    // Main reason is just to extend the hashmap put() with dupe + free but this wrapper also would be able to
    // help making values a generic number type in future.
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
