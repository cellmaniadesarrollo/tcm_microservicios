FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/scraper ./cmd/scraper

FROM alpine:3.20
# ca-certificates: necesario para HTTPS hacia GSMArena y Mongo (TLS). wget: healthcheck.
RUN apk add --no-cache ca-certificates wget && adduser -D -u 10001 app
USER app
COPY --from=build /out/scraper /usr/local/bin/scraper
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/scraper"]