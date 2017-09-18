'use strict';
const dargs = require('dargs');
const execa = require('execa');
const gutil = require('gulp-util');
const through = require('through2');
// TODO: Use execa localDir option when available
const npmRunPath = require('npm-run-path');
const utils = require('./utils');

const HUNDRED_MEGABYTES = 1000 * 1000 * 100;

// Mocha options that can be specified multiple times
const MULTIPLE_OPTS = new Set([
	'require'
]);

module.exports = (opts, slopts) => {
	opts = Object.assign({
		colors: true,
		suppress: false
	}, opts);

	for (const key of Object.keys(opts)) {
		const val = opts[key];

		if (Array.isArray(val)) {
			if (!MULTIPLE_OPTS.has(key)) {
				// Convert arrays into comma separated lists
				opts[key] = val.join(',');
			}
		} else if (typeof val === 'object') {
			// Convert an object into comma separated list
			opts[key] = utils.convertObjectToList(val);
		}
	}

	const args = dargs(opts, {
		excludes: ['suppress'],
		ignoreFalse: true
	});

	const slArgs = dargs(slopts, {useEquals: false});

	const files = [];

	function aggregate(file, encoding, done) {
		if (file.isStream()) {
			done(new gutil.PluginError('sl-gulp-mocha', 'Streaming not supported'));
			return;
		}

		files.push(file.path);

		done();
	}

	function getSlNodeJs(){
		var path = require("path");
		var slnodejs = path.join(process.cwd(), "node_modules",".bin","slnodejs");
		return slnodejs;
	}

	function flush(done) {
		const env = npmRunPath.env({cwd: __dirname});
		
		var slnodejs = getSlNodeJs();
		var slnodejsArgs = ["mocha"].concat(slArgs).concat(["--"]);
		var mochaArgs = files.concat(args);
		var finalArgs = slnodejsArgs.concat(mochaArgs);

		const proc = execa(slnodejs, finalArgs, {
			env,
			maxBuffer: HUNDRED_MEGABYTES
		});
		
		proc.then(result => {
			this.emit('_result', result);
			done();
		})
			.catch(err => {
				this.emit('error', new gutil.PluginError('sl-gulp-mocha', err));
				done();
			});

		if (!opts.suppress) {
			proc.stdout.pipe(process.stdout);
			proc.stderr.pipe(process.stderr);
		}
	}

	return through.obj(aggregate, flush);
};
