// pub const QuerySubType = enum(u8) {
//     // --- NO SEARCH ---
//     default = 0, //                   Filter: [ X ],  Sort: [ X     ],  Search: [ X   ]
//     filter = 1, //                    Filter: [ √ ],  Sort: [ X     ],  Search: [ X   ]
//     sortAsc = 2, //                   Filter: [ X ],  Sort: [ASC    ],  Search: [ X   ]
//     sortAscFilter = 3, //             Filter: [ √ ],  Sort: [ASC    ],  Search: [ X   ]
//     sortDesc = 4, //                  Filter: [ X ],  Sort: [DESC   ],  Search: [ X   ]
//     sortDescFilter = 5, //            Filter: [ √ ],  Sort: [DESC   ],  Search: [ X   ]
//     sortIdDesc = 6, //                Filter: [ X ],  Sort: [ID_DESC],  Search: [ X   ]
//     sortIdDescFilter = 7, //          Filter: [ √ ],  Sort: [ID_DESC],  Search: [ X   ]

//     // --- TEXT SEARCH ---
//     search = 8, //                    Filter: [ X ],  Sort: [ X     ],  Search: [TEXT ]
//     searchFilter = 9, //              Filter: [ √ ],  Sort: [ X     ],  Search: [TEXT ]
//     searchSortAsc = 10, //            Filter: [ X ],  Sort: [ASC    ],  Search: [TEXT ]
//     searchSortAscFilter = 11, //      Filter: [ √ ],  Sort: [ASC    ],  Search: [TEXT ]
//     searchSortDesc = 12, //           Filter: [ X ],  Sort: [DESC   ],  Search: [TEXT ]
//     searchSortDescFilter = 13, //     Filter: [ √ ],  Sort: [DESC   ],  Search: [TEXT ]
//     searchSortIdDesc = 14, //         Filter: [ X ],  Sort: [ID_DESC],  Search: [TEXT ]
//     searchSortIdDescFilter = 15, //   Filter: [ √ ],  Sort: [ID_DESC],  Search: [TEXT ]

//     // --- VECTOR SEARCH ---
//     vec = 16, //                      Filter: [ X ],  Sort: [ X     ],  Search: [ VEC ]
//     vecFilter = 17, //                Filter: [ √ ],  Sort: [ X     ],  Search: [ VEC ]
//     vecSortAsc = 18, //               Filter: [ X ],  Sort: [ASC    ],  Search: [ VEC ]
//     vecSortAscFilter = 19, //         Filter: [ √ ],  Sort: [ASC    ],  Search: [ VEC ]
//     vecSortDesc = 20, //              Filter: [ X ],  Sort: [DESC   ],  Search: [ VEC ]
//     vecSortDescFilter = 21, //        Filter: [ √ ],  Sort: [DESC   ],  Search: [ VEC ]
//     vecSortIdDesc = 22, //            Filter: [ X ],  Sort: [ID_DESC],  Search: [ VEC ]
//     vecSortIdDescFilter = 23, //      Filter: [ √ ],  Sort: [ID_DESC],  Search: [ VEC ]
// };

// sortMode: 0 = None, 1 = Asc, 2 = Desc, 3 = IdDesc
// searchMode: 0 = None, 1 = Text, 2 = Vec
export const getQuerySubType = (
  filterSize: number,
  sortSize: number,
  searchSize: number,
  isDesc: boolean,
  isIdSort: boolean,
  isVector: boolean,
): number => {
  const hasSearch = searchSize > 0
  const hasSort = sortSize > 0
  const hasFilter = filterSize > 0
  if (hasSearch && isVector) {
    if (isIdSort) return hasFilter ? 23 : 22
    if (hasSort) {
      if (isDesc) return hasFilter ? 21 : 20
      return hasFilter ? 19 : 18
    }
    return hasFilter ? 17 : 16
  }
  if (hasSearch) {
    if (isIdSort) return hasFilter ? 15 : 14
    if (hasSort) {
      if (isDesc) return hasFilter ? 13 : 12
      return hasFilter ? 11 : 10
    }
    return hasFilter ? 9 : 8
  }
  if (hasSort) {
    if (isIdSort) return hasFilter ? 7 : 6
    if (isDesc) return hasFilter ? 5 : 4
    return hasFilter ? 3 : 2
  }
  return hasFilter ? 1 : 0
}
