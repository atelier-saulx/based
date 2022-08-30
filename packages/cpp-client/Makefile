.PHONY: clean

IDIR=include/websocketpp
CXX = clang++

ODIR=obj
SRCDIR=src


_SRCS = $(wildcard $(SRCDIR)/*.cpp)
SRCS = $(filter-out $(SRCDIR)/client.cpp, $(_SRCS))
_OBJ = $(patsubst $(SRCDIR)/%,$(ODIR)/%,$(SRCS:.c=.o))
OBJ = $(filter-out $(ODIR)/client.o,$(_OBJ))

CXXFLAGS +=-I$(IDIR) -std=c++0x -stdlib=libc++ -D_WEBSOCKETPP_CPP11_STL_

all: client

$(ODIR)/%.o: $(SRCDIR)/%.cpp
	+@[ -d $(ODIR) ] || mkdir -p $(ODIR)
	$(CXX) -MMD $(CXXFLAGS) -c -o $@ $<

client: $(OBJ) $(ODIR)/client.o
	@echo $(SRCS)
	$(CXX) -o $@ $^ $(CXXFLAGS) $(LIBS)

clean:
	rm -r $(ODIR)
	rm client
