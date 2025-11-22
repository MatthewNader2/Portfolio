import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export const TerminalComponent = forwardRef(({ onCommand }, ref) => {
  // --- Refs ---
  const terminalContainerRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());
  const mobileInputRef = useRef(null); // Ref for mobile keyboard

  // --- Internal State ---
  const state = useRef({
    currentLine: "",
    cursorIndex: 0,
    history: [],
    historyIndex: -1,
    suggestion: "",
    tabPressCount: 0,
  });

  // --- Autocomplete Data ---
  const availableCommands = ["cat", "echo", "help", "clear", "cls"];
  const availableSections = [
    "about",
    "projects",
    "skills",
    "experience",
    "education",
    "contact",
    "awards",
  ];

  // --- Helper Functions ---

  const redrawLine = () => {
    if (!term.current) return;
    const s = state.current;

    const getSuggestion = (line) => {
      if (!line || line.endsWith(" ")) return "";
      const word = line.slice(line.lastIndexOf(" ") + 1);
      const source = line.includes(" ") ? availableSections : availableCommands;
      const match = source.find(
        (item) => item.startsWith(word) && item !== word,
      );
      return match ? match.slice(word.length) : "";
    };

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
    const s = state.current;
    s.currentLine =
      s.currentLine.slice(0, s.cursorIndex) +
      text +
      s.currentLine.slice(s.cursorIndex);
    s.cursorIndex += text.length;
    redrawLine();
  };

  const handleSpecialKey = (key) => {
    const s = state.current;
    if (key === "Enter") {
      const trimmedLine = s.currentLine.trim();
      if (trimmedLine) {
        term.current.write("\r\n");
        onCommand(trimmedLine);
        s.history = [trimmedLine, ...s.history];
      } else {
        onCommand("");
      }
      s.currentLine = "";
      s.cursorIndex = 0;
      s.suggestion = "";
      s.historyIndex = -1;
    } else if (key === "Backspace") {
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
      // Take the last character typed (simplified for mobile composition)
      const char = val.slice(-1);
      handleInputText(char);
    }
    e.target.value = ""; // Clear immediately
  };

  const handleMobileKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "Backspace") {
      handleSpecialKey(e.key);
      e.preventDefault(); // Prevent default textarea behavior
    }
  };

  // --- Exposed Methods (Parent Interface) ---
  useImperativeHandle(ref, () => ({
    write: (text) => term.current?.write(text.replace(/\r?\n/g, "\r\n")),
    clear: () => term.current?.clear(),
    prompt: () => term.current?.write("\r\n> "),
    focus: () => {
      term.current?.focus();
      // On mobile, also focus the hidden textarea
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
      const completionSound = new Audio("/assets/bell.oga");
      completionSound.volume = 0.8;

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

      // Custom Key Handler (Copy/Paste)
      term.current.attachCustomKeyEventHandler((arg) => {
        if (arg.type !== "keydown") return true;
        if (arg.ctrlKey && arg.key === "c") {
          const selection = term.current.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection);
            return false;
          }
          return true;
        }
        if (
          (arg.ctrlKey && arg.key === "v") ||
          (arg.shiftKey && arg.key === "Insert")
        ) {
          navigator.clipboard
            .readText()
            .then((text) => handleInputText(text))
            .catch((err) => console.error("Paste failed:", err));
          return false;
        }
        return true;
      });

      document.fonts.ready.then(() => {
        fitAddon.current.fit();
      });

      // Desktop Input Logic (Physical Keyboard)
      term.current.onKey(({ key, domEvent }) => {
        if (domEvent.ctrlKey || domEvent.altKey || domEvent.metaKey) return;

        const s = state.current;
        if (domEvent.key !== "Tab") s.tabPressCount = 0;

        switch (domEvent.key) {
          case "Enter":
          case "Backspace":
            handleSpecialKey(domEvent.key);
            break;

          case "Delete":
            if (s.cursorIndex < s.currentLine.length) {
              s.currentLine =
                s.currentLine.slice(0, s.cursorIndex) +
                s.currentLine.slice(s.cursorIndex + 1);
              redrawLine();
            }
            break;

          case "ArrowLeft":
            if (s.cursorIndex > 0) {
              s.cursorIndex--;
              redrawLine();
            }
            break;

          case "ArrowRight":
            if (s.suggestion && s.cursorIndex === s.currentLine.length) {
              s.currentLine += s.suggestion;
              s.cursorIndex = s.currentLine.length;
            } else if (s.cursorIndex < s.currentLine.length) {
              s.cursorIndex++;
            }
            redrawLine();
            break;

          case "Tab":
            if (s.suggestion) {
              s.currentLine += s.suggestion;
              if (s.currentLine === "cat" || s.currentLine === "echo")
                s.currentLine += " ";
              s.cursorIndex = s.currentLine.length;
              redrawLine();
            } else {
              const currentWord = s.currentLine.slice(
                s.currentLine.lastIndexOf(" ") + 1,
              );
              const source = s.currentLine.includes(" ")
                ? availableSections
                : availableCommands;
              const matches = source.filter((item) =>
                item.startsWith(currentWord),
              );
              if (matches.length > 1 && s.tabPressCount >= 1) {
                completionSound.play().catch(() => {});
                term.current.write("\r\n" + matches.join("   ") + "\r\n");
                redrawLine();
              }
              s.tabPressCount++;
            }
            break;

          case "ArrowUp":
            if (s.historyIndex < s.history.length - 1) {
              s.historyIndex++;
              s.currentLine = s.history[s.historyIndex];
              s.cursorIndex = s.currentLine.length;
              redrawLine();
            }
            break;

          case "ArrowDown":
            if (s.historyIndex >= 0) {
              s.historyIndex--;
              s.currentLine =
                s.historyIndex >= 0 ? s.history[s.historyIndex] : "";
              s.cursorIndex = s.currentLine.length;
            } else {
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
  }, [onCommand]);

  return (
    <div
      onClick={() => {
        term.current?.focus();
        mobileInputRef.current?.focus();
      }}
      style={{
        width: "100%",
        height: "100%",
        padding: "50px",
        paddingRight: "65px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Hidden Textarea for Mobile Keyboard Support */}
      <textarea
        ref={mobileInputRef}
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
          zIndex: 1, // Ensure terminal visual is above textarea
        }}
      />
    </div>
  );
});
