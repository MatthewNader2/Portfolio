import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { playKeyClick, playEnterKey, playTabComplete } from "../utils/audioFx";

// --- Autocomplete Data ---
const AVAILABLE_COMMANDS = [
  "cat",
  "echo",
  "help",
  "clear",
  "cls",
  "ls",
  "dir",
  "whoami",
  "id",
  "date",
  "pwd",
  "about",
  "projects",
  "skills",
  "experience",
  "education",
  "awards",
  "contact",
];
const AVAILABLE_SECTIONS = [
  "about",
  "projects",
  "skills",
  "experience",
  "education",
  "contact",
  "awards",
];

export const TerminalComponent = forwardRef(({ onCommand }, ref) => {
  // --- Refs ---
  const terminalContainerRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());
  const mobileInputRef = useRef(null);

  // --- Internal State ---
  const state = useRef({
    currentLine: "",
    cursorIndex: 0,
    history: [],
    historyIndex: -1,
    suggestion: "",
    tabPressCount: 0,
  });

  // --- Helper Functions ---
  const getSuggestion = (line) => {
    if (!line || line.endsWith(" ")) return "";
    const lastSpace = line.lastIndexOf(" ");
    const word = (lastSpace >= 0 ? line.slice(lastSpace + 1) : line).toLowerCase();
    if (!word) return "";
    const source = line.includes(" ") ? AVAILABLE_SECTIONS : AVAILABLE_COMMANDS;
    const match = source.find(
      (item) => item.startsWith(word) && item.toLowerCase() !== word,
    );
    return match ? match.slice(word.length) : "";
  };

  const redrawLine = () => {
    if (!term.current) return;
    const s = state.current;

    const suggestion = getSuggestion(s.currentLine);
    s.suggestion = suggestion;

    let output = `\x1b[2K\r> ${s.currentLine}`;
    if (suggestion && s.cursorIndex === s.currentLine.length) {
      output += `\x1b[38;5;28m${suggestion}\x1b[0m`;
    }
    term.current.write(output);
    term.current.write(`\x1b[${s.cursorIndex + 3}G`);
  };

  const handleInputText = (text) => {
    playKeyClick();
    const s = state.current;
    s.currentLine =
      s.currentLine.slice(0, s.cursorIndex) +
      text +
      s.currentLine.slice(s.cursorIndex);
    s.cursorIndex += text.length;
    redrawLine();
  };

  const handleAcceptSuggestion = () => {
    const s = state.current;
    if (s.suggestion && s.cursorIndex === s.currentLine.length) {
      playTabComplete();
      s.currentLine += s.suggestion;
      if (s.currentLine === "cat" || s.currentLine === "echo") {
        s.currentLine += " ";
      }
      s.cursorIndex = s.currentLine.length;
      s.suggestion = "";
      redrawLine();
      return true;
    }
    return false;
  };

  const handleTabPress = () => {
    const s = state.current;
    if (handleAcceptSuggestion()) return;

    const lastSpace = s.currentLine.lastIndexOf(" ");
    const currentWord = (lastSpace >= 0 ? s.currentLine.slice(lastSpace + 1) : s.currentLine).toLowerCase();
    const source = s.currentLine.includes(" ")
      ? AVAILABLE_SECTIONS
      : AVAILABLE_COMMANDS;
    const matches = source.filter((item) =>
      item.startsWith(currentWord),
    );

    if (matches.length === 1) {
      playTabComplete();
      const prefix = lastSpace >= 0 ? s.currentLine.slice(0, lastSpace + 1) : "";
      s.currentLine = prefix + matches[0];
      if (s.currentLine === "cat" || s.currentLine === "echo") {
        s.currentLine += " ";
      }
      s.cursorIndex = s.currentLine.length;
      s.suggestion = "";
      redrawLine();
    } else if (matches.length > 1) {
      let lcp = matches[0];
      for (let i = 1; i < matches.length; i++) {
        while (!matches[i].startsWith(lcp)) {
          lcp = lcp.slice(0, -1);
        }
      }
      if (lcp.length > currentWord.length) {
        playTabComplete();
        const prefix = lastSpace >= 0 ? s.currentLine.slice(0, lastSpace + 1) : "";
        s.currentLine = prefix + lcp;
        s.cursorIndex = s.currentLine.length;
        s.suggestion = "";
        redrawLine();
      } else {
        playTabComplete();
        term.current.write("\r\n" + matches.join("   ") + "\r\n");
        redrawLine();
      }
    }
  };

  const handleSpecialKey = (key) => {
    if (key === "Enter") {
      playEnterKey();
      const s = state.current;
      const trimmedLine = s.currentLine.trim();
      if (trimmedLine) {
        term.current.write("\r\n");
        onCommand(trimmedLine);
        if (s.history[0] !== trimmedLine) {
          s.history = [trimmedLine, ...s.history];
        }
      } else {
        onCommand("");
      }
      s.currentLine = "";
      s.cursorIndex = 0;
      s.suggestion = "";
      s.historyIndex = -1;
      s.tabPressCount = 0;
    } else if (key === "Backspace") {
      playKeyClick();
      const s = state.current;
      if (s.cursorIndex > 0) {
        s.currentLine =
          s.currentLine.slice(0, s.cursorIndex - 1) +
          s.currentLine.slice(s.cursorIndex);
        s.cursorIndex--;
        redrawLine();
      }
    }
  };

  // --- Mobile Input Handlers ---
  const handleMobileChange = (e) => {
    const val = e.target.value;
    if (val) {
      handleInputText(val);
    }
    e.target.value = "";
  };

  const handleMobileKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "Backspace") {
      handleSpecialKey(e.key);
      e.preventDefault();
    }
  };

  // --- Exposed Methods (Parent Interface) ---
  useImperativeHandle(ref, () => ({
    write: (text) => term.current?.write(text.replace(/\r?\n/g, "\r\n")),
    clear: () => {
      if (!term.current) return;
      state.current.currentLine = "";
      state.current.cursorIndex = 0;
      state.current.suggestion = "";
      state.current.historyIndex = -1;
      state.current.tabPressCount = 0;
      term.current.clear();
      term.current.write("\x1b[H\x1b[2J> ");
    },
    prompt: () => {
      if (!term.current) return;
      state.current.currentLine = "";
      state.current.cursorIndex = 0;
      state.current.suggestion = "";
      state.current.historyIndex = -1;
      state.current.tabPressCount = 0;
      term.current.write("\r\n> ");
    },
    focus: () => {
      term.current?.focus();
      if (window.innerWidth < 1024) {
        mobileInputRef.current?.focus();
      }
    },
    fit: () => fitAddon.current?.fit(),
    getDimensions: () =>
      term.current
        ? { cols: term.current.cols, rows: term.current.rows }
        : null,

    select: (col, row, length) => {
      if (!term.current) return;
      const buffer = term.current.buffer.active;
      const actualRow = row + buffer.viewportY;
      term.current.select(col, actualRow, length);
    },

    clearSelection: () => term.current?.clearSelection(),
    getSelection: () => term.current?.getSelection(),

    selectWordAt: (col, row) => {
      if (!term.current) return;
      const buffer = term.current.buffer.active;
      const actualRow = row + buffer.viewportY;
      const line = buffer.getLine(actualRow);
      if (!line) return;
      const str = line.translateToString(false);
      if (!str[col] || str[col] === " ") return;
      let start = col;
      let end = col;
      while (start > 0) {
        const char = str[start - 1];
        if (!char || char === " ") break;
        start--;
      }
      while (end < str.length) {
        const char = str[end];
        if (!char || char === " ") break;
        end++;
      }
      term.current.select(start, actualRow, end - start);
    },

    selectLineAt: (row) => {
      if (!term.current) return;
      const buffer = term.current.buffer.active;
      const actualRow = row + buffer.viewportY;
      term.current.select(0, actualRow, term.current.cols);
    },

    paste: (text) => handleInputText(text),

    getChar: (col, row) => {
      const buffer = term.current?.buffer.active;
      if (!buffer) return null;
      const actualRow = row + buffer.viewportY;
      const line = buffer.getLine(actualRow);
      return line?.getCell(col)?.getChars() || null;
    },

    getLinkAt: (col, row) => {
      if (!term.current) return null;
      const buffer = term.current.buffer.active;
      const actualRow = row + buffer.viewportY;
      const line = buffer.getLine(actualRow);
      if (!line) return null;
      const lineStr = line.translateToString(true);
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      let match;
      while ((match = urlRegex.exec(lineStr)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (col >= start && col < end) {
          return match[0];
        }
      }
      return null;
    },

    getViewportBounds: () => {
      const target = term.current?.element.querySelector(".xterm-viewport");
      return target?.getBoundingClientRect();
    },
  }));

  // --- Terminal Initialization ---
  useEffect(() => {
    if (terminalContainerRef.current && !term.current) {
      term.current = new Terminal({
        fontFamily: '"Pixelmix", monospace',
        fontSize: 16,
        lineHeight: 1.5,
        cursorBlink: true,
        theme: {
          background: "rgba(0, 0, 0, 0)",
          foreground: "#00ff00",
          cursor: "#00ff00",
          selectionBackground: "#00ff00",
          selectionForeground: "#000000",
        },
        allowTransparency: true,
        rightPadding: 20,
      });

      term.current.loadAddon(fitAddon.current);
      term.current.open(terminalContainerRef.current);
      term.current.focus();

      // Custom Key Handler (Copy/Paste/Intercept Tab & Shortcuts directly)
      term.current.attachCustomKeyEventHandler((arg) => {
        if (arg.type !== "keydown") return true;

        // 1. Single Tab Autocomplete Interception
        if (arg.key === "Tab") {
          arg.preventDefault();
          handleTabPress();
          return false;
        }

        // 2. Right Arrow Autosuggestion Acceptance
        if (arg.key === "ArrowRight") {
          const s = state.current;
          if (s.suggestion && s.cursorIndex === s.currentLine.length) {
            arg.preventDefault();
            handleAcceptSuggestion();
            return false;
          }
        }

        // 3. Clipboard Copy / Paste
        if (arg.ctrlKey && arg.key.toLowerCase() === "c") {
          const selection = term.current.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection);
            return false;
          }
        }
        if (
          (arg.ctrlKey && arg.key.toLowerCase() === "v") ||
          (arg.shiftKey && arg.key === "Insert")
        ) {
          navigator.clipboard
            .readText()
            .then((text) => handleInputText(text))
            .catch(() => {});
          return false;
        }
        return true;
      });

      document.fonts.ready.then(() => {
        fitAddon.current.fit();
      });

      // Desktop Input Logic (Physical Keyboard)
      term.current.onKey(({ key, domEvent }) => {
        const s = state.current;

        // --- Handle Control Key Combinations ---
        if (domEvent.ctrlKey) {
          const keyLower = domEvent.key.toLowerCase();
          if (keyLower === "l") {
            // Ctrl+L -> Clear Screen
            term.current.reset();
            term.current.write("\x1b[2J\x1b[3J\x1b[H");
            redrawLine();
            return;
          }
          if (keyLower === "c") {
            // Ctrl+C -> Cancel Line
            term.current.write("^C\r\n> ");
            s.currentLine = "";
            s.cursorIndex = 0;
            s.suggestion = "";
            return;
          }
          if (keyLower === "u") {
            // Ctrl+U -> Clear Line Before Cursor
            s.currentLine = s.currentLine.slice(s.cursorIndex);
            s.cursorIndex = 0;
            redrawLine();
            return;
          }
          if (keyLower === "a") {
            // Ctrl+A -> Start of Line
            s.cursorIndex = 0;
            redrawLine();
            return;
          }
          if (keyLower === "e") {
            // Ctrl+E -> End of Line / Accept Suggestion
            if (!handleAcceptSuggestion()) {
              s.cursorIndex = s.currentLine.length;
              redrawLine();
            }
            return;
          }
          return;
        }

        if (domEvent.altKey || domEvent.metaKey) return;
        if (domEvent.key === "Tab") return; // Handled in attachCustomKeyEventHandler

        switch (domEvent.key) {
          case "Enter":
          case "Backspace":
            handleSpecialKey(domEvent.key);
            break;

          case "Delete":
            playKeyClick();
            if (s.cursorIndex < s.currentLine.length) {
              s.currentLine =
                s.currentLine.slice(0, s.cursorIndex) +
                s.currentLine.slice(s.cursorIndex + 1);
              redrawLine();
            }
            break;

          case "ArrowLeft":
            playKeyClick();
            if (s.cursorIndex > 0) {
              s.cursorIndex--;
              redrawLine();
            }
            break;

          case "ArrowRight":
            if (!handleAcceptSuggestion()) {
              if (s.cursorIndex < s.currentLine.length) {
                playKeyClick();
                s.cursorIndex++;
                redrawLine();
              }
            }
            break;

          case "Home":
            playKeyClick();
            s.cursorIndex = 0;
            redrawLine();
            break;

          case "End":
            if (!handleAcceptSuggestion()) {
              playKeyClick();
              s.cursorIndex = s.currentLine.length;
              redrawLine();
            }
            break;

          case "ArrowUp":
            playKeyClick();
            if (s.historyIndex < s.history.length - 1) {
              s.historyIndex++;
              s.currentLine = s.history[s.historyIndex];
              s.cursorIndex = s.currentLine.length;
              redrawLine();
            }
            break;

          case "ArrowDown":
            playKeyClick();
            if (s.historyIndex > 0) {
              s.historyIndex--;
              s.currentLine = s.history[s.historyIndex];
              s.cursorIndex = s.currentLine.length;
            } else if (s.historyIndex === 0) {
              s.historyIndex = -1;
              s.currentLine = "";
              s.cursorIndex = 0;
            }
            redrawLine();
            break;

          default:
            if (key.length === 1) handleInputText(key);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="region"
      aria-label="Interactive Retro 3D Terminal"
      onClick={() => {
        term.current?.focus();
        mobileInputRef.current?.focus();
      }}
      style={{
        width: "100%",
        height: "100%",
        padding: "50px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Hidden Textarea for Mobile Keyboard Support */}
      <textarea
        ref={mobileInputRef}
        aria-label="Terminal Input"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          zIndex: 0,
          border: "none",
          outline: "none",
          resize: "none",
          color: "transparent",
          backgroundColor: "transparent",
          caretColor: "transparent",
        }}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        onChange={handleMobileChange}
        onKeyDown={handleMobileKeyDown}
      />
      <div
        ref={terminalContainerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
});

TerminalComponent.displayName = "TerminalComponent";
