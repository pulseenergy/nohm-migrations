exports.run = function (done) {
	this.client.rpush('nohm-migrations-test-key', 'first', done);
};
