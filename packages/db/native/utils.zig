const std = @import("std");
const builtin = @import("builtin");
// const native_endian = builtin.cpu.arch.endian();
// Only little endian for us

pub inline fn readInt(comptime T: type, buffer: []const u8, offset: usize) T {
    if (T == f64) {
        const value: T = @bitCast(buffer[offset .. offset + 8].*);
        return value;
    } else if (T == u8) {
        return buffer[offset];
    }
    const value: T = @bitCast(buffer[offset..][0..@divExact(@typeInfo(T).Int.bits, 8)].*);
    return value;
}

pub inline fn writeInt(comptime T: type, buffer: []u8, offset: usize, value: usize) void {
    const v: T = @truncate(value);
    const target = buffer[offset..][0..@divExact(@typeInfo(T).Int.bits, 8)];
    target.* = @bitCast(v);
}

pub inline fn toSlice(comptime T: type, value: []u8) []T {
    const size = if (T == f32 or T == u32 or T == i32) 4 else if (T == f64 or T == u64 or T == i64) 8 else if (T == u16 or T == i16) 2;
    const x: []T = @as([*]T, @alignCast(@ptrCast(value.ptr)))[0..@divFloor(value.len, size)];
    return x;
}

pub inline fn read(comptime T: type, buffer: []const u8, offset: usize) T {
    const isSlice = T == []u64 or T == []u8 or T == []u32 or T == []f32 or T == []f64 or T == []u16 or T == []u8 or T == []i8 or T == []i16 or T == []i32 or T == []i64;
    if (isSlice) {
        return toSlice(T, buffer, offset);
    }
    const size = if (T == f32 or T == u32 or T == i32) 4 else if (T == f64 or T == u64 or T == i64) 8 else if (T == u16 or T == i16) 2;
    const value: T = @bitCast(buffer[offset..][0..size].*);
    return value;
}
