const std = @import("std");

pub const GroupedBy = enum(u8) {
    hasGroup = 255,
    none = 0,
};

pub const AggType = enum(u8) { SUM = 1, COUNT = 2, CARDINALITY = 3, STDDEV = 4, AVERAGE = 5, VARIANCE = 6, MAX = 7, MIN = 8 };

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
