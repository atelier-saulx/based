const std = @import("std");
const selva = @import("../../selva/selva.zig").c;
const utils = @import("../../utils.zig");
const deflate = @import("../../deflate.zig");
const Thread = @import("../../thread/thread.zig");
const append = @import("append.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");

pub inline fn parse(
    value: []u8,
    opts: *const t.IncludeOpts,
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

inline fn isFlagEmoj(i: *usize, len: *const usize, charLen: *u32, value: []u8) bool {
    return i.* + 8 < len.* and
        charLen.* == 3 and
        value[i.*] == 240 and
        value[i.* + 1] == 159 and
        value[i.* + 2] == 135 and
        value[i.* + 4] == 240;
}

fn parseCharEndDeflate(
    thread: *Thread.Thread,
    value: []u8,
    opts: *const t.IncludeOpts,
    extraSize: *usize,
    startIndex: usize,
) !usize {
    const size = utils.read(u32, value, 2);
    const allocLen: usize = opts.end + 2 + extraSize.*;
    if (size < allocLen) {
        try thread.query.append(value);
        return value.len;
    }
    const alloc = try thread.query.slice(allocLen);
    alloc[0] = value[0];
    alloc[1] = 0;
    const v = try deflate.decompressFirstBytes(thread.decompressor, value, alloc[2..]);
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
        thread.query.index = startIndex;
        extraSize.* = extraSize.* * 2;
        return parseCharEndDeflate(thread, value, opts, extraSize, startIndex);
    }
    return i + 2;
}

pub fn string(
    thread: *Thread.Thread,
    prop: u8,
    value: []u8,
    opts: *const t.IncludeOpts,
) !void {
    if (value.len == 0) {
        return;
    }

    if (opts.end == 0) {
        // Does this mean ignore END ?
        try append.stripCrc32(thread, prop, value);
        return;
    }

    if (opts.isChars) {
        if (value[1] == 1) {
            var extraSize: usize = undefined;
            if (opts.end > 10) {
                extraSize = opts.end / 8 + 8;
            } else {
                extraSize = 8;
            }
            const headerIndex = try thread.query.reserve(utils.sizeOf(t.IncludeResponse));
            const startIndex = thread.query.index;
            const size = try parseCharEndDeflate(thread, value, opts, &extraSize, startIndex);
            thread.query.index = startIndex + size;
            const header: t.IncludeResponse = .{ .prop = prop, .size = @truncate(size) };
            thread.query.write(header, headerIndex);
        } else {
            var i: usize = 2;
            var prevChar: usize = i;
            var chars: usize = 0;
            const len: usize = value.len - 4;
            while (i < len) {
                if (chars == opts.end) {
                    try append.default(thread, prop, value[0..i]);
                    return;
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
            try append.default(thread, prop, value[0..i]);
        }
        return;
    }

    if (value[1] == 1) {
        const size = opts.end + 2;
        const header: t.IncludeResponse = .{ .prop = prop, .size = size };
        try thread.query.append(header);
        const v = try thread.query.slice(opts.end + 2);
        v[0] = value[0];
        v[1] = 0;
        _ = try deflate.decompressFirstBytes(thread.decompressor, value, v[2..]);
    } else if (value.len - 4 < opts.end + 2) {
        try append.stripCrc32(thread, prop, value);
    } else {
        try append.default(thread, prop, value[0 .. opts.end + 2]);
    }
}

pub inline fn text(
    thread: *Thread.Thread,
    prop: u8,
    value: []u8,
    q: []u8,
    i: *usize,
    optsHeader: *const t.IncludeOpts,
    appendCb: anytype,
) !void {
    switch (optsHeader.langFallbackSize) {
        0 => {
            if (optsHeader.lang == t.LangCode.none) {
                var iter = Fields.textIterator(value);
                while (iter.next()) |textValue| {
                    try appendCb(thread, prop, textValue, optsHeader);
                }
            } else if (optsHeader.hasOpts) {
                var optsHeaderSelf = optsHeader.*;
                while (optsHeaderSelf.hasOpts) {
                    try appendCb(
                        thread,
                        prop,
                        Fields.textFromValue(value, optsHeader.lang),
                        &optsHeaderSelf,
                    );
                    optsHeaderSelf = utils.readNext(t.IncludeOpts, q, i);
                }
            } else {
                try appendCb(
                    thread,
                    prop,
                    Fields.textFromValue(value, optsHeader.lang),
                    optsHeader,
                );
            }
        },
        1 => {
            try appendCb(
                thread,
                prop,
                Fields.textFromValueFallback(
                    value,
                    optsHeader.lang,
                    utils.readNext(t.LangCode, q, i),
                ),
                optsHeader,
            );
        },
        else => {
            try appendCb(
                thread,
                prop,
                Fields.textFromValueFallbacks(
                    value,
                    optsHeader.lang,
                    utils.sliceNextAs(t.LangCode, optsHeader.langFallbackSize, q, i),
                ),
                optsHeader,
            );
        },
    }
}
