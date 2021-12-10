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
import LocalEchoController from 'local-echo';

// interface Term extends Terminal {
//   setPrompt?(newPrompt: string): void;
//   promptText?: string;
//   prompt?(): void;
// }
// type Term = Terminal & {
//   setPrompt?(newPrompt: string): void;
//   promptText?: string;
//   prompt?(): void;
// };

let term = null;
let localEcho = null;
let command = '';
let readTerminal = null;

export const WebSocketDemo = () => {
  const [commandState, setCommand] = useState('');
  // const terminalRef = useRef(null);
  const terminalContainerRef = useRef(null);

  const { sendMessage, lastMessage, readyState, getWebSocket } = useWebSocket(
    'ws://localhost:8080',
    {
      onOpen: () => {
        // term.writePrompt();
      },
      onMessage: (v) => {
        console.log({ serverSend: v });

        const { type, message } = JSON.parse(v.data);
        if (type === '1') {
          term.setPrompt(message);
          // localEcho.println('prompt changed');
          // const inp = localEcho._input;
          // localEcho.clearInput(); // delete all users data
          // localEcho.setInput(message + ' ' + inp);
        } else if (type === 'like ping') {
          localEcho.abortRead();
          term.setPrompt('');
          localEcho.print(message);
          readTerminal();
        } else {
          localEcho.println(message);
          readTerminal();
        }
      },
      shouldReconnect: () => true,
    }
  );

  // useEffect(() => {
  //   term?.writeln(lastMessage?.data.replace(/(\r\n|\n|\r)/gm, ' ') || '');
  // }, [lastMessage]);

  const onKey = (e) => {
    const ev = e.domEvent;
    const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

    if (e.key === '\x03') {
      // sendMessage('\x03');
      sendMessage('SIGINT');
    }
    // if (ev.keyCode === 13) {
    //   // console.warn(term);
    //   // sendMessage(command);
    //   // localEcho.print('\n');
    //   readTerminal();
    // }
    // if (ev.keyCode === 13) {
    //   command = '';
    // } else if (ev.keyCode === 8) {
    //   // Do not delete the prompt
    //   if (term._core.buffer.x > 2) {
    //     term.write('\b \b');
    //     // command = command.substr(0, 1);
    //   }
    // } else if (printable) {
    //   term.write(e.key);
    //   command += e.key;
    // }
  };

  useEffect(() => {
    term = new Terminal({
      cursorBlink: true,
      // fontFamily: 'Roboto Mono',
      // theme: {
      //   background: '#FFFFFF',
      //   foreground: '#363636',
      //   cursor: '#363636',
      //   selection: 'red',
      // },
    });
    localEcho = new LocalEchoController();
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(localEcho);
    term.open(terminalContainerRef.current);
    fitAddon.fit();

    term.promptText = 'default prompt $ ';
    term.setPrompt = (v) => {
      term.promptText = v;
    };
    term.writePrompt = () => {
      // eslint-disable-next-line
      term.write('\r\n' + term.promptText);
    };
    term.onKey(onKey);
    term.focus();
    readTerminal = () => {
      localEcho.read(term.promptText).then((input) => {
        console.log({ send: input });
        if (input) {
          sendMessage(input);
        } else {
          readTerminal();
        }
      });
    };
    readTerminal();
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
      <span>The WebSocket is currently {ReadyState[readyState]}</span>
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
