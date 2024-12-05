const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");

// shared block here derp
var decompressor: ?*selva.libdeflate_decompressor = null;
var libdeflate_block_state: ?selva.libdeflate_block_state = null;

const vectorLen = std.simd.suggestVectorLength(u8).?;

const CbCtx = struct {
    query: []u8,
    currentQueryIndex: usize,
    queryVector: @Vector(vectorLen, u8),
    indexes: @Vector(vectorLen, u8),
    nulls: @Vector(vectorLen, u8),
};

// code with int 1 = false, 2 = true, 3 = continue
pub inline fn scanCompressedPiece(ctx: *CbCtx, value: []u8) bool {
    const query = ctx.query;
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        const matches = h == ctx.queryVector;
        if (@reduce(.Or, matches)) {
            if (l > 1) {
                const result = @select(u8, matches, ctx.indexes, ctx.nulls);
                const index = @reduce(.Min, result) + i;
                if (index + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[index + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
    }
    while (i < l and ql <= l - i) : (i += 1) {
        const id2 = value[i];
        if (id2 == query[0]) {
            if (i + ql - 1 > l) {
                return false;
            }
            var j: usize = 1;
            while (j < ql) : (j += 1) {
                if (value[i + j] != query[j]) {
                    break;
                }
            }
            if (j == ql) {
                return true;
            }
            return true;
        }
    }
    return false;
}

pub fn cbHasCompressed(noalias ctx: ?*anyopaque, noalias buf: [*c]u8, size: usize) callconv(.C) c_int {
    const ctxDerp: *CbCtx = @ptrCast(@alignCast(ctx.?));
    const found = scanCompressedPiece(ctxDerp, buf[0..size]);
    if (found) {
        return 1;
    }
    return 0;
}

pub inline fn compressed(value: []u8, query: []u8) bool {
    if (decompressor == null) {
        decompressor = selva.libdeflate_alloc_decompressor();
        libdeflate_block_state = selva.libdeflate_block_state_init(1000 * 1024);
    }
    // you can just reuse the struct libdeflate_block_state already. Just pass it to the next decompress.
    // var libdeflate_block_state = selva.libdeflate_block_state_init(1024);
    // defer selva.libdeflate_block_state_deinit(&libdeflate_block_state);

    var loop: bool = true;
    var hasMatch: c_int = 0;
    var ctx: CbCtx = .{
        .query = query,
        .queryVector = @splat(query[0]),
        .indexes = std.simd.iota(u8, vectorLen),
        .nulls = @splat(@as(u8, 255)),
        .currentQueryIndex = 0,
    };
    while (loop) {
        const result = selva.libdeflate_decompress_stream(
            decompressor,
            @ptrCast(&libdeflate_block_state.?),
            value[5..value.len].ptr,
            value.len - 5,
            cbHasCompressed,
            @ptrCast(&ctx),
            &hasMatch,
        );
        loop = result == selva.LIBDEFLATE_INSUFFICIENT_SPACE and selva.libdeflate_block_state_growbuf(&libdeflate_block_state.?);
    }
    return hasMatch == 1;
}

pub fn default(value: []u8, query: []u8) bool {
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    if (l < vectorLen) {
        while (i < l) : (i += 1) {
            if (value[i] == query[0]) {
                if (i + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[i + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
        return false;
    }
    const queryVector: @Vector(vectorLen, u8) = @splat(query[0]);
    const indexes = std.simd.iota(u8, vectorLen);
    const nulls: @Vector(vectorLen, u8) = @splat(@as(u8, 255));
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        const matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            if (l > 1) {
                const result = @select(u8, matches, indexes, nulls);
                const index = @reduce(.Min, result) + i;
                if (index + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[index + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
    }
    while (i < l and ql <= l - i) : (i += 1) {
        const id2 = value[i];
        if (id2 == query[0]) {
            if (i + ql - 1 > l) {
                return false;
            }
            var j: usize = 1;
            while (j < ql) : (j += 1) {
                if (value[i + j] != query[j]) {
                    break;
                }
            }
            if (j == ql) {
                return true;
            }
            return true;
        }
    }
    return false;
}

pub fn loose(value: []u8, query: []u8) bool {
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;

    const q1 = query[0];
    var q2: u8 = 0;
    if (q1 > 97) {
        q2 = q1 - 32;
    } else if (q1 < 90) {
        q2 = q1 + 32;
    }

    if (l < vectorLen) {
        while (i < l) : (i += 1) {
            if (value[i] == q1 or value[i] == q2) {
                if (i + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[i + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
    }
    const queryVector: @Vector(vectorLen, u8) = @splat(q1);
    const queryVector2: @Vector(vectorLen, u8) = @splat(q2);
    const indexes = std.simd.iota(u8, vectorLen);
    const nulls: @Vector(vectorLen, u8) = @splat(@as(u8, 255));
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        const matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            if (l > 1) {
                const result = @select(u8, matches, indexes, nulls);
                const index = @reduce(.Min, result) + i;
                if (index + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[index + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
        const matches2 = h == queryVector2;
        if (@reduce(.Or, matches2)) {
            if (l > 1) {
                const result = @select(u8, matches2, indexes, nulls);
                const index = @reduce(.Min, result) + i;
                if (index + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[index + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
    }

    while (i < l and ql <= l - i) : (i += 1) {
        const id2 = value[i];
        if (id2 == q1 or id2 == q2) {
            if (i + ql - 1 > l) {
                return false;
            }
            var j: usize = 1;
            while (j < ql) : (j += 1) {
                if (value[i + j] != query[j]) {
                    break;
                }
            }
            if (j == ql) {
                return true;
            }
            return true;
        }
    }

    return false;
}
