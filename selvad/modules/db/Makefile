# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

OBJ := \
	   alias.o \
	   comparator.o \
	   db.o \
	   field_lookup/data_field.o \
	   field_lookup/traversable.o \
	   hierarchy/edge.o \
	   hierarchy/field_set.o \
	   hierarchy/hierarchy.o \
	   hierarchy/hierarchy_detached.o \
	   hierarchy/hierarchy_inactive.o \
	   hierarchy/hierarchy_reply.o \
	   hierarchy/traversal.o \
	   hierarchy/traversal_order.o \
	   index/icb.o \
	   index/index.o \
	   index/pick_icb.o \
	   modify.o \
	   modify2.o \
	   parsers/enum.o \
	   parsers/index_hints.o \
	   parsers/string_list.o \
	   parsers/string_set.o \
	   query/aggregate.o \
	   query/count_filter_regs.o \
	   query/field_names.o \
	   query/find/find.o \
	   query/find/find_fields.o \
	   query/find/find_send_array_object_fields.o \
	   query/find/find_send_node_fields.o \
	   query/find/find_send_node_merge.o \
	   query/query_traverse.o \
	   query/update.o \
	   resolve.o \
	   rpn/rpn.o \
	   rpn/rpn_eval.o \
	   schema/edge_constraint.o \
	   schema/schema.o \
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
CFLAGS += -iquote ./include -include ../../tunables.h
LDFLAGS += -ldeflate -lutil -ljemalloc_selva
TARGET := ../mod_db$(MOD_SUFFIX)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
