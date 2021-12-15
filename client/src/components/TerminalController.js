import { HistoryController } from './HistoryController';
import {
  closestLeftBoundary,
  closestRightBoundary,
  collectAutocompleteCandidates,
  countLines,
  getLastToken,
  hasTailingWhitespace,
  isIncompleteInput,
  offsetToColRow,
  getSharedFragment,
} from './Utils';

/**
 * Modified version of https://github.com/wavesoft/local-echo
 *
 * A local terminal controller is responsible for displaying messages
 * and handling local echo for the terminal.
 *
 * Local echo supports most of bash-like input primitives. Namely:
 * - Arrow navigation on the input
 * - Alt-arrow for word-boundary navigation
 * - Alt-backspace for word-boundary deletion
 */
export default class TerminalController {
  constructor(options = {}) {
    this.term = null;
    this.handleTermData = this.handleTermData.bind(this);
    this.handleTermResize = this.handleTermResize.bind(this);

    // this.onEnterCallback = options.onEnterCallback.bind(this);
    this.onEnterCallback = options.onEnterCallback;

    this.history = new HistoryController(options.historySize || 10);
    // this.maxAutocompleteEntries = options.maxAutocompleteEntries || 100;

    this.input = '';
    this.cursor = 0;
    this.promptText = options.prompt || '$ > ';
    this.termSize = {
      cols: 0,
      rows: 0,
    };
    // this.autocompleteHandlers = [];
    // this.active = false;
    // this.activePrompt = null;
    // this.activeCharPrompt = null;

    // if (term) {
    //   if (term.loadAddon) term.loadAddon(this);
    //   else this.attach();
    // }
  }

  activate(term) {
    this.term = term;
    this.term.onData(this.handleTermData);
    this.term.onResize(this.handleTermResize);
    this.termSize = {
      cols: this.term.cols,
      rows: this.term.rows,
    };

    this.printPrompt();
  }

  dispose() {
    this.term = null;
  }

  get prompt() {
    return this.promptText;
  }

  set prompt(newPrompt) {
    this.promptText = newPrompt;
  }

  /**
   * Prints a message and changes line
   */
  println(message) {
    this.print(`${message} + '\n'`);
  }

  printPrompt() {
    this.print(this.prompt);
  }

  /**
   * Prints a message and properly handles new-lines
   */
  print(message) {
    const normalizedInput = message.replace(/[\r\n]+/g, '\n');
    this.term.write(normalizedInput.replace(/\n/g, '\r\n'));
  }

  /**
   * Handle input completion
   */
  handleReadComplete() {
    if (this.history) {
      this.history.push(this.input);
    }
    if (this.onEnterCallback) {
      this.onEnterCallback(this.input);
    }
    this.term.write('\r\n');
    this.input = '';
    this.cursor = 0;
  }

  /**
   * Handle terminal resize
   *
   * This function clears the prompt using the previous configuration,
   * updates the cached terminal size information and then re-renders the
   * input. This leads (most of the times) into a better formatted input.
   */
  handleTermResize(data) {
    const { rows, cols } = data;
    this.clearInput();
    this.termSize = { cols, rows };
    this.setInput(this.input, false);
  }

  /**
   * Apply prompts to the given input
   */
  applyPrompts(input) {
    return this.prompt + input.replace(/\n/g, '\n');
  }

  /**
   * Advances the `offset` as required in order to accompany the prompt
   * additions to the input.
   */
  applyPromptOffset(input, offset) {
    const newInput = this.applyPrompts(input.substring(0, offset));

    return newInput.length;
  }

