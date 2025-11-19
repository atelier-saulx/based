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
    const size = if (T == f32 or T == u32 or T == i32) 4 else if (T == f64 or T == u64 or T == i64) 8 else if (T == u16 or T == i16) 2;
    const x: []T = @as([*]T, @alignCast(@ptrCast(value.ptr)))[0..@divFloor(value.len, size)];
    return x;
}

pub inline fn read(comptime T: type, buffer: []u8, offset: usize) T {
    const isSlice = T == []u64 or T == []u8 or T == []u32 or T == []f32 or T == []f64 or T == []u16 or T == []u8 or T == []i8 or T == []i16 or T == []i32 or T == []i64;
    if (isSlice) {
        const X = switch (@typeInfo(T)) {
            .pointer => |info| info.child,
            else => @compileError("Expected pointer type"),
        };
        const s = if (X == f32 or X == u32 or X == i32) 4 else if (X == f64 or X == u64 or X == i64) 8 else if (X == u16 or X == i16) 2;
        const x: T = @as([*]X, @alignCast(@ptrCast(buffer.ptr)))[0..@divFloor(buffer.len, s)];
        return x;
    }
    const size = if (T == f32 or T == u32 or T == i32) 4 else if (T == f64 or T == u64 or T == i64) 8 else if (T == u16 or T == i16) 2 else if (T == u8 or T == i8) 1;
    const value: T = @bitCast(buffer[offset..][0..size].*);
    return value;
}

pub fn debugPrint(comptime format: []const u8, args: anytype) void {
    if (config.enable_debug) {
        std.debug.print(format, args);
    }
}

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
    const offset: u8 = @truncate(address % @alignOf(T));
    // const offset2 = (@alignOf(T) - (address & (@alignOf(T) - 1))) & @alignOf(T);
    const aligned: []u8 align(@alignOf(T)) = @alignCast(data[offset .. data.len - (@alignOf(T) - 1) + offset]);
    if (offset != 0) {
        move(aligned, data[0 .. data.len - (@alignOf(T) - 1)]);
    }
    const p: *anyopaque = aligned.ptr;
    return @as([*]T, @ptrCast(@alignCast(p)))[0 .. aligned.len / @sizeOf(T)];
}
