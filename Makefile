compile:
	npm run compile

build:
	@echo "Building the project..."
	npm install
	compile

build-local: build

