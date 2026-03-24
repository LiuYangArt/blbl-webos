ARG BASE_IMAGE=golang:1.25-alpine
FROM ${BASE_IMAGE}
WORKDIR /src
COPY go.mod ./
COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o /app/playurl-relay .
WORKDIR /app
EXPOSE 19091
VOLUME ["/data"]
ENTRYPOINT ["/app/playurl-relay"]
