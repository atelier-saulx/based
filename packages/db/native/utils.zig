const std = @import("std");
const builtin = @import("builtin");
const config = @import("config");

extern "c" fn memcpy(*anyopaque, *const anyopaque, usize) *anyopaque;
extern "c" fn memmove(*anyopaque, *const anyopaque, usize) *anyopaque;

// Only little endian for us (at least for now)
// const native_endian = builtin.cpu.arch.endian();

pub inline fn writeInt(comptime T: type, buffer: []u8, offset: usize, value: usize) void {
    const v: T = @truncate(value);
    const target = buffer[offset..][0..@sizeOf(T)];
    target.* = @bitCast(v);
}

pub inline fn writeIntExact(comptime T: type, buffer: []u8, offset: usize, value: T) void {
    const target = buffer[offset..][0..@sizeOf(T)];
    target.* = @bitCast(value);
}

pub inline fn toSlice(comptime T: type, value: []u8) []T {
    const size = @sizeOf(T);
    const x: []T = @as([*]T, @ptrCast(@alignCast(value.ptr)))[0..@divFloor(value.len, size)];
    return x;
}

pub inline fn read(comptime T: type, buffer: []u8, offset: usize) T {
    switch (@typeInfo(T)) {
        .pointer => |info| {
            if (info.size == .slice) {
                const ChildType = info.child;
                const s = @bitSizeOf(T) / 8;
                const value: T = @as([*]ChildType, @ptrCast(@alignCast(buffer.ptr)))[0..@divFloor(buffer.len, s)];
                return value;
            } else {
                @compileError("Read: Only slice pointers supported for now... " ++ @typeName(T));
            }
        },
        // .enum is a keyword so thats why you need this beauty
        .@"enum" => |info| {
            const TagType = info.tag_type;
            const intVal = read(TagType, buffer, offset);
            return @enumFromInt(intVal);
        },
        else => {
            const size = @bitSizeOf(T) / 8;
            const value: T = @bitCast(buffer[offset..][0..size].*);
            return value;
        },
    }
}

pub fn debugPrint(comptime format: []const u8, args: anytype) void {
    if (config.enable_debug) {
        std.debug.print(format, args);
    }
}

// TODO MERGE these 2
pub inline fn copy(dest: []u8, source: []const u8) void {
    if (builtin.link_libc) {
        _ = memcpy(dest.ptr, source.ptr, source.len);
    } else {
        @memcpy(dest[0..source.len], source);
    }
}

pub inline fn copyType(T: type, dest: []T, source: []const T) void {
    if (builtin.link_libc) {
        _ = memcpy(dest.ptr, source.ptr, source.len);
    } else {
        @memcpy(dest[0..source.len], source);
    }
}

pub inline fn move(dest: []u8, source: []const u8) void {
    _ = memmove(dest.ptr, source.ptr, source.len);
}

pub inline fn realign(comptime T: type, data: []u8) []T {
    const address = @intFromPtr(data.ptr);
    var offset = (@alignOf(T) - (address & (@alignOf(T) - 1))) & @alignOf(T);
    if (offset == 4) offset = 0;
    const aligned: []u8 align(@alignOf(T)) = @alignCast(data[offset .. data.len - (@alignOf(T) - 1) + offset]);
    if (offset != 0) move(aligned, data[0 .. data.len - (@alignOf(T) - 1)]);
    const p: *anyopaque = aligned.ptr;
    return @as([*]T, @ptrCast(@alignCast(p)))[0 .. aligned.len / @sizeOf(T)];
}