  /**
   * Clears the current prompt
   *
   * This function will erase all the lines that display the current prompt
   * and move the cursor in the beginning of the first line of the prompt.
   */
  clearInput() {
    const currentPrompt = this.applyPrompts(this.input);
    // const currentPrompt = this.prompt;

    // Get the overall number of lines to clear
    const allRows = countLines(currentPrompt, this.termSize.cols);

    // Get the line we are currently in
    const promptCursor = this.applyPromptOffset(this.input, this.cursor);
    const { row } = offsetToColRow(
      currentPrompt,
      promptCursor,
      this.termSize.cols
    );

    // First move on the last line
    const moveRows = allRows - row - 1;
    for (let i = 0; i < moveRows; i++) {
      this.term.write('\x1B[E');
    }

    // Clear current input line(s)
    this.term.write('\r\x1B[K');
    for (let i = 1; i < allRows; i++) {
      this.term.write('\x1B[F\x1B[K');
    }
  }

  /**
   * Replace input with the new input given
   *
   * This function clears all the lines that the current input occupies and
   * then replaces them with the new input.
   */
  setInput(newInput, clearInput = true) {
    // Clear current input
    if (clearInput) this.clearInput();

    // Write the new input lines, including the current prompt
    const newPrompt = this.applyPrompts(newInput);
    this.print(newPrompt);

    // Trim cursor overflow
    if (this.cursor > newInput.length) {
      this.cursor = newInput.length;
    }

    // Move the cursor to the appropriate row/col
    const newCursor = this.applyPromptOffset(newInput, this.cursor);
    const newLines = countLines(newPrompt, this.termSize.cols);
    const { col, row } = offsetToColRow(
      newPrompt,
      newCursor,
      this.termSize.cols
    );
    const moveUpRows = newLines - row - 1;

    this.term.write('\r');
    for (let i = 0; i < moveUpRows; i++) {
      this.term.write('\x1B[F');
    }
    for (let i = 0; i < col; i++) {
      this.term.write('\x1B[C');
    }

    // Replace input
    this.input = newInput;
  }

  /**
   * Set the new cursor position, as an offset on the input string
   *
   * This function:
   * - Calculates the previous and current
   */
  setCursor(cursor) {
    let newCursor = cursor;
    if (newCursor < 0) newCursor = 0;
    if (newCursor > this.input.length) newCursor = this.input.length;

    // Apply prompt formatting to get the visual status of the display
    const inputWithPrompt = this.applyPrompts(this.input);
    // const inputLines = countLines(inputWithPrompt, this.termSize.cols);

    // Estimate previous cursor position
    const prevPromptOffset = this.applyPromptOffset(this.input, this.cursor);
    const { col: prevCol, row: prevRow } = offsetToColRow(
      inputWithPrompt,
      prevPromptOffset,
      this.termSize.cols
    );

    // Estimate next cursor position
    const newPromptOffset = this.applyPromptOffset(this.input, newCursor);
    const { col: newCol, row: newRow } = offsetToColRow(
      inputWithPrompt,
      newPromptOffset,
      this.termSize.cols
    );

    // Adjust vertically
    if (newRow > prevRow) {
      for (let i = prevRow; i < newRow; i++) {
        this.term.write('\x1B[B');
      }
    } else {
      for (let i = newRow; i < prevRow; i++) {
        this.term.write('\x1B[A');
      }
    }

    // Adjust horizontally
    if (newCol > prevCol) {
      for (let i = prevCol; i < newCol; i++) {
        this.term.write('\x1B[C');
      }
    } else {
      for (let i = newCol; i < prevCol; i++) {
        this.term.write('\x1B[D');
      }
    }

    // Set new offset
    this.cursor = newCursor;
  }

  /**
   * Insert character at cursor location
   */
  handleCursorInsert(data) {
    const { cursor, input } = this;
    const newInput =
      input.substring(0, cursor) + data + input.substring(cursor);
    this.cursor += data.length;
    this.setInput(newInput);
  }

  /**
   * Move cursor at given direction
   */
  handleCursorMove(dir) {
    if (dir > 0) {
      const num = Math.min(dir, this.input.length - this.cursor);
      this.setCursor(this.cursor + num);
    } else if (dir < 0) {
      const num = Math.max(dir, -this.cursor);
      this.setCursor(this.cursor + num);
    }
  }

