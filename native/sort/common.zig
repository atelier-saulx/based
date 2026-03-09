const t = @import("../types.zig");
const selva = @import("../selva/selva.zig").c;

pub const SortIndexMeta = struct {
    prop: t.PropType,
    field: u8,
    start: u16,
    len: u16, // len can be added somewhere else
    langCode: t.LangCode,
    isCreated: bool,
    index: *selva.SelvaSortCtx,
};
