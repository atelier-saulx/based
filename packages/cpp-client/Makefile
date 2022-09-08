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

CXXFLAGS +=-I$(WEBSOCKETPPDIR) -I$(JSONDIR) -I$(ZLIBDIR) -lz -std=c++0x -stdlib=libc++ -D_WEBSOCKETPP_CPP11_STL_

all: main

$(ODIR)/%.o: $(SRCDIR)/%.cpp
	+@[ -d $(ODIR) ] || mkdir -p $(ODIR)
	$(CXX) -MMD $(CXXFLAGS) -c -o $@ $<

main: $(OBJ) $(ODIR)/main.o
	@echo $(SRCS)
	$(CXX) -o $@ $^ $(CXXFLAGS) $(LIBS)

clean:
	rm -r $(ODIR)
	rm main
