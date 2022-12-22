.PHONY: clean

LIB_DIRS = \
  lib/websocketpp \
  lib/zlib \
  lib/nlohmann-json \
  lib/apply-patch \
  lib/asio/asio/include \
	include

LDIR = $(patsubst %,-I%,$(LIB_DIRS))

LDFLAGS = 
LDLIBS = -lz -lcurl

ODIR=obj
SRCDIR=src
DISTDIR=distribute

LIBNAME = libbased

uname_S := $(shell uname -s)

ifeq ($(uname_S),Linux)
	TARGET = $(LIBNAME).so
endif
ifeq ($(uname_S),Darwin) # macOS
	TARGET = $(LIBNAME).dylib
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

all: tls

.PHONY: tls
tls: LIB_DIRS += /usr/local/opt/openssl@3/include
tls: CXXFLAGS += -DBASED_TLS
tls: LDLIBS += -lssl -lcrypto
tls: LDFLAGS += -L/usr/local/opt/openssl@3/lib
tls: $(TARGET)

.PHONY: no-tls
no-tls: $(TARGET)

$(ODIR)/%.o: $(SRCDIR)/%.cpp
	+@[ -d $(ODIR) ] || mkdir -p $(ODIR)
	$(CXX) -MMD -fPIC $(LDIR) $(CXXFLAGS) -c -o $@ $<

example: $(patsubst %,$(ODIR)/%,$(OBJS))
	$(CXX) example/example.cpp -o $@ $^ $(LDIR) $(CXXFLAGS) $(LDFLAGS) $(LDLIBS)

$(TARGET): $(patsubst %,$(ODIR)/%,$(OBJS))
	+@[ -d $(DISTDIR) ] || mkdir -p $(DISTDIR)
	cp -rf include/based.h $(DISTDIR)/based.h
	$(CXX) -o $(DISTDIR)/$@ -shared -fPIC -g $^ $(LDFLAGS) $(LDLIBS) -fvisibility=hidden

linked-example:
	$(CXX) example/example.cpp -o $@ $(CXXFLAGS) -Iinclude -L$(DISTDIR) -lbased

clean:
	$(RM) $(ODIR)
	$(RM) $(DISTDIR)
	$(RM) docker-build
	$(RM) linked-example