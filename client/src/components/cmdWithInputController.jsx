import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
// import { AttachAddon } from 'xterm-addon-attach';
import 'xterm/css/xterm.css';
import TerminalController from './TerminalController';

let term = null;
let terminalController = null;
let command = '';

class CMD extends Terminal {
  constructor(options) {
    super(options);

    this.input = '';
    this.cursorPosition = 0;
    this.promptText = '> ';
    this.onData((e) => {
      console.warn(e);
      const ev = e.domEvent;
      const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

      if (e.key === '\x03') {
        // sendMessage('\x03');
        // sendMessage('SIGINT');
      }
      if (ev.keyCode === 13) {
        command = '';
      } else if (ev.keyCode === 8) {
        // Do not delete the prompt
        if (this.term._core.buffer.x > 2) {
          term.write('\b \b');
          command = command.substr(0, 1);
        }
      } else if (printable) {
        this.write(e.key);
        this.command += e.key;
      }
    });
  }

  get prompt() {
    return this.promptText;
  }

  set prompt(v) {
    this.promptText = v;
  }

  // onData() {
  //   super.onData((e) => {
  //     console.warn(e);
  //     const ev = e.domEvent;
  //     const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

  //     if (e.key === '\x03') {
  //       // sendMessage('\x03');
  //       // sendMessage('SIGINT');
  //     }
  //     if (ev.keyCode === 13) {
  //       command = '';
  //     } else if (ev.keyCode === 8) {
  //       // Do not delete the prompt
  //       if (this.term._core.buffer.x > 2) {
  //         term.write('\b \b');
  //         command = command.substr(0, 1);
  //       }
  //     } else if (printable) {
  //       this.write(e.key);
  //       this.command += e.key;
  //     }
  //   });
  // }
}

export const WebSocketDemo = () => {
  const messageHistory = useRef([]);
  const [commandState, setCommand] = useState('');
  // const terminalRef = useRef(null);
  const terminalContainerRef = useRef(null);

  const { sendMessage, lastMessage, readyState, getWebSocket } = useWebSocket(
    'ws://localhost:8080',
    {
      onOpen: () => {
        // term.prompt();
      },
      onMessage: (v) => {
        // console.log(v);
        const { type, message } = JSON.parse(v.data);
        if (type === '1') {
          // term.setPrompt(message);
        } else {
          // term.writeln(message);
          // localEcho.print('\r\n');
          // localEcho.print(message);
        }
        // term.prompt();
      },
      shouldReconnect: () => true,
    }
  );

  const connectionStatus = ReadyState[readyState];

  const onKey = (e) => {
    const ev = e.domEvent;
    const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

    if (e.key === '\x03') {
      // sendMessage('\x03');
      sendMessage('SIGINT');
    }
    // if (ev.keyCode === 13) {
    //   // console.warn(term);
    //   sendMessage(command);
    //   command = '';
    // } else if (ev.keyCode === 8) {
    //   // Do not delete the prompt
    //   if (term._core.buffer.x > 2) {
    //     term.write('\b \b');
    //     command = command.substr(0, 1);
    //   }
    // } else if (printable) {
    //   term.write(e.key);
    //   command += e.key;
    //   console.log(command);
    // }
  };

  useEffect(() => {
    term = new Terminal({
      cursorBlink: true,
      // fontFamily: 'Roboto Mono',
      // theme: { background: '#FFFFFF', foreground: '#363636' },
    });
    terminalController = new TerminalController();
    term.loadAddon(terminalController);
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainerRef.current);
    fitAddon.fit();
    term.focus();

    // term.onData();

    // term.onKey(onKey);
    // const readLine = () => {
    //   localEcho.read(term.prompt()).then((input) => {
    //     sendMessage(input);
    //     readLine();
    //   });
    // };
    // readLine();
    // term.onData((v) => {
    //   // console.warn(v);
    //   if (v.includes('^C')) {
    //     setCommand('\x03');
    //   }
    //   command = v;
    // });

    return () => {
      term.dispose();
    };
  }, []);

  const handleClickSendMessage = () => sendMessage(commandState);
  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      sendMessage(commandState);
    }
  };

  return (
    <div>
      <span>The WebSocket is currently {connectionStatus}</span>
      <br />
      <input
        type="text"
        // value={command}
        onChange={({ target }) => setCommand(target.value)}
        onKeyPress={handleKeyPress}
      />
      <button
        type="button"
        onClick={handleClickSendMessage}
        disabled={readyState !== ReadyState.OPEN}
      >
        SEND COMMAND
      </button>
      <div
        id="terminal-container"
        className="terminal"
        ref={terminalContainerRef}
      />
      {lastMessage ? <span>Last message: {lastMessage.data}</span> : null}
      {/* <ul>
        {messageHistory.current.map((message, idx) => (
          <li key={idx}>{message ? message.data : null}</li>
        ))}
      </ul> */}
    </div>
  );
};
