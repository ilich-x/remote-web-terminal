import { WebSocketServer } from 'ws';
import { exec, spawn } from 'child_process';
import os from 'os';
import pty from 'node-pty';

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

const wss = new WebSocketServer({ port: 8080 });

// var ptyProcess = pty.spawn(shell, [], {
//   name: 'xterm-color',
//   // cols: 80,
//   // rows: 30,
//   // cwd: process.env.HOME,
//   // env: process.env
// });

// ptyProcess.write('ping ya.ru\r');
// setTimeout(() => {
//   ptyProcess.write('\x03\r');
// }, 2000);
// ptyProcess.on('data', function (data) {
//   console.log('log:', data);
// });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(buffer) {
    const message = buffer.toString('utf-8');
    if (!message) return;

    const commandWithArgsArray = message.split(' ');
    console.log('-------');
    console.log('received:', message);

    // ptyProcess.write(buffer + '\r');
    // ptyProcess.on('data', function (data) {
    //   console.log('log:', data);
    //   // if (!data.includes('bash-3.2$')) {
    //   // }
    //   ws.send(JSON.stringify({ message: data, type: '0' }));
    // });

    // exec(message.toString(), (error, stdout, stderr) => {
    //   if (error) {
    //     console.error(`exec error: ${error}`);
    //     ws.send(stdout);
    //   }

    //   ws.send(stdout);
    //   console.log(`stdout: ${stdout}`);
    // });

    const ls = spawn(commandWithArgsArray[0], commandWithArgsArray.slice(1), {
      shell: true,
      detached: true,
    });
    ls.s;

    ls.stdout.on('data', (data) => {
      // setTimeout(() => {
      // }, 1000);
      ws.send(JSON.stringify({ message: data.toString('utf8'), type: '0' }));
      console.log(data.toString('utf8'));
    });

    ls.on('error', (error) => {
      ws.send(JSON.stringify({ message: error.message, type: '0' }));
      console.log(`error: ${error.message}`);
    });

    ls.on('close', (code) => {
      ws.send(
        JSON.stringify({
          message: `child process exited with code ${code}`,
          type: '0',
        })
      );
      console.log(`child process exited with code ${code}`);
    });
  });

  // setInterval(() => {
  //   console.log('timer');
  //   ws.send(
  //     JSON.stringify({
  //       message: 'bash ' + Math.round(Math.random() * 15) + '> ',
  //       type: '1',
  //     })
  //   );
  // }, 3000);

  console.log('connected');
});
