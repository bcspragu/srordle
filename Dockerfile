FROM golang as builder

WORKDIR /project

COPY go.mod /project
COPY go.sum /project
COPY cmd/ /project/cmd
copy trie/ /project/trie
copy db/ /project/db
copy srordle/ /project/srordle

RUN GOOS=linux CGO_ENABLED=0 go build -o server ./cmd/server
RUN GOOS=linux CGO_ENABLED=0 go build -o cli ./cmd/cli

FROM alpine

RUN apk update && apk add 

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

WORKDIR /app
COPY --from=builder /project/server /app/server
COPY --from=builder /project/cli /app/cli

# Note that we don't copy static assets (dist/, images/, etc) because we expect
# those to be served by NGINX or something.

# Copy wordlists
RUN mkdir /data
COPY wordlists/dict.txt /data
COPY wordlists/target.txt /data

CMD ["/app/server", "--local=false", "--dictionary_path=/data/dict.txt", "--target_words_path=/data/target.txt", "--db_dir=/database/"]
