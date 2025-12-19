const std = @import("std");
const vectorLen = std.simd.suggestVectorLength(u8).?;
const vectorLenU16 = std.simd.suggestVectorLength(u16).?;

pub const IdSubsItem = packed struct {
    marked: SubStatus,
    typeId: u16,
    isRemoved: bool,
    _padding: u7,
    subId: u32,
    id: u32,
    fields: @Vector(vectorLen, u8),
    partial: @Vector(vectorLenU16, u16),
};

// needs a struct with SUBITEM and QUERY
pub const IdSubs = std.AutoHashMap(u32, []IdSubsItem); // [types.SUB_SIZE] [24] [24] [4 4] [16 bytes]

// can make a multi sub thing here
pub const MultiSubsStore = std.AutoHashMap(u32, []u8); // [type][type] (for now)

/// Subscription Context
/// 3 types of multi subs
/// - ANY on type
///    potentially also filter
/// - ANY on type + filter
///   potentially also filter
/// - max / min range ID
///  can also include the id
/// - max / min range SORT
///   can also include the id
///
/// significant filter (will make field more important)
/// the max / min id
pub const TypeSubscriptionCtx = struct {
    typeModified: bool,
    idBitSet: []u1,
    idSubs: IdSubs,
    maxId: u32,
    minId: u32,
    bitSetSize: u32,
    bitSetMin: u32,
    bitSetRatio: u32,
    // multi
    // multiSubsStore: MultiSubsStore, // iterator seems very expensive
    // multiSubsSizeBits: u32,
    multiSubsSize: u32, // if 0 faster check
    // multiSubs: []u8, //types.SUB_SIZE // lets add 100k of these will not be fast im affraid
    // multiSubsStageMarked: []u8, // then simd check // just increases in size never gets de-alloc
    // ^ can scan if it makes sense (true not staged, not true)
    // what about u8 in there and having more
    // what can we put in a byte to help?
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    singleIdMarked: []*IdSubsItem,
    lastIdMarked: u32,
};

pub const BLOCK_SIZE = 100_000;

pub const MAX_BIT_SET_SIZE = 10_000_000; // 5mb

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
