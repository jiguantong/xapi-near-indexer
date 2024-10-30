FROM node:20-alpine as builder
ADD . /build
RUN cd /build \
    && yarn install \
    && yarn build:offchain

FROM node:20-alpine
COPY --from=builder /build /app

ENTRYPOINT ["/app/scripts/publisher.entrypoint.sh"]
