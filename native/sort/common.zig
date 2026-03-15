const std = @import("std");
const t = @import("../types.zig");
const selva = @import("../selva/selva.zig").c;
const Decay = @import("decay.zig").Decay;

pub const SortUseCounter = std.atomic.Value(u64);

pub const SortIndexMeta = struct {
    prop: t.PropType,
    field: u8,
    start: u16,
    len: u16, // len can be added somewhere else
    langCode: t.LangCode,
    isCreated: bool,
    index: *selva.SelvaSortCtx,
    decay: Decay,
};
