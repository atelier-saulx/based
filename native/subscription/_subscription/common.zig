const std = @import("std");
const vectorLen = std.simd.suggestVectorLength(u8).?;
const vectorLenU16 = std.simd.suggestVectorLength(u16).?;

pub const Sub = struct {
    marked: SubStatus,
    typeId: u16,
    subId: u64,
    id: u32,
    fields: @Vector(vectorLen, u8),
    partial: @Vector(vectorLenU16, u16),
    query: []u8,
};

pub const IdSubs = std.AutoHashMap(u64, []*Sub);

pub const SubHashMap = std.AutoHashMap(u32, *Sub);

pub const TypeSubscriptionCtx = struct {
    typeModified: bool,
    idBitSet: []u1,
    idSubs: IdSubs,
    maxId: u32,
    minId: u32,
    bitSetSize: u32,
    bitSetMin: u32,
    bitSetRatio: u32,
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    singleIdMarked: []u64, // this will call query directly
    lastIdMarked: u32,
    multiMarked: []u64,
    lastMultiMarked: u32,
    subHashMap: SubHashMap,
};

pub const BLOCK_SIZE = 100_000;

pub const MAX_BIT_SET_SIZE = 10_000_000; // 10mb

pub const SubStatus = enum(u8) {
    all = 255,
    marked = 254,
    none = 253,
};

pub const SubPartialStatus = enum(u16) {
    all = 255 * 255,
    none = 255 * 255 - 1,
};

pub const allFieldsVector: @Vector(vectorLen, u8) = @splat(@intFromEnum(SubStatus.all));
pub const noPartialMatch: @Vector(vectorLenU16, u16) = @splat(@intFromEnum(SubPartialStatus.none));
pub const allPartialMatch: @Vector(vectorLenU16, u16) = @splat(@intFromEnum(SubPartialStatus.all));
