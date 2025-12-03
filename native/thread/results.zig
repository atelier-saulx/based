const std = @import("std");
const t = @import("../types.zig");
const utils = @import("../utils.zig");
const String = @import("../string.zig");

pub const Result = struct {
    data: []u8,
    index: usize,
    headerIndex: usize,

    pub fn init() !*Result {
        var r = try std.heap.raw_c_allocator.create(Result);
        r.data = try std.heap.raw_c_allocator.alloc(u8, 0);
        r.*.index = 0;
        r.*.headerIndex = 0;
        return r;
    }

    pub fn deinit(self: *Result) void {
        std.heap.raw_c_allocator.free(self.data);
        std.heap.raw_c_allocator.destroy(self);
    }

    pub inline fn grow(self: *Result, extraSize: usize) !usize {
        var increasedSize: usize = 10_000_000;
        const newSize = self.index + extraSize;
        if (self.data.len < newSize) {
            if (extraSize > increasedSize) {
                increasedSize = (@divTrunc(extraSize, increasedSize) + 1) * increasedSize;
            }
            self.data = try std.heap.raw_c_allocator.realloc(self.data, self.data.len + increasedSize);
        }
        return newSize;
    }

    pub inline fn result(self: *Result, size: usize, id: u32, opType: t.OpType) ![]u8 {
        const offset = 9;
        const paddedSize: u32 = @truncate(size + offset);
        self.headerIndex = self.index;
        self.index = try self.grow(paddedSize);
        utils.writeAs(u32, self.data, id, self.headerIndex + 4);
        self.data[self.headerIndex + 8] = @intFromEnum(opType);
        return self.data[self.headerIndex + offset .. self.index];
    }

    pub inline fn reserve(self: *Result, size: usize) !usize {
        const paddedSize: u32 = @truncate(size); // zero padding for growth
        const prev = self.index;
        self.index = try self.grow(paddedSize);
        return prev;
    }

    pub inline fn slice(self: *Result, size: usize) ![]u8 {
        const newLen = try self.grow(size);
        const data = self.data[self.index..newLen];
        self.index = newLen;
        return data;
    }

    pub inline fn write(self: *Result, value: anytype, offset: usize) void {
        utils.write(self.data, value, offset);
    }

    pub inline fn writeAs(
        self: *Result,
        comptime T: type,
        value: T,
        offset: usize,
    ) void {
        @compileLog(T);
        utils.writeAs(T, self.data, value, offset);
    }

    pub inline fn append(self: *Result, value: anytype) !void {
        const T = @TypeOf(value);
        switch (@typeInfo(T)) {
            .pointer => |info| {
                if (info.size == .slice) {
                    utils.write(try self.slice(value.len), value, 0);
                } else {
                    @compileError("Read: Only slice pointers supported for now... " ++ @typeName(T));
                }
            },
            else => {
                utils.write(try self.slice(utils.sizeOf(T)), value, 0);
            },
        }
    }

    pub inline fn appendAs(self: *Result, comptime T: type, value: T) !usize {
        const size = utils.sizeOf(T);
        utils.writeAs(T, try self.slice(size), value, 0);
        return size;
    }

    pub inline fn checksum(self: *Result) !void {
        const index = self.index;
        const start = self.headerIndex + 9;
        if (index != start) {
            const x = self.data[start..index];
            try self.append(String.c.crc32c(0, x.ptr, x.len));
        }
    }

    pub inline fn commit(self: *Result) void {
        utils.writeAs(u32, self.data, self.index - self.headerIndex, self.headerIndex);
    }
};
