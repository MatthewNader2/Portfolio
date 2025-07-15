import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export default function TerminalComponent() {
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());

  // --- PERMANENT LOGGING ---
  console.log("[TerminalComponent LOG] Component is mounting.");
  // -------------------------

  useEffect(() => {
    // --- PERMANENT LOGGING ---
    console.log(
      "[TerminalComponent LOG] useEffect running. Attempting to create terminal.",
    );
    // -------------------------

    if (terminalRef.current && !term.current) {
      // --- PERMANENT LOGGING ---
      console.log(
        "[TerminalComponent LOG] SUCCESS: Creating new XTerm instance.",
      );
      // -------------------------

      term.current = new Terminal({
        fontFamily: "Pixelmix, monospace",
        fontSize: 20,
        cursorBlink: true,
        theme: {
          background: "rgba(0, 0, 0, 0)",
          foreground: "#00ff00",
          cursor: "#00ff00",
        },
        allowTransparency: true,
        scrollback: 1000,
      });

      term.current.loadAddon(fitAddon.current);
      term.current.open(terminalRef.current);
      fitAddon.current.fit();

      let currentLine = "";
      const prompt = () => term.current.write("\r\n> ");
      term.current.writeln("Welcome to my portfolio!");
      term.current.writeln('Type "help" for a list of commands.');
      prompt();
      term.current.onKey(({ key, domEvent }) => {
        if (domEvent.keyCode === 13) {
          if (currentLine.trim() === "") {
            prompt();
            return;
          }
          term.current.writeln("");
          switch (currentLine.trim().toLowerCase()) {
            case "help":
              term.current.writeln("  about    - Who am I?");
              term.current.writeln("  skills   - What can I do?");
              term.current.writeln("  clear    - Clear the terminal screen.");
              break;
            case "about":
              term.current.writeln(
                "  I am a passionate developer creating interactive web experiences!",
              );
              break;
            case "skills":
              term.current.writeln(
                "  React | Three.js | C | WebAssembly | Node.js",
              );
              break;
            case "clear":
              term.current.clear();
              break;
            default:
              term.current.writeln(
                `  Command not found: ${currentLine.trim()}`,
              );
              break;
          }
          currentLine = "";
          prompt();
        } else if (domEvent.keyCode === 8) {
          if (currentLine.length > 0) {
            term.current.write("\b \b");
            currentLine = currentLine.slice(0, -1);
          }
        } else {
          currentLine += key;
          term.current.write(key);
        }
      });
    }

    const handleResize = () => {
      fitAddon.current.fit();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return <div ref={terminalRef} className="w-full h-full" />;
}
