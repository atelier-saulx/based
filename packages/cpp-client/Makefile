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


# _SRCS = $(wildcard $(SRCDIR)/*.cpp)
# SRCS = $(filter-out $(SRCDIR)/main.cpp, $(_SRCS))
# _OBJ = $(patsubst $(SRCDIR)/%,$(ODIR)/%,$(SRCS:.c=.o))
# OBJ = $(filter-out $(ODIR)/main.o,$(_OBJ))

HEADERS = $(wildcard $(SRCDIR)/*.hpp)
OBJS = basedclient.o \
  connection.o \
	utility.o

CXXFLAGS += $(LDIR) -Wall -std=c++0x -stdlib=libc++ -D_WEBSOCKETPP_CPP11_STL_

all: libbasedclient.dylib

.PHONY: tls
tls: LIB_DIRS += /usr/local/opt/openssl@3/include
tls: CXXFLAGS += -DBASED_TLS
tls: LDLIBS += -lssl -lcrypto
tls: LDFLAGS += -L/usr/local/opt/openssl@3/lib
tls: libbasedclient.dylib

$(ODIR)/%.o: $(SRCDIR)/%.cpp
	+@[ -d $(ODIR) ] || mkdir -p $(ODIR)
	$(CXX) -MMD $(CXXFLAGS) -c -o $@ $<

main: $(patsubst %,$(ODIR)/%,$(OBJS))
	@echo $(SRCS)
	$(CXX) example/main.cpp -o $@ $^ $(CXXFLAGS) $(LDFLAGS) $(LDLIBS)

libbasedclient.dylib: $(patsubst %,$(ODIR)/%,$(OBJS))
	+@[ -d $(DISTDIR) ] || mkdir -p $(DISTDIR)
	cp -rf $(SRCDIR)/basedclient.hpp $(DISTDIR)/basedclient.hpp
	$(CXX) -o $(DISTDIR)/$@ -shared -fPIC -g $^ $(LDFLAGS) $(LDLIBS) -fvisibility=hidden

linked:
	$(CXX) example/main.cpp -o $@ -lbasedclient

clean:
	rm -r $(ODIR)
	rm -r $(DISTDIR)
	rm main
