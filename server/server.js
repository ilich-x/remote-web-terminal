import { WebSocketServer } from 'ws';
import os from 'os';
import pty from 'node-pty';

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
const wss = new WebSocketServer({ port: 8080 });

var ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
});

wss.on('connection', function connection(ws) {
  ptyProcess.on('data', function (data) {
    ws.send(new TextEncoder().encode(data));
  });

  ws.on('message', function incoming(buffer) {
    const message = new TextDecoder().decode(buffer);
    if (!message) return;
    const payload = message.slice(1);

    console.log('-------');
    console.log('received:', message);

    if (message[0] === '2') {
      const { cols, rows } = JSON.parse(payload);
      ptyProcess.resize(cols, rows);
    } else {
      ptyProcess.write(payload);
    }
  });

  console.log('connected');
});
