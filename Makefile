build:
	bower install
	uglifyjs src/index.js bower_components/monitor/src/monitor.js -o build/ngPerf.min.js --source-map build/ngPerf.min.js.map -c

.PHONY: build
