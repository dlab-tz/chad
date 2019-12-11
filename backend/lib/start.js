const forever = require('forever-monitor');

var child = new(forever.Monitor)('app.js', {
  append: true,
  silent: false,
  logFile: "/var/log/chaid_forever.log",
  outFile: "/var/log/chaid_info.log",
  errFile: "/var/log/chaid_error.log",
  command: 'node --max_old_space_size=2000',
  args: []
});

child.on('restart', function () {
  console.log('app.js has been restarted');
});

child.on('exit', function () {
  console.log('CHAID has stoped');
});

child.start();