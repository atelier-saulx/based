const std = @import("std");
const builtin = @import("builtin");
const native_endian = builtin.cpu.arch.endian();
// TODO opt for big endian
const isLittle = true; //native_endian == .little;

pub inline fn readInt(comptime T: type, buffer: []u8, offset: usize) T {
    const value: T = @bitCast(buffer[offset..][0..@divExact(@typeInfo(T).Int.bits, 8)].*);
    return if (isLittle) value else @byteSwap(value);
}

pub inline fn writeInt(comptime T: type, buffer: []u8, offset: usize, value: usize) void {
    const v: T = @truncate(value);
    const target = buffer[offset..][0..@divExact(@typeInfo(T).Int.bits, 8)];
    target.* = @bitCast(if (isLittle) v else @byteSwap(v));
}
