.PHONY: clean

INCLUDE_DIRS = \
  include/websocketpp \
  include/zlib \
  include/nlohmann-json \
  include/apply-patch \

IDIR = $(patsubst %,-I%,$(INCLUDE_DIRS))

LDFLAGS = 
LDLIBS = -lz -lcurl

CXX = clang++

ODIR=obj
SRCDIR=src


# _SRCS = $(wildcard $(SRCDIR)/*.cpp)
# SRCS = $(filter-out $(SRCDIR)/main.cpp, $(_SRCS))
# _OBJ = $(patsubst $(SRCDIR)/%,$(ODIR)/%,$(SRCS:.c=.o))
# OBJ = $(filter-out $(ODIR)/main.o,$(_OBJ))

HEADERS = $(wildcard $(SRCDIR)/*.hpp)
OBJS = client.o \
  connection.o \
	utility.o

CXXFLAGS += $(IDIR) -Wall -std=c++0x -stdlib=libc++ -D_WEBSOCKETPP_CPP11_STL_

all: basedclient.so

.PHONY: tls
tls: INCLUDE_DIRS += /usr/local/opt/openssl@3/include
tls: CXXFLAGS += -DBASED_TLS
tls: LDLIBS += -lssl -lcrypto
tls: LDFLAGS += -L/usr/local/opt/openssl@3/lib
tls: main


$(ODIR)/%.o: $(SRCDIR)/%.cpp
	+@[ -d $(ODIR) ] || mkdir -p $(ODIR)
	$(CXX) -MMD $(CXXFLAGS) -c -o $@ $<

main: $(patsubst %,$(ODIR)/%,$(OBJS))
	@echo $(SRCS)
	$(CXX) src/main.cpp -o $@ $^ $(CXXFLAGS) $(LDFLAGS) $(LDLIBS)

basedclient.so: $(OBJ)
	$(CXX) -o $@ -shared -fPIC -g $^ $(LDFLAGS) $(LDLIBS)

clean:
	rm -r $(ODIR)
	rm main