  /**
   * Erase a character at cursor location
   */
  handleCursorErase(backspace) {
    const { cursor, input } = this;
    if (backspace) {
      if (cursor <= 0) return;
      const newInput = input.substring(0, cursor - 1) + input.substring(cursor);
      this.clearInput();
      this.cursor -= 1;
      this.setInput(newInput, false);
    } else {
      const newInput = input.substring(0, cursor) + input.substring(cursor + 1);
      this.setInput(newInput);
    }
  }

  /**
   * Handle terminal input
   */
  handleTermData(data) {
    // if (!this.active) return;

    // If we have an active character prompt, satisfy it in priority
    // if (this.activeCharPrompt != null) {
    //   this.activeCharPrompt.resolve(data);
    //   this.activeCharPrompt = null;
    //   this.term.write('\r\n');
    //   return;
    // }

    // If this looks like a pasted input, expand it
    if (data.length > 3 && data.charCodeAt(0) !== 0x1b) {
      const normData = data.replace(/[\r\n]+/g, '\r');
      Array.from(normData).forEach((char) => this.handleData(char));
    } else {
      this.handleData(data);
    }
  }

  /**
   * Handle a single piece of information from the terminal.
   */
  handleData(data) {
    // if (!this.active) return;
    // console.warn(data1);
    // let data = data1.key;
    const charCode = data.charCodeAt(0);
    // console.warn(data);
    // console.warn(charCode);
    // console.warn(data.charCodeAt(1));

    // Handle ANSI escape sequences
    if (charCode === 0x1b) {
      // console.log(data.substring(1));
      switch (data.substring(1)) {
        case '[A': // Up arrow
          if (this.history) {
            const value = this.history.getPrevious();
            if (value) {
              this.setInput(value);
              this.setCursor(value.length);
            }
          }
          break;

        case '[B': // Down arrow
          if (this.history) {
            let value = this.history.getNext();
            if (!value) value = '';
            this.setInput(value);
            this.setCursor(value.length);
          }
          break;

        case '[D': // Left Arrow
          this.handleCursorMove(-1);
          break;

        case '[C': // Right Arrow
          this.handleCursorMove(1);
          break;

        case '[3~': // Delete
          this.handleCursorErase(false);
          break;

        case '[F': // End
          this.setCursor(this.input.length);
          break;

        case '[H': // Home
          this.setCursor(0);
          break;

        case 'b': {
          // ALT + LEFT
          const ofs = closestLeftBoundary(this.input, this.cursor);
          if (ofs != null) {
            this.setCursor(ofs);
          }
          break;
        }

        case 'f': {
          // ALT + RIGHT
          const ofs = closestRightBoundary(this.input, this.cursor);
          if (ofs != null) {
            this.setCursor(ofs);
          }
          break;
        }

        case '\x7F': {
          // CTRL + BACKSPACE
          const ofs = closestLeftBoundary(this.input, this.cursor);
          if (ofs != null) {
            this.setInput(
              this.input.substring(0, ofs) + this.input.substring(this.cursor)
            );
            this.setCursor(ofs);
          }
          break;
        }

        default:
          break;
      }

      // Handle special characters
    } else if (charCode < 32 || charCode === 0x7f) {
      switch (data) {
        case '\r': // ENTER
          // if (isIncompleteInput(this.input)) {
          //   this.handleCursorInsert('\n');
          // } else {
          this.handleReadComplete();
          // }
          break;

        case '\x7F': // BACKSPACE
          this.handleCursorErase(true);
          break;

        case '\x03': // CTRL+C
          this.setCursor(this.input.length);
          this.term.write(`\r\n^C\r\n${this.prompt}`);
          this.input = '';
          this.cursor = 0;
          if (this.history) {
            this.history.rewind();
          }
          break;

        default:
          break;
        // this.onEnterCallback(data);
      }

      // Handle visible characters
    } else {
      this.handleCursorInsert(data);
    }
  }
}
