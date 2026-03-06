const std = @import("std");
const t = @import("../../types.zig");

pub const Function = enum(u8) {
    eq,
    lt,
    gt,
    le,
    ge,
    range,
    eqBatch,
    eqBatchSmall,
    inc,
    incLcase,
    incLcaseFast,
    eqVar,
    eqCrc32,
    like,
};

pub const OpMeta = struct { invert: bool = false, func: Function };

fn getFunc(comptime tag: t.FilterOpCompare) Function {
    return switch (tag) {
        .range, .nrange => Function.range,
        .eqBatch,
        .neqBatch,
        => Function.eqBatch,
        .eqBatchSmall,
        .neqBatchSmall,
        => Function.eqBatchSmall,
        .eq, .neq => Function.eq,
        .le => Function.le,
        .lt => Function.le,
        .ge => Function.ge,
        .gt => Function.gt,
        .inc, .ninc => Function.inc,
        .incLcase, .nincLcase => Function.incLcase,
        .incLcaseFast, .nincLcaseFast => Function.incLcaseFast,
        .eqVar, .neqVar => Function.eqVar,
        .eqCrc32, .neqCrc32 => Function.eqCrc32,
        .like, .nlike => Function.like,
        else => Function.eq,
    };
}

pub fn parseOp(comptime op: t.FilterOpCompare) OpMeta {
    return .{
        .func = getFunc(op),
        .invert = switch (op) {
            .neq,
            .neqBatch,
            .neqBatchSmall,
            .nrange,
            .ninc,
            .nincLcase,
            .nincLcaseFast,
            .neqVar,
            .neqCrc32,
            .neqCrc32Batch,
            .neqVarBatch,
            .nlike,
            => true,
            else => false,
        },
    };
}
