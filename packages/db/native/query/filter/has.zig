const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");

// shared block here derp
var decompressor: ?*selva.libdeflate_decompressor = null;
var libdeflate_block_state: ?selva.libdeflate_block_state = null;

const vectorLen = std.simd.suggestVectorLength(u8).?;
const capitals: @Vector(vectorLen, u8) = @splat(32);
const nulls: @Vector(vectorLen, u8) = @splat(255);
const indexes = std.simd.iota(u8, vectorLen);

const CbCtx = struct {
    query: []u8,
    currentQueryIndex: usize,
    queryVector: @Vector(vectorLen, u8),
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
    var loop: bool = true;
    var hasMatch: c_int = 0;
    var ctx: CbCtx = .{
        .query = query,
        .queryVector = @splat(query[0]),
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

// -----------------------------
pub inline fn default(value: []u8, query: []u8) bool {
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
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        const matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            const result = @select(u8, matches, indexes, nulls);
            const index = @reduce(.Min, result) + i;
            if (index + ql - 1 > l) {
                return false;
            }
            var j: usize = 1;
            while (j < ql) : (j += 1) {
                const v = value[index + j];
                const q = query[j];
                if ((v != q)) {
                    break;
                }
            }
            if (j == ql) {
                return true;
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
        }
    }
    return false;
}

// LOOSE
pub inline fn restVectorMatch(
    matches: @Vector(vectorLen, bool),
    i: usize,
    ql: usize,
    l: usize,
    value: []u8,
    query: []u8,
) u8 {
    const result = @select(u8, matches, indexes, nulls);
    const index = @reduce(.Min, result) + i;
    if (index + ql - 1 > l) {
        return 1;
    }
    var j: usize = 1;
    while (j < ql) : (j += 1) {
        const v = value[index + j];
        const q = query[j];
        if ((v != q and (v != (q - 32)))) {
            break;
        }
    }
    if (j == ql) {
        return 2;
    }
    return 0;
}

pub inline fn loose(value: []u8, query: []u8) bool {
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    const q1 = query[0];
    const q2 = q1 - 32;
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
        return false;
    }
    const queryVector: @Vector(vectorLen, u8) = @splat(q1);
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        var matches = h == queryVector;
        if ((@reduce(.Or, matches))) {
            const result = restVectorMatch(matches, i, ql, l, value, query);
            if (result != 0) {
                return result == 2;
            }
        } else {
            matches = (h + capitals) == queryVector;
            if (@reduce(.Or, matches)) {
                const result = restVectorMatch(matches, i, ql, l, value, query);
                if (result != 0) {
                    return result == 2;
                }
            }
        }
    }
    while (i < l and ql <= l - i) : (i += 1) {
        const v0 = value[i];
        if (v0 == q1 or v0 == q2) {
            if (i + ql - 1 > l) {
                return false;
            }
            var j: usize = 1;
            while (j < ql) : (j += 1) {
                const v = value[i + j];
                const q = query[j];
                if (v != q and v != q - 32) {
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

// COMPRESSED CHECK -----------------
const CbCtxLoose = struct {
    query: []u8,
    currentQueryIndex: usize,
    queryVector: @Vector(vectorLen, u8),
};

pub inline fn scanLooseCompressedPiece(ctx: *CbCtxLoose, value: []u8) bool {
    const query = ctx.query;
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        var matches = h == ctx.queryVector;
        if ((@reduce(.Or, matches))) {
            const result = restVectorMatch(matches, i, ql, l, value, query);
            if (result != 0) {
                return result == 2;
            }
        } else {
            matches = (h + capitals) == ctx.queryVector;
            if (@reduce(.Or, matches)) {
                const result = restVectorMatch(matches, i, ql, l, value, query);
                if (result != 0) {
                    return result == 2;
                }
            }
        }
    }
    const q0 = query[0];
    const q1 = query[1] - 32;
    while (i < l and ql <= l - i) : (i += 1) {
        const v0 = value[i];
        if (v0 == q0 or v0 == q1) {
            if (i + ql - 1 > l) {
                return false;
            }
            var j: usize = 1;
            while (j < ql) : (j += 1) {
                const v = value[i + j];
                const q = query[j];
                if (v != q and v != q - 32) {
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

pub fn looseCbHasCompressed(noalias ctx: ?*anyopaque, noalias buf: [*c]u8, size: usize) callconv(.C) c_int {
    const ctxDerp: *CbCtxLoose = @ptrCast(@alignCast(ctx.?));
    const found = scanLooseCompressedPiece(ctxDerp, buf[0..size]);
    if (found) {
        return 1;
    }
    return 0;
}

pub inline fn looseCompressed(value: []u8, query: []u8) bool {
    if (decompressor == null) {
        decompressor = selva.libdeflate_alloc_decompressor();
        libdeflate_block_state = selva.libdeflate_block_state_init(1000 * 1024);
    }
    var loop: bool = true;
    var hasMatch: c_int = 0;
    var ctx: CbCtxLoose = .{
        .query = query,
        .queryVector = @splat(query[0]),
        .currentQueryIndex = 0,
    };
    while (loop) {
        const result = selva.libdeflate_decompress_stream(
            decompressor,
            @ptrCast(&libdeflate_block_state.?),
            value[5..value.len].ptr,
            value.len - 5,
            looseCbHasCompressed,
            @ptrCast(&ctx),
            &hasMatch,
        );
        loop = result == selva.LIBDEFLATE_INSUFFICIENT_SPACE and selva.libdeflate_block_state_growbuf(&libdeflate_block_state.?);
    }
    return hasMatch == 1;
}
