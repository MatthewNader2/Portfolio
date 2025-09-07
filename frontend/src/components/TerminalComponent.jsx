import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";

export const TerminalComponent = forwardRef(({ onCommand, onData }, ref) => {
  const terminalContainerRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());

  const state = useRef({
    currentLine: "",
    cursorIndex: 0,
    history: [],
    historyIndex: -1,
    suggestion: "",
    tabPressCount: 0,
  });

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

  useImperativeHandle(ref, () => ({
    write: (text) => term.current?.write(text.replace(/\r?\n/g, "\r\n")),
    clear: () => term.current?.clear(),
    prompt: () => term.current?.write("\r\n> "),
    focus: () => term.current?.focus(),
    // Expose the raw terminal instance for addons
    getTerminal: () => term.current,
    // Expose the official select API
    select: (col, row, width, height) => {
      term.current?.select(col, row, width, height);
    },
    getSelection: () => term.current?.getSelection(),
    clearSelection: () => term.current?.clearSelection(),
  }));

  useEffect(() => {
    if (terminalContainerRef.current && !term.current) {
      const completionSound = new Audio("/assets/bell.oga");
      completionSound.volume = 0.8;

      term.current = new Terminal({
        fontFamily: '"Pixelmix", monospace',
        fontSize: 16,
        cursorBlink: true,
        theme: {
          background: "rgba(0, 0, 0, 0)",
          foreground: "#00ff00",
          cursor: "#00ff00",
          selectionBackground: "rgba(0, 255, 0, 0.3)",
        },
        allowTransparency: true,
      });

      term.current.loadAddon(new WebLinksAddon());
      term.current.loadAddon(fitAddon.current);
      term.current.open(terminalContainerRef.current);
      fitAddon.current.fit();

      // Enable Mouse Reporting
      term.current.write("\x1b[?1003h\x1b[?1006h");

      // Forward all raw data events to the parent
      term.current.onData((data) => {
        onData(data);
      });

      term.current.writeln("Welcome to Matthew's Interactive Portfolio!");
      term.current.writeln("Type 'help' for a list of commands.");
      term.current.writeln("Links are now fully functional:");
      term.current.writeln(" - https://github.com/matthewmiglio");
      term.current.writeln(" - https://www.google.com");
      term.current.write("> ");

      const getSuggestion = (line) => {
        if (line.length === 0 || line.endsWith(" ")) return "";
        const currentWord = line.slice(line.lastIndexOf(" ") + 1);
        if (currentWord === "") return "";
        const source =
          line.indexOf(" ") === -1 ? availableCommands : availableSections;
        const match = source.find(
          (item) => item.startsWith(currentWord) && item !== currentWord,
        );
        return match ? match.slice(currentWord.length) : "";
      };

      const redrawLine = () => {
        const { currentLine, cursorIndex } = state.current;
        const suggestion = getSuggestion(currentLine);
        state.current.suggestion = suggestion;
        let output = `\x1b[2K\r> ${currentLine}`;
        if (suggestion && cursorIndex === currentLine.length) {
          output += `\x1b[38;5;28m${suggestion}\x1b[0m`;
        }
        term.current.write(output);
        term.current.write(`\x1b[${cursorIndex + 3}G`);
      };

      term.current.onKey(({ key, domEvent }) => {
        domEvent.preventDefault();
        const s = state.current;
        if (domEvent.key !== "Tab") s.tabPressCount = 0;

        switch (domEvent.key) {
          case "Enter":
            if (s.currentLine.trim() !== "") {
              term.current.write("\r\n");
              onCommand(s.currentLine.trim());
              s.history = [s.currentLine.trim(), ...s.history];
              s.historyIndex = -1;
            } else {
              onCommand("");
            }
            s.currentLine = "";
            s.cursorIndex = 0;
            s.suggestion = "";
            break;
          case "Backspace":
            if (s.cursorIndex > 0) {
              s.currentLine =
                s.currentLine.slice(0, s.cursorIndex - 1) +
                s.currentLine.slice(s.cursorIndex);
              s.cursorIndex--;
              redrawLine();
            }
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
              redrawLine();
            } else if (s.cursorIndex < s.currentLine.length) {
              s.cursorIndex++;
              redrawLine();
            }
            break;
          case "Tab":
            if (s.suggestion) {
              s.currentLine += s.suggestion;
              if (s.currentLine === "cat" || s.currentLine === "echo") {
                s.currentLine += " ";
              }
              s.cursorIndex = s.currentLine.length;
              redrawLine();
            } else {
              const currentWord = s.currentLine.slice(
                s.currentLine.lastIndexOf(" ") + 1,
              );
              const source =
                s.currentLine.indexOf(" ") === -1
                  ? availableCommands
                  : availableSections;
              const matches = source.filter((item) =>
                item.startsWith(currentWord),
              );
              if (matches.length > 1 && s.tabPressCount >= 1) {
                completionSound.play().catch((e) => {});
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
            if (s.historyIndex > 0) {
              s.historyIndex--;
              s.currentLine = s.history[s.historyIndex];
              s.cursorIndex = s.currentLine.length;
              redrawLine();
            } else {
              s.historyIndex = -1;
              s.currentLine = "";
              s.cursorIndex = 0;
              redrawLine();
            }
            break;
          default:
            if (
              key.length === 1 &&
              !domEvent.altKey &&
              !domEvent.ctrlKey &&
              !domEvent.metaKey
            ) {
              s.currentLine =
                s.currentLine.slice(0, s.cursorIndex) +
                key +
                s.currentLine.slice(s.cursorIndex);
              s.cursorIndex++;
              redrawLine();
            }
            break;
        }
      });
    }

    return () => {
      term.current?.write("\x1b[?1003l\x1b[?1006l");
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "50px",
        boxSizing: "border-box",
      }}
    >
      <div
        ref={terminalContainerRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
});
