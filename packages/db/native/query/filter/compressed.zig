const selva = @import("../../selva.zig");
const std = @import("std");
const db = @import("../../db/db.zig");

pub const Ctx = struct {
    query: []const u8,
    currentQueryIndex: usize,
};

pub const Compare = fn (value: []const u8, query: []const u8) callconv(.Inline) bool;

fn comptimeCb(comptime compare: Compare) type {
    return struct {
        pub fn func(noalias ctxC: ?*anyopaque, noalias buf: [*c]const u8, dict_size: usize, data_size: usize) callconv(.C) c_int {
            const ctx: *Ctx = @ptrCast(@alignCast(ctxC.?));
            var value: []const u8 = undefined;
            if (ctx.currentQueryIndex > 0) {
                const index = dict_size + ctx.currentQueryIndex;
                value = buf[index - ctx.query.len .. (index + data_size)];
            } else {
                value = buf[(ctx.currentQueryIndex - ctx.query.len + dict_size) .. ctx.currentQueryIndex + data_size + dict_size];
            }
            const found = compare(
                value,
                ctx.query,
            );
            if (found) {
                return 1;
            }
            ctx.currentQueryIndex = ctx.currentQueryIndex + data_size + dict_size;
            return 0;
        }
    };
}

pub inline fn decompress(
    comptime compare: Compare,
    query: []const u8,
    value: []const u8,
    dbCtx: *db.DbCtx,
) bool {
    var ctx: Ctx = .{
        .query = query,
        .currentQueryIndex = 0,
    };
    var loop: bool = true;
    var hasMatch: c_int = 0;
    while (loop) {
        const result = selva.libdeflate_decompress_stream(
            dbCtx.decompressor,
            &dbCtx.libdeflate_block_state,
            value[5..value.len].ptr,
            value.len - 5,
            comptimeCb(compare).func,
            @ptrCast(&ctx),
            &hasMatch,
        );
        loop = result == selva.LIBDEFLATE_INSUFFICIENT_SPACE and selva.libdeflate_block_state_growbuf(
            &dbCtx.libdeflate_block_state,
        );
    }
    return hasMatch == 1;
}
