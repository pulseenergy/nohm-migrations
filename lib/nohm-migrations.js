var _ = require('underscore'),
	fs = require('fs'),
	path = require('path');

function log() {
	console.log.apply(console, ['[nohm-migrations]'].concat(_.toArray(arguments)));
}

function runMigrations(client, versionKey, migrationsFolder, nohm, done) {
	log('Running migrations in ' + migrationsFolder + ' for environment ' + (process.env.NODE_ENV || 'development'));

	client.smembers(versionKey, function (err, migrations) {
		if (err) {
			return done(err);
		}
		fs.readdir(migrationsFolder, function (err, files) {
			if (err) {
				return done(err);
			}

			var count = 0;
			var migrationsToRun = _.difference(files, migrations).sort();

			function nextMigration() {
				if (count >= migrationsToRun.length) {
					return done();
				}

				var file = migrationsToRun[count];
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
						count++;
						nextMigration();
					}
				}, nohm);
			}

			nextMigration();
		});
	});
}

module.exports.migrate = function (key, redis_port, redis_host, prefix, nohm, done) {
	var versionKey = key || 'migrations';
	var migrationsFolder = versionKey;
	done = done || function (err) {
		process.exit(err ? 1 : 0);
	};

	if (nohm == null) {
		var port = redis_port || 6379;
		var host = redis_host || "127.0.0.1";

		log("version key:", versionKey);
		log("redis port:", port);
		log("redis host:", host);
		log("prefix:", prefix);

		var client = require('redis').createClient(port, host, { max_attempts: 3 });
		client.on('ready', function () {
			nohm = require('nohm').Nohm;
			nohm.setClient(client);
			nohm.setPrefix(prefix);

			runMigrations(client, versionKey, migrationsFolder, nohm, done);
		});
	} else {
		runMigrations(nohm.client, versionKey, migrationsFolder, nohm, done);
	}
};
