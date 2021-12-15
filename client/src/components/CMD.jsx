import React, { useRef, useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
// import { AttachAddon } from 'xterm-addon-attach';
import 'xterm/css/xterm.css';
// import TerminalController from './TerminalController';

// let term = null;
// let terminalController = null;

export const WebSocketDemo = () => {
  const termRef = useRef(null);
  const terminalContainerRef = useRef(null);

  const { sendMessage, lastMessage, readyState } = useWebSocket(
    'ws://localhost:8080',
    {
      onOpen: () => {
        // term.prompt();
      },
      onMessage: (v) => {
        termRef.current.write(v.data);

        // const { type, message } = JSON.parse(v.data);
        // terminalController.print(message);
        // // terminalController.print('\r\n');
        // terminalController.printPrompt();
        // if (type === '1') {
        //   // term.setPrompt(message);
        // } else {
        //   // term.writeln(message);
        //   // localEcho.print('\r\n');
        //   // localEcho.print(message);
        // }
      },
      shouldReconnect: () => true,
    }
  );

  const connectionStatus = ReadyState[readyState];

  useEffect(() => {
    termRef.current = new Terminal({
      cursorBlink: true,
      // fontFamily: 'Roboto Mono',
      // theme: { background: '#FFFFFF', foreground: '#363636' },
    });
    // terminalController = new TerminalController({
    //   onEnterCallback: sendMessage,
    // });
    // term.loadAddon(terminalController);
    const fitAddon = new FitAddon();
    termRef.current.loadAddon(fitAddon);
    termRef.current.open(terminalContainerRef.current);
    fitAddon.fit();
    termRef.current.focus();

    // console.log(term);
    termRef.current.onData((v) => {
      sendMessage(v);
    });

    return () => {
      termRef.current.dispose();
    };
  }, []);

  return (
    <div>
      <span>The WebSocket is currently {connectionStatus}</span>
      <br />
      <div
        id="terminal-container"
        className="terminal"
        ref={terminalContainerRef}
      />
      {lastMessage ? <span>Last message: {lastMessage.data}</span> : null}
    </div>
  );
};
