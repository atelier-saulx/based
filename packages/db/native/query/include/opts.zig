const types = @import("./types.zig");
const std = @import("std");
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const t = @import("../../types.zig");
const selva = @import("../../selva.zig").c;
const results = @import("../results.zig");
const errors = @import("../../errors.zig");
const utils = @import("../../utils.zig");
const decompressFirstBytes = @import("../../deflate.zig").decompressFirstBytes;

pub const IncludeOpts = struct { end: u32, isChars: bool };

pub inline fn getOpts(v: []u8, i: *u16) *const IncludeOpts {
    return &.{ .end = utils.read(u32, v, i.* + 1), .isChars = v[i.*] == 1 };
}

// Non string slice (bytes)
pub fn parseOpts(
    value: []u8,
    opts: *const IncludeOpts,
) []u8 {
    if (opts.end != 0) {
        if (value.len < opts.end) {
            return value[0..value.len];
        } else {
            return value[0..opts.end];
        }
    }
    return value;
}

pub inline fn isFlagEmoj(i: *usize, len: *const usize, charLen: *u32, value: []u8) bool {
    return i.* + 8 < len.* and
        charLen.* == 3 and
        value[i.*] == 240 and
        value[i.* + 1] == 159 and
        value[i.* + 2] == 135 and
        value[i.* + 4] == 240;
}

fn parseCharEndDeflate(
    ctx: *QueryCtx,
    value: []u8,
    opts: *const IncludeOpts,
    extraSize: *usize,
) []u8 {
    const size = utils.read(u32, value, 2);
    const allocLen: usize = opts.end + 2 + extraSize.*;
    if (size < allocLen) {
        return value;
    }
    const alloc = ctx.allocator.alloc(u8, allocLen) catch |err| {
        std.log.err("Error allocating mem parseCharEndDeflate {any} \n", .{err});
        return &.{};
    };
    alloc[0] = value[0];
    alloc[1] = 0;
    const v = decompressFirstBytes(ctx.threadCtx.decompressor, value, alloc[2..]) catch |err| {
        std.log.err("Error decompressing parseCharEndDeflate {any} \n", .{err});
        return &.{};
    };
    var i: usize = 0;
    var prevChar: usize = i;
    var chars: u32 = 0;
    while (i < v.len) {
        if (chars == opts.end) {
            break;
        }
        var charLen = selva.selva_mblen(v[i]);
        if (charLen > 0) {
            chars += 1;
            // Start of flag emoji check
            if (charLen == 3 and v[i] == 240) {
                if (i + 8 < v.len) {
                    // Flag emoji
                    if (v[i + 1] == 159 and v[i + 2] == 135 and v[i + 4] == 240) {
                        i += 8;
                    } else {
                        i += (charLen + 1);
                    }
                } else {
                    i += 8;
                }
            } else {
                i += (charLen + 1);
            }
            prevChar = i;
        } else {
            chars += 1;
            // Ascii expansion characters
            if (i + 2 < v.len and v[i] < 128 and v[i + 1] == 204) {
                charLen = selva.selva_mblen(v[i + 1]);
                if (charLen > 0) {
                    i += charLen + 1;
                }
            }
            i += 1;
            prevChar = i;
        }
    }
    if (i >= v.len) {
        ctx.allocator.destroy(&alloc);
        extraSize.* = extraSize.* * 2;
        return parseCharEndDeflate(ctx, value, opts, extraSize);
    }
    return alloc[0 .. i + 2];
}

pub fn parseOptsString(
    ctx: *QueryCtx,
    value: []u8,
    opts: *const IncludeOpts,
) ![]u8 {
    if (opts.end != 0) {
        if (!opts.isChars) {
            if (value[1] == 1) {
                const v = try ctx.allocator.alloc(u8, opts.end + 2);
                v[0] = value[0];
                v[1] = 0;
                _ = try decompressFirstBytes(ctx.threadCtx.decompressor, value, v[2..]);
                return v;
            } else if (value.len - 4 < opts.end + 2) {
                return value[0 .. value.len - 4];
            } else {
                const v = value[0 .. opts.end + 2];
                return v;
            }
        } else if (value[1] == 1) {
            var extraSize: usize = undefined;
            if (opts.end > 10) {
                extraSize = opts.end / 8 + 8;
            } else {
                extraSize = 8;
            }
            return parseCharEndDeflate(ctx, value, opts, &extraSize);
        } else {
            var i: usize = 2;
            var prevChar: usize = i;
            var chars: usize = 0;
            const len: usize = value.len - 4;
            while (i < len) {
                if (chars == opts.end) {
                    return value[0..i];
                }
                var charLen = selva.selva_mblen(value[i]);
                if (charLen > 0) {
                    chars += 1;
                    if (isFlagEmoj(&i, &len, &charLen, value)) {
                        i += 8;
                    } else {
                        i += (charLen + 1);
                    }
                    prevChar = i;
                } else {
                    chars += 1;
                    // Ascii expansion characters
                    if (i + 2 < len and value[i] < 128 and value[i + 1] == 204) {
                        charLen = selva.selva_mblen(value[i + 1]);
                        if (charLen > 0) {
                            i += charLen + 1;
                        }
                    }
                    i += 1;
                    prevChar = i;
                }
            }
            return value[0..i];
        }
    }
    return value[0 .. value.len - 4];
}
