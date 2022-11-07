FROM openjdk:11.0.9-jdk

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y --no-install-recommends --no-upgrade build-essential libc++-dev libcurl4-openssl-dev libz-dev

WORKDIR /build
COPY ./src ./src
COPY ./lib ./lib
COPY ./Makefile .
# CMD apt-cache search ^libcurl
CMD make && cp distribute/libbased.so ./out/
