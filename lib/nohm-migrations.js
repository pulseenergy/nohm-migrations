var _ = require('underscore'),
	redis = require('redis'),
	fs = require('fs');

module.exports.migrate = function (key, redis_port, redis_host, prefix, nohmInstance, done) {
	var versionKey = key || 'migrations';
	var migrationsFolder = './' + versionKey + '/';
	var port = redis_port || 6379;
	var host = redis_host || "127.0.0.1";
	var nohm = nohmInstance || require('nohm').Nohm;
	console.log("version key:", versionKey);
	console.log("redis port:", port);
	console.log("redis host:", host);
	console.log("prefix:", prefix);

	var client = redis.createClient(port, host, { max_attempts: 3 });

	client.on('ready', function () {
		console.log('Running migrations in ' + migrationsFolder + ' for environment ' + (process.env.NODE_ENV || 'development'));
		nohm.setClient(client);
		nohm.setPrefix(prefix);
		nohm.prefixRaw = prefix;

		client.smembers(versionKey, function (err, migrations) {
			if (err) {
				return console.log(err);
			}
			fs.readdir(migrationsFolder, function (err, files) {
				var migrationsToRun = _.difference(files, migrations).sort();
				if (migrationsToRun.length === 0) {
					return (done || process.exit)();
				}

				var count = 0;
				function nextMigration() {
					var file = migrationsToRun[count];
					console.log('running ' + file);
					require(process.cwd() + "/" + migrationsFolder + file).run(function (err) {
						if (err) {
							console.log('failed to run migration: ' + file);
							console.log(err);
						} else {
							console.log('done ' + file);
							client.sadd(versionKey, file);
						}
						if (++count === migrationsToRun.length || err) {
							done ? done(err) : process.exit(err ? 1 : 0);
						} else {
							nextMigration();
						}
					}, nohm);
				}

				nextMigration();
			});
		});
	});
};