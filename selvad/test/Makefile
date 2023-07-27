# Copyright (c) 2022-2023 SAULX
# SPDX-License-Identifier: MIT
targets := util db

all: $(targets)

$(targets):
	$(MAKE) -C $@

clean:
	for i in $(targets); do $(MAKE) -C $$i clean; done

.PHONY: $(targets)
