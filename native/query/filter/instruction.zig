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
    incBatch,
    incBatchLcase,
    incBatchLcaseFast,
    eqVar,
    eqVarBatch,
    eqCrc32,
    eqCrc32Batch,
    like,
    likeBatch,
};

pub const OpMeta = struct { invert: bool = false, func: Function };

fn getFunc(comptime tag: t.FilterOpCompare) Function {
    return switch (tag) {
        // -------------------
        .eq, .neq => Function.eq,
        .eqBatch, .neqBatch => Function.eqBatch,
        .eqBatchSmall, .neqBatchSmall => Function.eqBatchSmall,
        // -------------------
        .range, .nrange => Function.range,
        .le => Function.le,
        .lt => Function.le,
        .ge => Function.ge,
        .gt => Function.gt,
        // -------------------
        .inc, .ninc => Function.inc,
        .incLcase, .nincLcase => Function.incLcase,
        .incLcaseFast, .nincLcaseFast => Function.incLcaseFast,
        .incBatch, .nincBatch => Function.incBatch,
        .incBatchLcase, .nincBatchLcase => Function.incBatchLcase,
        .incBatchLcaseFast, .nincBatchLcaseFast => Function.incBatchLcaseFast,
        // -------------------
        .eqVar, .neqVar => Function.eqVar,
        .eqVarBatch, .neqVarBatch => Function.eqVarBatch,
        // -------------------
        .eqCrc32, .neqCrc32 => Function.eqCrc32,
        .eqCrc32Batch, .neqCrc32Batch => Function.eqCrc32Batch,
        // -------------------
        .like, .nlike => Function.like,
        .likeBatch, .nlikeBatch => Function.likeBatch,
        // -------------------
        else => Function.eq, // remove this
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
            .nincBatch,
            .nincBatchLcase,
            .nincBatchLcaseFast,
            .neqVar,
            .neqCrc32,
            .neqCrc32Batch,
            .neqVarBatch,
            .nlike,
            .nlikeBatch,
            => true,
            else => false,
        },
    };
}
