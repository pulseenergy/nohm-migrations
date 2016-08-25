var fs = require('fs');
var path = require('path');
var _ = require('underscore');

function log() {
	console.log.apply(console, ['[nohm-migrations]'].concat(_.toArray(arguments)));
}

function collectMigrations(client, key, folder, done) {
	client.smembers(key, function (err, applied) {
		if (err) {
			return done(err);
		}
		fs.readdir(folder, function (err, files) {
			if (err) {
				return done(err);
			}
			var pending = _.difference(files, applied).sort();
			done(null, pending);
		});
	});
}

function runMigrations(client, key, folder, nohm, done) {
	var options = {nohm: nohm, client: client};
	log('Running migrations in ' + folder + ' for environment ' + (process.env.NODE_ENV || 'development'));

	collectMigrations(client, key, folder, function (err, migrationsToRun) {
		if (err) {
			return done(err);
		}

		function nextMigration() {
			var file = migrationsToRun.shift();
			if (!file) {
				return done();
			} else if (file[0] === '.') {
				return nextMigration();
			}
			log('Running ' + file);

			var finished = false;
			var migration = require(path.join(process.cwd(), folder, file));
			migration.run.call(options, function (err) {
				if (finished) {
					log('ERROR! ' + file + ' called callback multiple times');
					return;
				}
				finished = true;
				if (err) {
					log('Failed to run migration: ' + file, err);
					done(err);
				} else {
					log('Done ' + file);
					client.sadd(key, file);
					nextMigration();
				}
			}, nohm);
		}
		nextMigration();
	});
}

module.exports.migrate = function (key, redisPort, redisHost, prefix, nohm, done) {
	key = key || 'migrations';
	var folder = key;
	done = done || function (err) {
		if (err) {
			log('Exiting with err ', err.stack || err);
		}
		process.exit(err ? 1 : 0);
	};

	if (nohm) {
		runMigrations(nohm.client, key, folder, nohm, done);
	} else {
		var port = redisPort || 6379;
		var host = redisHost || '127.0.0.1';

		log('version key:', key);
		log('redis port:', port);
		log('redis host:', host);
		log('prefix:', prefix);

		var client = require('redis').createClient(port, host, {max_attempts: 3});
		client.once('ready', function () {
			nohm = require('nohm').Nohm;
			nohm.setClient(client);
			nohm.setPrefix(prefix);

			runMigrations(client, key, folder, nohm, function (err) {
				client.quit();
				done(err);
			});
		});
	}
};
