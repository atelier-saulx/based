.PHONY: clean

WEBSOCKETPPDIR=include/websocketpp
ZLIBDIR=include/zlib
JSONDIR=include
CXX = clang++

ODIR=obj
SRCDIR=src


_SRCS = $(wildcard $(SRCDIR)/*.cpp)
SRCS = $(filter-out $(SRCDIR)/main.cpp, $(_SRCS))
_OBJ = $(patsubst $(SRCDIR)/%,$(ODIR)/%,$(SRCS:.c=.o))
OBJ = $(filter-out $(ODIR)/main.o,$(_OBJ))

CXXFLAGS +=-I$(WEBSOCKETPPDIR) -I$(JSONDIR) -I$(ZLIBDIR) -I/usr/local/opt/openssl@3/include -Wall -std=c++0x -stdlib=libc++ -D_WEBSOCKETPP_CPP11_STL_

all: main

$(ODIR)/%.o: $(SRCDIR)/%.cpp
	+@[ -d $(ODIR) ] || mkdir -p $(ODIR)
	$(CXX) -MMD $(CXXFLAGS) -c -o $@ $<

main: $(OBJ) $(ODIR)/main.o
	@echo $(SRCS)
	$(CXX) -o $@ $^ $(CXXFLAGS) -L/usr/local/opt/openssl@3/lib -lz -lssl -lcrypto

tls:
	+@[ -d $(ODIR) ] || mkdir -p $(ODIR)
	$(CXX) $(CXXFLAGS) -DBASED_TLS -o main src/main.cpp -L/usr/local/opt/openssl@3/lib -lz -lssl -lcrypto

clean:
	rm -r $(ODIR)
	rm main
