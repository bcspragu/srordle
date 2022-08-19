# See https://tech.davis-hansson.com/p/make/
SHELL := bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

ifeq ($(origin .RECIPEPREFIX), undefined)
  $(error This Make does not support .RECIPEPREFIX. Please use GNU Make 4.0 or later)
endif
.RECIPEPREFIX = >

# See https://szymonkrajewski.pl/use-make-as-task-runner/
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
WHITE  := $(shell tput -Txterm setaf 7)
RESET  := $(shell tput -Txterm sgr0)

TARGET_MAX_CHAR_NUM=15

.DEFAULT_GOAL := help

## Show this help message
help:
> echo ''
> echo 'Usage:'
> echo '  ${YELLOW}make${RESET} ${GREEN}<target>${RESET}'
> echo ''
> echo 'Targets:'
> awk '/^[a-zA-Z\-_0-9]+:/ { \
    helpMessage = match(lastLine, /^## (.*)/); \
    if (helpMessage) { \
        helpCommand = substr($$1, 0, index($$1, ":")); \
        sub(/:/, "", helpCommand); \
        helpMessage = substr(lastLine, RSTART + 3, RLENGTH); \
        printf "  ${YELLOW}%-$(TARGET_MAX_CHAR_NUM)s${RESET} ${GREEN}%s${RESET}\n", helpCommand, helpMessage; \
    } \
} \
{ lastLine = $$0 }' $(MAKEFILE_LIST)
.SILENT: help

.make/frontend-install: package.json
> npm install
> @mkdir -p .make
> @touch .make/frontend-install

## Install frontend dependencies
frontend-install: .make/frontend-install
.PHONY: frontend-install

## Run the frontend locally
frontend-run: .make/frontend-install
> npm run local
.PHONY: frontend-run

## Run the backend locally at localhost:8000
backend-run:
> @mkdir -p .badger
> go run ./cmd/server
.PHONY: backend-run

## Lint + fix the frontend code
lint: .make/frontend-install
> npm run lint:fix
.PHONY: lint

## Run the backend tests
test:
> go test -v ./...
.PHONY: test

js_targets := dist/index.min.js dist/index.html dist/index.min.css
web_inputs := $(shell find src/)
$(js_targets): .make/frontend-install rollup.config.js $(web_inputs)
> npm run build:prod

## Build the frontend
frontend-build: $(js_targets)
.PHONY: frontend-build

## Clean up the production output JS files
clean:
> rm -f $(js_targets)
.PHONY: clean

.make/docker-build: $(js_targets) Dockerfile
> docker build --tag docker.bsprague.com/srordle-open .
> @mkdir -p .make
> @touch .make/docker-build

## Build the Srordle Docker image
docker-build: .make/docker-build
.PHONY: docker-build

## Push the Srordle Docker image
docker-push: .make/docker-build
> docker push docker.bsprague.com/srordle-open
.PHONY: docker-push