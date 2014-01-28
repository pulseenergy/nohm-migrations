var _ = require('underscore'),
	fs = require('fs'),
	path = require('path');

function runMigrations(client, versionKey, migrationsFolder, nohm, done) {
	console.log('Running migrations in ' + migrationsFolder + ' for environment ' + (process.env.NODE_ENV || 'development'));

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
				console.log('running ' + file);

				require(path.join(process.cwd(), migrationsFolder, file)).run(function (err) {
					if (err) {
						console.log('failed to run migration: ' + file);
						console.log(err);
						done(err);
					} else {
						console.log('done ' + file);
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

		console.log("version key:", versionKey);
		console.log("redis port:", port);
		console.log("redis host:", host);
		console.log("prefix:", prefix);

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
