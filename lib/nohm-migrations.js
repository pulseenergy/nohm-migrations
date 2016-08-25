var fs = require('fs');
var path = require('path');
var _ = require('underscore');

function log() {
	console.log.apply(console, ['[nohm-migrations]'].concat(_.toArray(arguments)));
}

function collectMigrations(client, versionKey, migrationsFolder, done) {
	client.smembers(versionKey, function (err, migrations) {
		if (err) {
			return done(err);
		}
		fs.readdir(migrationsFolder, function (err, files) {
			if (err) {
				return done(err);
			}
			done(null, _.difference(files, migrations).sort());
		});
	});
}

function runMigrations(client, versionKey, migrationsFolder, nohm, done) {
	log('Running migrations in ' + migrationsFolder + ' for environment ' + (process.env.NODE_ENV || 'development'));

	collectMigrations(client, versionKey, migrationsFolder, function (err, migrationsToRun) {
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
			require(path.join(process.cwd(), migrationsFolder, file)).run(function (err) {
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
					client.sadd(versionKey, file);
					nextMigration();
				}
			}, nohm);
		}
		nextMigration();
	});
}

module.exports.migrate = function (key, redisPort, redisHost, prefix, nohm, done) {
	var versionKey = key || 'migrations';
	var migrationsFolder = versionKey;
	done = done || function (err) {
		if (err) {
			log('Exiting with err ', err.stack || err);
		}
		process.exit(err ? 1 : 0);
	};

	if (nohm) {
		runMigrations(nohm.client, versionKey, migrationsFolder, nohm, done);
	} else {
		var port = redisPort || 6379;
		var host = redisHost || '127.0.0.1';

		log('version key:', versionKey);
		log('redis port:', port);
		log('redis host:', host);
		log('prefix:', prefix);

		var client = require('redis').createClient(port, host, {max_attempts: 3});
		client.once('ready', function () {
			nohm = require('nohm').Nohm;
			nohm.setClient(client);
			nohm.setPrefix(prefix);

			runMigrations(client, versionKey, migrationsFolder, nohm, function (err) {
				client.end();
				done(err);
			});
		});
	}
};
