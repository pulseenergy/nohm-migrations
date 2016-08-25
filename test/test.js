var assert = require('assert');
var redis = require('redis');
var nohmMigrations = require('../lib/nohm-migrations');

var client = redis.createClient();

client.del(['test/migrations', 'nohm-migrations-test-key'], function (err) {
	if (err) {
		throw err;
	}

	nohmMigrations.migrate('test/migrations', null, null, null, null, function (err) {
		if (err) {
			throw err;
		}

		client.lrange('nohm-migrations-test-key', 0, -1, function (err, values) {
			if (err) {
				throw err;
			}

			assert.deepEqual(values, ['first', 'second']);
			client.end();
		});
	});
});
