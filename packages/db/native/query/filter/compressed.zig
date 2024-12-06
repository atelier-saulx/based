const selva = @import("../../selva.zig");
const std = @import("std");
// shared block here derp
var decompressor: ?*selva.libdeflate_decompressor = null;
var libdeflate_block_state: ?selva.libdeflate_block_state = null;

pub const Ctx = struct {
    query: []u8,
    currentQueryIndex: usize,
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
            var value: []u8 = undefined;
            if (ctx.currentQueryIndex > 0) {
                value = buf[0..size];
            } else {
                value = buf[ctx.currentQueryIndex - ctx.query.len .. ctx.currentQueryIndex + size];
            }
            std.debug.print("BLOCK TIME {d} {any} \n", .{ size, value[0..100] });
            const found = compare(
                isOr,
                ctx,
                value,
            );
            if (found) {
                return 1;
            }
            ctx.currentQueryIndex = ctx.currentQueryIndex + size;
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
    };
    if (decompressor == null) {
        decompressor = selva.libdeflate_alloc_decompressor();
        libdeflate_block_state = selva.libdeflate_block_state_init(1000 * 1024);
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
        std.debug.print("flap {any} \n", .{result});
        loop = result == selva.LIBDEFLATE_INSUFFICIENT_SPACE and selva.libdeflate_block_state_growbuf(&libdeflate_block_state.?);
    }
    return hasMatch == 1;
}

// enum libdeflate_decompress_stop_by {
//       LIBDEFLATE_STOP_BY_FINAL_BLOCK                = 0,
//       LIBDEFLATE_STOP_BY_ANY_BLOCK                  = 1,
//       LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_INPUT   = 2,
//       LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_OUTPUT  = 3,
//       LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_OUTPUT_AND_IN_BYTE_ALIGN = 4,
