const selva = @import("../../selva.zig");
const std = @import("std");
// shared block here derp
var decompressor: ?*selva.libdeflate_decompressor = null;
var libdeflate_block_state: ?selva.libdeflate_block_state = null;

pub const Ctx = struct {
    query: []u8,
    currentQueryIndex: usize,
    prevBlockIndex: usize,
};

pub const Compare = fn (
    comptime isOr: bool,
    ctx: *Ctx,
    value: []u8,
) bool;

fn comptimeCb(comptime compare: Compare, comptime isOr: bool) type {
    return struct {
        pub fn func(noalias ctxC: ?*anyopaque, noalias buf: [*c]u8, size: usize) callconv(.C) c_int {
            const ctx: *Ctx = @ptrCast(@alignCast(ctxC.?));
            std.debug.print("derp size {d} \n", .{size});
            const value = buf[ctx.prevBlockIndex .. ctx.prevBlockIndex + size];

            if (ctx.prevBlockIndex > 30) {
                std.debug.print("BLOCK {d} prev: {any} s: {any} \n", .{ value.len, buf[ctx.prevBlockIndex - 30 .. ctx.prevBlockIndex], value[0..30] });
            } else {
                std.debug.print("BLOCK {d} s: {any} \n", .{ value.len, value[0..30] });
            }

            const found = compare(
                isOr,
                ctx,
                value,
            );

            if (found) {
                return 1;
            }
            ctx.prevBlockIndex = ctx.prevBlockIndex + size;
            return 0;
        }
    };
}

pub inline fn decompress(
    comptime compare: Compare,
    comptime isOr: bool,
    query: []u8,
    value: []u8,
) bool {
    var ctx: Ctx = .{
        .query = query,
        .currentQueryIndex = 0,
        .prevBlockIndex = 0,
    };
    if (decompressor == null) {
        decompressor = selva.libdeflate_alloc_decompressor();
        // size...
        libdeflate_block_state = selva.libdeflate_block_state_init(1000);
    }
    var loop: bool = true;
    var hasMatch: c_int = 0;
    while (loop) {
        const result = selva.libdeflate_decompress_stream(
            decompressor,
            @ptrCast(&libdeflate_block_state.?),
            value[5..value.len].ptr,
            value.len - 5,
            comptimeCb(compare, isOr).func,
            @ptrCast(&ctx),
            &hasMatch,
        );
        loop = result == selva.LIBDEFLATE_INSUFFICIENT_SPACE and selva.libdeflate_block_state_growbuf(&libdeflate_block_state.?);
    }
    return hasMatch == 1;
}
