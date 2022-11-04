.PHONY: clean

LIB_DIRS = \
  lib/websocketpp \
  lib/zlib \
  lib/nlohmann-json \
  lib/apply-patch \

LDIR = $(patsubst %,-I%,$(LIB_DIRS))

LDFLAGS = 
LDLIBS = -lz -lcurl

CXX = clang++

ODIR=obj
SRCDIR=src
DISTDIR=distribute

uname_S := $(shell uname -s)

ifeq ($(uname_S),Linux)
	TARGET := libbased.so
endif
ifeq ($(uname_S),Darwin) # macOS
	TARGET := libbased.dylib
endif
ifndef TARGET
$(error TARGET is not set)
endif

HEADERS = $(wildcard $(SRCDIR)/*.hpp)
OBJS = basedclient.o \
  connection.o \
	utility.o \
	based.o

CXXFLAGS += $(LDIR) -Wall -std=c++0x -stdlib=libc++ -D_WEBSOCKETPP_CPP11_STL_

all: $(TARGET)

.PHONY: tls
tls: LIB_DIRS += /usr/local/opt/openssl@3/include
tls: CXXFLAGS += -DBASED_TLS
tls: LDLIBS += -lssl -lcrypto
tls: LDFLAGS += -L/usr/local/opt/openssl@3/lib
tls: libbased.dylib

$(ODIR)/%.o: $(SRCDIR)/%.cpp
	+@[ -d $(ODIR) ] || mkdir -p $(ODIR)
	$(CXX) -MMD -fPIC $(CXXFLAGS) -c -o $@ $<

example: $(patsubst %,$(ODIR)/%,$(OBJS))
	@echo $(SRCS)
	$(CXX) example/example.cpp -o $@ $^ $(CXXFLAGS) $(LDFLAGS) $(LDLIBS)

$(TARGET): $(patsubst %,$(ODIR)/%,$(OBJS))
	+@[ -d $(DISTDIR) ] || mkdir -p $(DISTDIR)
	cp -rf $(SRCDIR)/based.hpp $(DISTDIR)/based.hpp
	$(CXX) -o $(DISTDIR)/$@ -shared -fPIC -g $^ $(LDFLAGS) $(LDLIBS) -fvisibility=hidden

linked-example: $(TARGET)
	$(CXX) example/example.cpp -o $@ -Wall -std=c++0x -stdlib=libc++ -L./$(DISTDIR) -lbased

clean:
	rm -r $(ODIR)
	rm -r $(DISTDIR)
	rm example
	rm linked-example
