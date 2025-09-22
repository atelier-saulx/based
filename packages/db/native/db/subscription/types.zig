const std = @import("std");

pub const SubIds = std.AutoHashMap(u64, void);

pub const Fields = std.AutoHashMap(u8, *SubIds);

// main
pub const FieldsSimple = std.AutoHashMap(u8, void);

// test speed
// optmize this later using C this does not make sense in perf
// 32mb ram for 1M subscriptions adds 24 bytes extra per row but does take away non pointer lookup
// do we want to include START for main buffers?
// pub const Bitmap255 = struct {
//     pub const capacity = 255;
//     const storage_size = (capacity + 7) / 8;
//     data: [storage_size]u8 = .{0} ** storage_size,
//     const Self = @This();
//     pub fn setValue(self: *Self, option: u8) void {
//         std.debug.assert(option < capacity);
//         const index = @as(usize, option >> 3);
//         const mask = @as(u8, 1) << (option & 7);
//         self.data[index] |= mask;
//     }
//     pub fn hasValue(self: *const Self, option: u8) bool {
//         std.debug.assert(option < capacity);
//         const index = @as(usize, option >> 3);
//         const mask = @as(u8, 1) << (option & 7);
//         return (self.data[index] & mask) != 0;
//     }
// };

// start / end
pub const SingleId = struct {
    // prob want
    // specificMain: ?std.AutoHashMap(u16, u16),
    // specificMain? is this important at all for single ids in real scenarios
    // if not the bitmap technique is prob better scince the lookup is a lot faster porbably
    fields: Fields,
    // subIds: SubIds,
};

pub const IdsSubscriptions = std.AutoHashMap(u32, *SingleId);

// pub const MultiIdSort = struct {
//     // specificMain: ?std.AutoHashMap(u16, u16),
//     // specificMain? is this important at all for single ids in real scenarios
//     // if not the bitmap technique is prob better scince the lookup is a lot faster porbably
//     fields: Fields,
//     // filters
//     range: []u8, // typeId[s][e]

//     startId?:
//     // sId
//     // eId
//     // filters
//     // subIds: SubIds,
//     added: bool,
// };

// specific ids can be seprate that it just keeps it here or adds it on a single id (prop best)

// only for non sorted
pub const MultiId = struct {
    // specificMain: ?std.AutoHashMap(u16, u16),
    // specificMain? is this important at all for single ids in real scenarios
    // if not the bitmap technique is prob better scince the lookup is a lot faster porbably
    fields: FieldsSimple,
    // filters
    // range: []u8, // typeId[s][e] - only for prop type
    startId: u32,
    endId: u32,
    // subId: u64,
    // sId
    // eId
    // filters
    // subIds: SubIds,
};

pub const MultiIdSubscriptions = std.AutoHashMap(u64, *MultiId);

// multi id is the first
// Have to check each unfortunately

// maybe not as an array? but as a field map?

// tocheck gets cleared
pub const TypeSubscriptionCtx = struct {
    ids: IdsSubscriptions,
    nonMarkedMulti: MultiIdSubscriptions,
    multi: MultiIdSubscriptions, // here and point to it from non marked
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionMarked = std.AutoHashMap(u64, void);
pub const SubscriptionMultiMarked = std.AutoHashMap(u64, u16);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    subscriptionsIdMarked: SubscriptionMarked,
    // and these get re-staged
    subscriptionsMultiMarked: SubscriptionMultiMarked,
    //
    hasMarkedSubscriptions: bool,
};
