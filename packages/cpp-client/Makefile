.PHONY: clean

LIB_DIRS = \
  lib/websocketpp \
  lib/zlib \
  lib/nlohmann-json \
  lib/apply-patch \
  lib/asio/asio/include 

LDIR = $(patsubst %,-I%,$(LIB_DIRS))

LDFLAGS = 
LDLIBS = -lz -lcurl

# CXX = clang++

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

CXXFLAGS += -Wall -std=c++0x -D_WEBSOCKETPP_CPP11_STL_ -DASIO_STANDALONE

all: $(TARGET)

.PHONY: tls
tls: LIB_DIRS += /usr/local/opt/openssl@3/include
tls: CXXFLAGS += -DBASED_TLS
tls: LDLIBS += -lssl -lcrypto
tls: LDFLAGS += -L/usr/local/opt/openssl@3/lib
tls: TARGET = libbasedtls.$(suffix $(TARGET))
tls: $(TARGET)

$(ODIR)/%.o: $(SRCDIR)/%.cpp
	+@[ -d $(ODIR) ] || mkdir -p $(ODIR)
	$(CXX) -MMD -fPIC $(LDIR) $(CXXFLAGS) -c -o $@ $<

example: $(patsubst %,$(ODIR)/%,$(OBJS))
	@echo $(SRCS)
	$(CXX) example/example.cpp -o $@ $^ $(LDIR) $(CXXFLAGS) $(LDFLAGS) $(LDLIBS)

$(TARGET): $(patsubst %,$(ODIR)/%,$(OBJS))
	+@[ -d $(DISTDIR) ] || mkdir -p $(DISTDIR)
	cp -rf $(SRCDIR)/based.hpp $(DISTDIR)/based.hpp
	$(CXX) -o $(DISTDIR)/$@ -shared -fPIC -g $^ $(LDFLAGS) $(LDLIBS) -fvisibility=hidden

linked-example: $(TARGET)
	$(CXX) example/example.cpp -o $@ $(CXXFLAGS) -L./$(DISTDIR) -lbased

clean:
	rm -rf $(ODIR)
	rm -rf $(DISTDIR)
	rm -rf docker-build
	rm -f linked-example
	rm -f example
