exports.run = function (done, nohm) {
	nohm.client.rpush('nohm-migrations-test-key', 'first', done);
};
