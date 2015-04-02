'use strict';

var path = require('path');
var assert = require('yeoman-generator').assert;
var helpers = require('yeoman-generator').test;

describe('Wuipt:module', function () {
  before(function (done) {
    helpers.run(path.join(__dirname, '../module'))
      .withArguments('name', '--force')
      .withOptions({ 'skip-install': true })
      .on('end', done);
  });

  it('creates files', function () {
    assert.file([
      'somefile.js'
    ]);
  });
});
