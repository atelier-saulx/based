# Copyright (c) 2022-2023 SAULX
# SPDX-License-Identifier: MIT

OBJ := \
	   alias.o \
	   comparator.o \
	   db.o \
	   dump.o \
	   edge/edge.o \
	   edge/edge_constraint.o \
	   find_index/find_index.o \
	   find_index/icb.o \
	   find_index/pick_icb.o \
	   hierarchy/field_set.o \
	   hierarchy/hierarchy.o \
	   hierarchy/hierarchy_detached.o \
	   hierarchy/hierarchy_inactive.o \
	   hierarchy/hierarchy_reply.o \
	   hierarchy/traversal.o \
	   hierarchy/traversal_order.o \
	   hierarchy/types.o \
	   modify.o \
	   parsers/enum.o \
	   parsers/index_hints.o \
	   parsers/string_list.o \
	   parsers/string_set.o \
	   query/aggregate.o \
	   query/field_names.o \
	   query/find/find.o \
	   query/find/find_send_array_object_fields.o \
	   query/find/find_send_node_fields.o \
	   query/find/find_send_node_merge.o \
	   query/inherit/get_field.o \
	   query/inherit/inherit.o \
	   query/inherit/send_field.o \
	   query/inherit/send_field_find.o \
	   query/query_traverse.o \
	   query/update.o \
	   query/query_get_data_field.o \
	   resolve.o \
	   rpn/rpn.o \
	   rpn/rpn_eval.o \
	   sdb_purge.o \
	   selva_lang.o \
	   selva_object/selva_object.o \
	   selva_object/selva_object_commands.o \
	   selva_object/selva_object_foreach.o \
	   selva_set/field_has.o \
	   selva_set/fielda_in_fieldb.o \
	   selva_set/fielda_in_setb.o \
	   selva_set/selva_set.o \
	   selva_set/seta_in_fieldb.o \
	   selva_set/seta_in_setb.o \
	   selva_type.o \
	   subscriptions.o
DEP := $(OBJ:%.o=%.d)
CFLAGS += -I./include -include ../../tunables.h
LDFLAGS += -ldeflate -lutil -ljemalloc_selva
TARGET := ../mod_db$(MOD_SUFFIX)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
