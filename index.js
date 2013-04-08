var m = require('./lib/nohm-migrations');

module.exports = {
	migrate: function (key, redis_port, redis_host, prefix, nohmInstance) {
		m.migrate(key, redis_port, redis_host, prefix, nohmInstance);
	}
}