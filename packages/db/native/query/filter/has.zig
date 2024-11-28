const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");

// var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
// defer arena.deinit();
// const allocator = arena.allocator();

// shared block here derp
// var decompressor: ?*selva.libdeflate_decompressor = null;

// const flap: [1000]u8 = .{};

pub fn compressed(value: []u8, query: []u8) bool {

    // shared mem block
    // try with ZIG ⚡️
    // lowercase on compressed also on decompressed
    // try compression lvl 1

    // if (decompressor == null) {
    //     decompressor = selva.libdeflate_alloc_decompressor();
    // }

    // get some blocks?
    // get some fun?
    // use something else?
    // libdeflate_decompress_stream
    // struct libdeflate_decompressor *decompressor,
    // struct libdeflate_block_state *state,
    // const char *in_buf, size_t in_len,
    // const void *needle_buf, size_t needle_len,
    // wctrans_t trans, locale_t loc)
    //

    // std.debug.print("flap {any} \n", .{flap});
    // return selva.selva_deflate_mbsstrstr(
    //     decompressor.?,
    // );

    const vectorLen = std.simd.suggestVectorLength(u8).?;
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;

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

pub fn default(value: []u8, query: []u8) bool {
    const vectorLen = std.simd.suggestVectorLength(u8).?;
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
