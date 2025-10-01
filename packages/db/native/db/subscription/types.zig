const std = @import("std");

// pub const Filters = std.AutoHashMap(u8, []u8);

// pub const Ids = std.AutoHashMap(u32, void);

// pub const SubType = enum(u8) {
//     singleId = 1,
//     simpleMulti = 2,
// };

// pub const Subscription = struct {
//     subType: SubType,
//     fields: Fields,
//     hasFullRange: bool,
//     filters: ?*Filters,
//     ids: Ids, // remove this for now
//     stagedIds: ?Ids,
//     id: u64,
// };

// pub const Subscriptions = std.AutoHashMap(u64, *Subscription);

// pub const SubscriptionsSet = std.AutoHashMap(*Subscription, void);

// pub const IdsSubsMap = struct {
//     set: SubscriptionsSet,
//     active: u32,
// };

pub const IdsSet = std.AutoHashMap(u32, void);
pub const Fields = std.AutoHashMap(u8, IdsSet);

// ARRAY LIST FOR SUBS (packed)
// can try pointer vs access by index

// pub const Subscription = struct {

// }

pub const IdsSubs = std.AutoHashMap(u32, Fields);

pub const TypeSubscriptionCtx = struct {
    idsList: []u32,
    idBitMap: []u8,
    lastId: u32,
    // nonMarkedId: Subscriptions, // see difference in perf
    // nonMarkedMulti: Subscriptions, // different for different things
    // subs: Subscriptions, // if zero remove type
    ids: IdsSubs,
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionMarked = std.AutoHashMap([2]u32, void);

// add gpa for subs

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    subscriptionsMarked: SubscriptionMarked, // only has an IF HERE
    hasMarkedSubscriptions: bool,
};
