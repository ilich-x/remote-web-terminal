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
 * A local terminal controller is responsible for displaying messages
 * and handling local echo for the terminal.
 *
 * Local echo supports most of bash-like input primitives. Namely:
 * - Arrow navigation on the input
 * - Alt-arrow for word-boundary navigation
 * - Alt-backspace for word-boundary deletion
 * - Multi-line input for incomplete commands
 * - Auto-complete hooks
 */
export default class LocalEchoController {
  constructor(term = null, options = {}) {
    this.term = term;
    this.handleTermData = this.handleTermData.bind(this);
    this.handleTermResize = this.handleTermResize.bind(this);

    this.history = new HistoryController(options.historySize || 10);
    this.maxAutocompleteEntries = options.maxAutocompleteEntries || 100;

    this.autocompleteHandlers = [];
    this.active = false;
    this.input = '';
    this.cursor = 0;
    this.activePrompt = null;
    this.activeCharPrompt = null;
    this.termSize = {
      cols: 0,
      rows: 0,
    };

    this.disposables = [];

    if (term) {
      if (term.loadAddon) term.loadAddon(this);
      else this.attach();
    }
  }

  // xterm.js new plugin API:
  activate(term) {
    this.term = term;
    this.attach();
  }

  dispose() {
    this.detach();
  }

  /**
   *  Detach the controller from the terminal
   */
  detach() {
    if (this.term.off) {
      this.term.off('data', this.handleTermData);
      this.term.off('resize', this.handleTermResize);
    } else {
      this.disposables.forEach((d) => d.dispose());
      this.disposables = [];
    }
  }

  /**
   * Attach controller to the terminal, handling events
   */
  attach() {
    if (this.term.on) {
      this.term.on('data', this.handleTermData);
      this.term.on('resize', this.handleTermResize);
    } else {
      this.disposables.push(this.term.onData(this.handleTermData));
      this.disposables.push(this.term.onResize(this.handleTermResize));
    }
    this.termSize = {
      cols: this.term.cols,
      rows: this.term.rows,
    };
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
    // this.clearInput();
    // this.termSize = { cols, rows };
    // this.setInput(this.input, false);
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
      Array.from(normData).forEach((c) => this.handleData(c));
    } else {
      this.handleData(data);
    }
  }

  /**
   * Handle a single piece of information from the terminal.
   */
  handleData(data) {
    if (!this.active) return;
    const ord = data.charCodeAt(0);
    let ofs;

    // Handle ANSI escape sequences
    if (ord == 0x1b) {
      switch (data.substr(1)) {
        case '[A': // Up arrow
          if (this.history) {
            let value = this.history.getPrevious();
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

        case 'b': // ALT + LEFT
          ofs = closestLeftBoundary(this.input, this.cursor);
          if (ofs != null) this.setCursor(ofs);
          break;

        case 'f': // ALT + RIGHT
          ofs = closestRightBoundary(this.input, this.cursor);
          if (ofs != null) this.setCursor(ofs);
          break;

        case '\x7F': // CTRL + BACKSPACE
          ofs = closestLeftBoundary(this.input, this.cursor);
          if (ofs != null) {
            this.setInput(
              this.input.substr(0, ofs) + this.input.substr(this.cursor)
            );
            this.setCursor(ofs);
          }
          break;

        default:
          break;
      }

      // Handle special characters
    } else if (ord < 32 || ord === 0x7f) {
      switch (data) {
        case '\r': // ENTER
          if (isIncompleteInput(this.input)) {
            this.handleCursorInsert('\n');
          } else {
            this.handleReadComplete();
          }
          break;

        case '\x7F': // BACKSPACE
          this.handleCursorErase(true);
          break;

        case '\t': // TAB
          if (this.autocompleteHandlers.length > 0) {
            const inputFragment = this.input.substr(0, this.cursor);
            const hasTailingSpace = hasTailingWhitespace(inputFragment);
            const candidates = collectAutocompleteCandidates(
              this.autocompleteHandlers,
              inputFragment
            );

            // Sort candidates
            candidates.sort();

            // Depending on the number of candidates, we are handing them in
            // a different way.
            if (candidates.length === 0) {
              // No candidates? Just add a space if there is none already
              if (!hasTailingSpace) {
                this.handleCursorInsert(' ');
              }
            } else if (candidates.length === 1) {
              // Just a single candidate? Complete
              const lastToken = getLastToken(inputFragment);
              this.handleCursorInsert(
                candidates[0].substr(lastToken.length) + ' '
              );
            } else if (candidates.length <= this.maxAutocompleteEntries) {
              // search for a shared fragement
              const sameFragment = getSharedFragment(inputFragment, candidates);

              // if there's a shared fragement between the candidates
              // print complete the shared fragment
              if (sameFragment) {
                const lastToken = getLastToken(inputFragment);
                this.handleCursorInsert(sameFragment.substr(lastToken.length));
              }

              // If we are less than maximum auto-complete candidates, print
              // them to the user and re-start prompt
              this.printAndRestartPrompt(() => {
                this.printWide(candidates);
              });
            } else {
              // If we have more than maximum auto-complete candidates, print
              // them only if the user acknowledges a warning
              this.printAndRestartPrompt(() =>
                this.readChar(
                  `Display all ${candidates.length} possibilities? (y or n)`
                ).then((yn) => {
                  if (yn == 'y' || yn == 'Y') {
                    this.printWide(candidates);
                  }
                })
              );
            }
          } else {
            this.handleCursorInsert('    ');
          }
          break;

        case '\x03': // CTRL+C
          this.setCursor(this.input.length);
          this.term.write('^C\r\n' + ((this.activePrompt || {}).prompt || ''));
          this.input = '';
          this.cursor = 0;
          if (this.history) this.history.rewind();
          break;

        default:
          break;
      }

      // Handle visible characters
    } else {
      this.handleCursorInsert(data);
    }
  }
}
