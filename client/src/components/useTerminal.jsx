import React, { useRef, useState, useEffect } from 'react';
import { Terminal } from 'xterm';
// import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

let term = null;
// let inputValue = '';

export const useTerminal = ({ ref }) => {
  const [inputValue, setInputValue] = useState('');
  const terminalRef = useRef(null);
  const valueRef = useRef('');

  useEffect(() => {
    term = new Terminal({
      cursorBlink: true,
      // fontFamily: 'Roboto Mono',
      // theme: { background: '#FFFFFF', foreground: '#363636' },
    });
    // const fitAddon = new FitAddon();
    // term.loadAddon(fitAddon);
    term.prompt = (value) => {
      // term.write('\r\n' + (value || 'web shell $ '));
      var shellprompt = '$ ';
      term.write('\r\n' + shellprompt);
    };

    term.open(ref.current);
    // term.prompt();
    term.focus();

    term.onKey(({ domEvent }) => {
      // console.log(domEvent);
      if (domEvent.keyCode === 13) {
        // console.warn(command);
        // term.write('\r\n');
        term.write('\r\n$ ');
        // term.prompt();
        setInputValue('');
        // term.focus();
        // inputValue = '';
        // sendMessage(command);
      }

      if (domEvent.keyCode === 8) {
        if (inputValue) {
          setInputValue(inputValue.slice(0, inputValue.length - 1));
          // inputValue = inputValue.slice(0, inputValue.length - 1);
          term.write('\b \b');
        }
        // Do not delete the prompt
        // if (term.x > 2) {
        // term.write('\b \b');
        // }
      }
    });

    term.onData((data) => {
      // socket.emit('data', data);
      setInputValue((oldV) => oldV + data);
      // inputValue += data;
      term.write(data);

      // sendMessage(data);
    });
    return () => {
      term.dispose();
    };
  }, []);

  return { terminal: term, inputValue: inputValue };
};
