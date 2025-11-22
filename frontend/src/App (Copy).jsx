// --- START OF FILE App.jsx ---

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { WebGLRenderer } from "three";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import Stats from "stats.js";

// --- Firebase ---
import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { TerminalComponent } from "./components/TerminalComponent";
import backgroundUrl from "./assets/background.jpg";

// --- GLOBAL CACHE ---
const ASCII_CACHE = {
  profile: "",
  icons: {},
};

// --- CONFIGURATION ---
const TERMINAL_COLS = 44;

// --- ICONS ---
const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" height="24" width="24">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
  </svg>
);

// --- HELPER: Strip ANSI Codes ---
const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, "");

// --- HELPER: Robust Text Wrapper ---
const wrapText = (text, maxWidth, indent = "") => {
  if (!text) return "";
  text = text.trim();
  const paragraphs = text.split(/\r?\n/);
  return paragraphs
    .map((para) => {
      if (!para.trim()) return "";
      const words = para.trim().split(/\s+/);
      let lines = [];
      let currentLine = words[0];
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const currentLen = stripAnsi(currentLine).length;
        const wordLen = stripAnsi(word).length;
        const indentLen = indent.length;
        if (currentLen + 1 + wordLen <= maxWidth - indentLen) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines.join("\n" + indent);
    })
    .join("\n" + indent);
};

// --- HELPER: High-Fidelity ASCII Generator ---
const generateAsciiArt = (imageUrl, width = 60) => {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve("");
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const height = (img.height / img.width) * width * 0.5;
      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const data = ctx.getImageData(0, 0, width, height).data;
        const chars =
          "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";
        let ascii = "";
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const offset = (y * canvas.width + x) * 4;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            const alpha = data[offset + 3];
            if (alpha < 20) {
              ascii += " ";
              continue;
            }
            const avg = (r + g + b) / 3;
            const charIndex = Math.floor((avg / 255) * (chars.length - 1));
            const char = chars[chars.length - 1 - charIndex] || ".";
            ascii += `\x1b[38;2;${r};${g};${b}m${char}`;
          }
          ascii += "\x1b[0m\n";
        }
        resolve(ascii);
      } catch (e) {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
  });
};

// --- FALLBACK ICON MAP ---
const FALLBACK_ICONS = {
  "c++": "https://cdn.simpleicons.org/cplusplus/00599C",
  matlab: "https://cdn.simpleicons.org/matlab/0076A8",
  "c#": "https://cdn.simpleicons.org/csharp/239120",
  "three.js": "https://cdn.simpleicons.org/threedotjs/FFFFFF",
  react: "https://cdn.simpleicons.org/react/61DAFB",
  python: "https://cdn.simpleicons.org/python/3776AB",
  javascript: "https://cdn.simpleicons.org/javascript/F7DF1E",
  linux: "https://cdn.simpleicons.org/linux/FCC624",
  git: "https://cdn.simpleicons.org/git/F05032",
  docker: "https://cdn.simpleicons.org/docker/2496ED",
  firebase: "https://cdn.simpleicons.org/firebase/FFCA28",
  arduino: "https://cdn.simpleicons.org/arduino/00979D",
  unity: "https://cdn.simpleicons.org/unity/FFFFFF",
  opencv: "https://cdn.simpleicons.org/opencv/5C3EE8",
  pytorch: "https://cdn.simpleicons.org/pytorch/EE4C2C",
  flask: "https://cdn.simpleicons.org/flask/FFFFFF",
  bash: "https://cdn.simpleicons.org/gnu-bash/FFFFFF",
  rust: "https://cdn.simpleicons.org/rust/FFFFFF",
  tailwindcss: "https://cdn.simpleicons.org/tailwindcss/06B6D4",
  dotnet: "https://cdn.simpleicons.org/dotnet/512BD4",
};

// --- HELPER: Boot Sequence Simulator ---
const runBootSequence = async (terminal) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const write = (text) => terminal.write(text);

  // Clear initial welcome message for the boot sequence
  terminal.clear();

  write(
    "\x1b[1;32muser@portfolio\x1b[0m:\x1b[1;34m~\x1b[0m$ sudo apt update\r\n",
  );
  await sleep(400);

  const packages = [
    "http://archive.ubuntu.com/ubuntu jammy InRelease",
    "http://security.ubuntu.com/ubuntu jammy-security InRelease",
    "http://archive.ubuntu.com/ubuntu jammy-updates InRelease",
    "https://firebase.google.com/v9/firestore/data",
    "https://threejs.org/examples/jsm/loaders/GLTFLoader",
    "https://wasm.modules/engine/core.wasm",
  ];

  for (let i = 0; i < packages.length; i++) {
    const speed = Math.floor(Math.random() * 5000) + 1200;
    write(`Get:${i + 1} ${packages[i]} [${speed} kB]\r\n`);
    await sleep(Math.random() * 150 + 50);
  }

  write("Fetched 24.8 MB in 1s (18.5 MB/s)\r\n");
  write("Reading package lists... Done\r\n");
  write("Building dependency tree... Done\r\n");
  write("Reading state information... Done\r\n");
  write(
    "2 packages can be upgraded. Run 'apt list --upgradable' to see them.\r\n",
  );

  write(
    "\x1b[1;32muser@portfolio\x1b[0m:\x1b[1;34m~\x1b[0m$ sudo apt upgrade -y\r\n",
  );
  await sleep(600);
  write("Reading package lists... Done\r\n");
  write("Building dependency tree... Done\r\n");
  write("Calculating upgrade... Done\r\n");
  write("The following packages will be upgraded:\r\n");
  write("  portfolio-core wasm-engine\r\n");
  write("2 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\r\n");
  write("Need to get 54.2 MB of archives.\r\n");
  write(
    "After this operation, 1024 KB of additional disk space will be used.\r\n",
  );

  // Progress Bar Simulation
  const totalSteps = 20;
  for (let i = 0; i <= totalSteps; i++) {
    const percent = Math.round((i / totalSteps) * 100);
    const filled = "#".repeat(i);
    const empty = ".".repeat(totalSteps - i);
    // \r returns to start of line to overwrite
    write(`\rProgress: [${filled}${empty}] ${percent}%`);
    await sleep(Math.random() * 100 + 20);
  }
  write("\r\n");

  write("Unpacking portfolio-core (1.0.2) over (1.0.1)...\r\n");
  await sleep(200);
  write("Setting up wasm-engine (2.4.0)...\r\n");
  await sleep(200);
  write("Processing triggers for libc-bin (2.35-0ubuntu3.1)...\r\n");
  await sleep(500);
  write("System successfully initialized.\r\n");
  await sleep(800);

  terminal.clear();
  terminal.write("Welcome to Matthew's Interactive Portfolio!\r\n");
  terminal.write("Type 'help' for a list of commands.\r\n");
  terminal.prompt();
};

export default function App() {
  const mountRef = useRef(null);
  const terminalElRef = useRef(null);
  const terminalComponentRef = useRef(null);

  // --- State Management ---
  const [wasmEngine, setWasmEngine] = useState(null);
  const [portfolioDataString, setPortfolioDataString] = useState("");
  const [mouseDebug, setMouseDebug] = useState(false);

  // --- Loading & Transition State ---
  const [isBooting, setIsBooting] = useState(true);
  const [bootFinished, setBootFinished] = useState(false);

  // --- Settings State ---
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    particles: true,
    glitch: true,
  });

  // --- Context Menu State ---
  const [contextMenu, setContextMenu] = useState(null);

  // 3D Refs
  const threeObjectsRef = useRef({
    camera: null,
    eventPlane: null,
    renderer: null,
  });
  const cornerTlRef = useRef(null);
  const cornerTrRef = useRef(null);
  const cornerBlRef = useRef(null);
  const cornerBrRef = useRef(null);
  const redPointerRef = useRef(null);
  const greenPointerRef = useRef(null);
  const isDraggingOnTerminal = useRef(false);
  const selectionStartRef = useRef(null);
  const hoveredLinkRef = useRef(null);

  // --- CONTEXT MENU ACTIONS ---
  const handleCopy = async () => {
    const text = terminalComponentRef.current?.getSelection();
    if (text) {
      await navigator.clipboard.writeText(text);
    }
    setContextMenu(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) terminalComponentRef.current?.paste(text);
    } catch (err) {
      console.error("Paste failed", err);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  // --- COMMAND HANDLER ---
  const handleTerminalCommand = (command) => {
    // Prevent commands during boot
    if (isBooting) return;

    if (!wasmEngine || !portfolioDataString || !terminalComponentRef.current) {
      terminalComponentRef.current?.write("\r\nSystem not ready. Please wait.");
      terminalComponentRef.current?.prompt();
      return;
    }

    if (command.trim() === "debug mouse") {
      const newDebugState = !mouseDebug;
      setMouseDebug(newDebugState);
      const status = newDebugState ? "ON" : "OFF";
      terminalComponentRef.current?.write(
        `\r\nMouse debugging is now ${status}.\r\n`,
      );
      terminalComponentRef.current?.prompt();
      return;
    }

    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      terminalComponentRef.current.prompt();
      return;
    }

    let result = wasmEngine.processCommand(trimmedCommand, portfolioDataString);

    if (result === "COMMAND_CLEAR") {
      terminalComponentRef.current.clear();
    } else {
      if (result.includes("[[PROFILE_ART]]")) {
        result = result.replace("[[PROFILE_ART]]", ASCII_CACHE.profile);
      }
      result = result.replace(/\[\[ICON:(.*?)\]\]/g, (match, skillKey) => {
        return ASCII_CACHE.icons[skillKey] || "";
      });

      terminalComponentRef.current.write(result);
      terminalComponentRef.current.prompt();
    }
  };

  // --- MOUSE INTERACTION ---
  useEffect(() => {
    if (!mountRef.current) return;

    const getTermCoords = (event) => {
      const { camera, eventPlane } = threeObjectsRef.current;
      const container = mountRef.current;
      if (!camera || !eventPlane || !container) return null;

      const { clientWidth, clientHeight } = container;
      eventPlane.updateMatrixWorld();

      const rect = container.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      const mouse = new THREE.Vector2();
      const raycaster = new THREE.Raycaster();

      mouse.x = (offsetX / clientWidth) * 2 - 1;
      mouse.y = -(offsetY / clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(eventPlane);

      if (intersects.length === 0) {
        if (redPointerRef.current) redPointerRef.current.style.display = "none";
        return null;
      }

      const uv = intersects[0].uv;
      const PADDING = 50;
      const TERM_WIDTH = 1024;
      const TERM_HEIGHT = 768;

      const localX = uv.x * TERM_WIDTH;
      const localY = (1 - uv.y) * TERM_HEIGHT;

      const dims = terminalComponentRef.current?.getDimensions();
      if (!dims) return null;

      const contentWidth = TERM_WIDTH - PADDING * 2;
      const contentHeight = TERM_HEIGHT - PADDING * 2;
      const cellWidth = contentWidth / dims.cols;
      const cellHeight = contentHeight / dims.rows;

      let col = Math.floor((localX - PADDING) / cellWidth + 0.5);
      let row = Math.floor((localY - PADDING) / cellHeight);

      col = Math.max(0, Math.min(col, dims.cols - 1));
      row = Math.max(0, Math.min(row, dims.rows - 1));

      if (mouseDebug) {
        const char = terminalComponentRef.current?.getChar(col, row);
        console.log(`Hover: [${col}, ${row}] "${char}"`);
        if (redPointerRef.current) {
          const point = intersects[0].point.clone();
          point.project(camera);
          redPointerRef.current.style.display = "block";
          redPointerRef.current.style.left = `${(point.x * 0.5 + 0.5) * clientWidth}px`;
          redPointerRef.current.style.top = `${-(point.y * 0.5 - 0.5) * clientHeight}px`;
        }
      }

      return { col, row, dims };
    };

    const handleMouseDown = (event) => {
      if (event.isSynthetic) return;
      if (contextMenu) setContextMenu(null);
      if (event.button !== 0) return;

      if (event.detail === 2) {
        const coords = getTermCoords(event);
        if (coords) {
          terminalComponentRef.current?.selectWordAt(coords.col, coords.row);
          isDraggingOnTerminal.current = false;
          return;
        }
      }
      if (event.detail === 3) {
        const coords = getTermCoords(event);
        if (coords) {
          terminalComponentRef.current?.selectLineAt(coords.row);
          isDraggingOnTerminal.current = false;
          return;
        }
      }

      const coords = getTermCoords(event);
      if (coords) {
        isDraggingOnTerminal.current = true;
        selectionStartRef.current = { col: coords.col, row: coords.row };
        terminalComponentRef.current?.clearSelection();
      }
    };

    const handleMouseMove = (event) => {
      if (event.isSynthetic) return;
      if (contextMenu) return;

      const coords = getTermCoords(event);

      if (coords) {
        const link = terminalComponentRef.current?.getLinkAt(
          coords.col,
          coords.row,
        );

        if (link) {
          document.body.classList.add("force-pointer");
          document.body.classList.remove("force-text");
          if (redPointerRef.current) {
            redPointerRef.current.style.backgroundColor = "#00ffff";
            redPointerRef.current.style.boxShadow = "0 0 10px #00ffff";
          }
          hoveredLinkRef.current = link;
        } else {
          document.body.classList.remove("force-pointer");
          document.body.classList.add("force-text");
          if (redPointerRef.current) {
            redPointerRef.current.style.backgroundColor = "red";
            redPointerRef.current.style.boxShadow = "none";
          }
          hoveredLinkRef.current = null;
        }
      } else {
        document.body.classList.remove("force-pointer");
        document.body.classList.remove("force-text");
        if (redPointerRef.current) {
          redPointerRef.current.style.backgroundColor = "red";
          redPointerRef.current.style.boxShadow = "none";
        }
        hoveredLinkRef.current = null;
      }

      if (isDraggingOnTerminal.current && coords && selectionStartRef.current) {
        const start = selectionStartRef.current;
        const end = coords;
        const dims = coords.dims;

        let startIdx = start.row * dims.cols + start.col;
        let endIdx = end.row * dims.cols + end.col;

        if (endIdx < startIdx) {
          const temp = startIdx;
          startIdx = endIdx;
          endIdx = temp;
        }

        const length = endIdx - startIdx + 1;
        const sRow = Math.floor(startIdx / dims.cols);
        const sCol = startIdx % dims.cols;

        terminalComponentRef.current?.select(sCol, sRow, length);
      }
    };

    const handleMouseUp = (event) => {
      if (event.isSynthetic) return;

      const isClick =
        selectionStartRef.current &&
        getTermCoords(event)?.col === selectionStartRef.current.col &&
        getTermCoords(event)?.row === selectionStartRef.current.row;

      if (isClick && hoveredLinkRef.current) {
        window.open(hoveredLinkRef.current, "_blank");
      }

      isDraggingOnTerminal.current = false;
      selectionStartRef.current = null;
      if (redPointerRef.current) redPointerRef.current.style.display = "none";
    };

    const mount = mountRef.current;
    mount.addEventListener("mousedown", handleMouseDown);
    mount.addEventListener("mousemove", handleMouseMove);
    mount.addEventListener("mouseup", handleMouseUp);
    mount.addEventListener("contextmenu", handleContextMenu);

    return () => {
      mount.removeEventListener("mousedown", handleMouseDown);
      mount.removeEventListener("mousemove", handleMouseMove);
      mount.removeEventListener("mouseup", handleMouseUp);
      mount.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [mouseDebug, contextMenu]);

  // --- DATA INITIALIZATION & BOOT SEQUENCE ---
  useEffect(() => {
    const initialize = async () => {
      try {
        // 1. Load WASM
        const WasmModule = await import("./wasm/engine.js");
        const engine = await WasmModule.default();
        const processCommand = engine.cwrap("process_command", "string", [
          "string",
          "string",
        ]);
        setWasmEngine({ processCommand });

        // 2. Start Boot Sequence Effect (Visuals)
        // We run this in parallel with data fetching, but await it before finishing
        const bootPromise = runBootSequence(terminalComponentRef.current);

        // 3. Fetch Data
        const iconsSnap = await getDocs(collection(db, "skill_icons"));
        let iconMap = { ...FALLBACK_ICONS };
        if (!iconsSnap.empty) {
          iconsSnap.docs.forEach((doc) => {
            const d = doc.data();
            Object.keys(d).forEach((key) => {
              if (typeof d[key] === "string" && d[key].startsWith("http")) {
                iconMap[key.toLowerCase()] = d[key];
              }
            });
          });
        }

        const projectsSnap = await getDocs(collection(db, "projects"));
        const experienceSnap = await getDocs(collection(db, "experience"));
        const educationSnap = await getDocs(collection(db, "education"));
        const awardsSnap = await getDocs(collection(db, "awards"));
        const skillsSnap = await getDocs(collection(db, "skills"));
        const personalInfoSnap = await getDocs(collection(db, "personal_info"));

        const info = !personalInfoSnap.empty
          ? personalInfoSnap.docs[0].data()
          : {};

        if (info.profile_picture_url) {
          ASCII_CACHE.profile = await generateAsciiArt(
            info.profile_picture_url,
            70,
          );
        }

        const data = {};

        const aboutDesc = wrapText(
          info.description || "Full Stack Developer.",
          TERMINAL_COLS,
        );
        data["about"] = {
          content: `\n[[PROFILE_ART]]\nNAME: ${info.name || "Matthew Nader"}\n\n${aboutDesc}`,
        };

        const formatLink = (link) => {
          if (!link || link === "N/A") return "N/A";
          const clean = link.replace(/^https?:\/\//, "");
          return `https://${clean}`;
        };

        data["contact"] = {
          email: info.email || "N/A",
          linkedin: formatLink(info.linkedin),
          github_profile: formatLink(info.github),
        };

        const eduDoc = !educationSnap.empty ? educationSnap.docs[0].data() : {};
        data["education"] = {
          degree: eduDoc.degree || "N/A",
          institution: eduDoc.institution || "N/A",
          graduation_date: eduDoc.graduation_date || "N/A",
        };

        const skillsRaw = !skillsSnap.empty ? skillsSnap.docs[0].data() : {};
        const formattedSkills = {};
        const skillKeys = [
          "languages",
          "frameworks_libraries",
          "tools_platforms",
          "concepts",
        ];

        for (const key of skillKeys) {
          const val = skillsRaw[key];
          let items = [];
          if (val && typeof val === "object" && !Array.isArray(val))
            items = Object.values(val);
          else if (Array.isArray(val)) items = val;

          const itemsFormatted = await Promise.all(
            items.map(async (item, index) => {
              const lowerName = item.toLowerCase().trim();
              const iconKey = Object.keys(iconMap).find(
                (k) =>
                  lowerName === k ||
                  lowerName.includes(k) ||
                  k.includes(lowerName),
              );
              const iconUrl = iconKey ? iconMap[iconKey] : null;
              let prefix = index > 0 ? "\b\b\n" : "";
              const separator = `\x1b[38;5;240m${"-".repeat(40)}\x1b[0m`;
              let displayString = "";

              if (iconUrl) {
                const ascii = await generateAsciiArt(iconUrl, 28);
                const placeholder = `[[ICON:${lowerName}]]`;
                ASCII_CACHE.icons[lowerName] = `\n${ascii}\n`;
                displayString = `${prefix}${separator}\n${placeholder}\n   >> ${item}`;
              } else {
                displayString = `${prefix}${separator}\n   >> ${item}`;
              }
              return displayString;
            }),
          );

          if (itemsFormatted.length > 0) {
            itemsFormatted[itemsFormatted.length - 1] += "\n";
          }
          formattedSkills[key] =
            itemsFormatted.length > 0 ? itemsFormatted : ["N/A"];
        }
        data["skills"] = formattedSkills;

        data["projects"] = projectsSnap.docs.map((doc) => {
          const d = doc.data();
          const separator = `\x1b[38;5;240m${"-".repeat(TERMINAL_COLS)}\x1b[0m`;
          const rawTitle = d.title || "Untitled";
          const wrappedTitle = wrapText(rawTitle, TERMINAL_COLS);
          const title = `\n${separator}\n\x1b[1;32m${wrappedTitle}\x1b[0m`;
          const subtitle = `\x1b[36m${d.subtitle || ""}\x1b[0m`;
          const rawDesc = d.description || "";
          const wrappedDesc = wrapText(rawDesc, TERMINAL_COLS, "   ");
          const description = `\n   ${wrappedDesc}`;

          return {
            title: title,
            subtitle: subtitle,
            description: description,
            github: formatLink(d.github),
          };
        });

        data["experience"] = experienceSnap.docs.map((doc) => {
          const d = doc.data();
          const separator = `\x1b[38;5;240m${"-".repeat(TERMINAL_COLS)}\x1b[0m`;
          const rawTitle = d.title || "N/A";
          const rawCompany = d.company || "N/A";
          const rawDuration = d.duration || "N/A";
          const fullLineLen =
            rawTitle.length +
            4 +
            rawCompany.length +
            2 +
            rawDuration.length +
            1;
          const titleCompanyLen = rawTitle.length + 4 + rawCompany.length;
          let finalTitle = rawTitle;
          let finalCompany = rawCompany;

          if (fullLineLen <= TERMINAL_COLS) {
            // Fits
          } else if (titleCompanyLen <= TERMINAL_COLS) {
            finalCompany = `${rawCompany}\n`;
          } else {
            finalTitle = `${rawTitle}\n`;
            finalCompany = `${rawCompany}\n`;
          }

          const title = `\n${separator}\n\x1b[1;32m${wrapText(finalTitle, TERMINAL_COLS)}\x1b[0m`;
          const company = `\x1b[1;37m${wrapText(finalCompany, TERMINAL_COLS)}\x1b[0m`;
          const duration = `\x1b[36m${d.duration || "N/A"}\x1b[0m`;

          let descArray = Array.isArray(d.description)
            ? d.description
            : [d.description || ""];
          descArray = descArray.filter(
            (line) => line && line.trim().length > 0,
          );
          descArray = descArray.map((line) => {
            return wrapText(line, TERMINAL_COLS - 4, "    ") + "\n";
          });

          return {
            title: title,
            company: company,
            duration: duration,
            description: descArray,
          };
        });

        data["awards"] = awardsSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            award: d.award || "N/A",
            event: d.event || "N/A",
            date: d.date || "N/A",
          };
        });

        setPortfolioDataString(JSON.stringify(data));

        // Wait for the visual boot sequence to finish if it hasn't already
        await bootPromise;

        // Trigger the camera pull-back
        setBootFinished(true);
        setIsBooting(false);
      } catch (error) {
        console.error("Initialization failed:", error);
        terminalComponentRef.current?.write(
          `\r\nFATAL ERROR: ${error.message}\r\n`,
        );
      }
    };

    // Small delay to ensure Terminal component is mounted before writing
    setTimeout(initialize, 100);
  }, []);

  // --- 3D RENDER LOOP & FEATURES ---
  useEffect(() => {
    if (!mountRef.current || !terminalElRef.current) return;

    const mount = mountRef.current;
    let raf = null;

    const finalParams = {
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotX: -0.09079,
      rotY: 0,
      rotZ: 0,
      scaleX: 0.922,
      scaleY: 0.922,
    };
    const tvScale = 1.08;
    const backgroundZoom = 1.1;
    const stats = new Stats();
    stats.showPanel(0);
    mount.appendChild(stats.dom);
    stats.dom.style.position = "absolute";
    stats.dom.style.top = "10px";
    stats.dom.style.left = "10px";

    const scene = new THREE.Scene();
    const cssScene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );

    // --- CAMERA TRANSITION LOGIC ---
    // Start Position: Very close to the screen (simulating full screen)
    // End Position: The standard room view
    const startCamPos = new THREE.Vector3(0, 0.15, 0.3);
    const endCamPos = new THREE.Vector3(0, 0.1, 0.7);

    // Initialize at start position
    camera.position.copy(startCamPos);
    camera.lookAt(0, 0, 0);

    const webglRenderer = new WebGLRenderer({ antialias: true, alpha: true });
    webglRenderer.setSize(window.innerWidth, window.innerHeight);
    webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
    webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    webglRenderer.toneMappingExposure = 0.85;
    const webglContainer = document.createElement("div");
    webglContainer.id = "webgl-renderer";
    webglContainer.className = "render-container";
    webglContainer.appendChild(webglRenderer.domElement);
    mount.appendChild(webglContainer);

    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
    const cssContainer = document.createElement("div");
    cssContainer.id = "css-renderer";
    cssContainer.className = "render-container";
    cssContainer.appendChild(cssRenderer.domElement);
    mount.appendChild(cssContainer);

    new THREE.TextureLoader().load(backgroundUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      const zoomFactor = 1 / backgroundZoom;
      const offsetFactor = (1 - zoomFactor) / 2;
      t.repeat.set(zoomFactor, zoomFactor);
      t.offset.set(offsetFactor, offsetFactor);
      scene.background = t;
    });

    scene.add(new THREE.AmbientLight(0.7));
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 1));
    const dl = new THREE.DirectionalLight(0xffffff, 2.5);
    dl.position.set(5, 5, 5);
    scene.add(dl);

    // --- PARTICLES (Dust Style) ---
    const particleCount = 600;
    const particleGeo = new THREE.DodecahedronGeometry(0.008, 0);
    const particleMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.7,
    });
    const particleMesh = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      particleCount,
    );
    scene.add(particleMesh);

    const particlesData = [];
    const color = new THREE.Color();
    const palette = [0xffffff, 0xdddddd, 0xeeeecc, 0xddeeff, 0xfffacd];

    for (let i = 0; i < particleCount; i++) {
      particlesData.push({
        time: Math.random() * 100,
        speed: 0.003 + Math.random() / 600,
        x: (Math.random() - 0.5) * 25,
        y: (Math.random() - 0.5) * 25,
        z: (Math.random() - 0.5) * 15,
      });
      color.setHex(palette[Math.floor(Math.random() * palette.length)]);
      particleMesh.setColorAt(i, color);
    }
    particleMesh.instanceColor.needsUpdate = true;
    const dummy = new THREE.Object3D();

    // --- LOADERS ---
    const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setKTX2Loader(ktx2Loader);
    ktx2Loader.detectSupport(webglRenderer);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    const RASTER_SCALE = 0.5;

    // --- HELPER FUNCTIONS (3D) ---
    function worldToScreenXY(vWorld, camera, canvasRect) {
      const ndc = vWorld.clone().project(camera);
      const x = (ndc.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
      const y = (-ndc.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top;
      return [x, y];
    }

    function traceBoundary(imgData, w, h) {
      let start = -1;
      for (let i = 0; i < w * h; i++) {
        if (imgData[i]) {
          start = i;
          break;
        }
      }
      if (start === -1) return [];
      const idxToXY = (idx) => [idx % w, Math.floor(idx / w)];
      const xyToIdx = (x, y) => y * w + x;
      const dirs = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
      ];
      const [sx, sy] = idxToXY(start);
      let cx = sx,
        cy = sy;
      let pd = 7;
      const contour = [];
      let step = 0;
      const maxSteps = w * h * 10;
      do {
        contour.push([cx, cy]);
        let found = false;
        for (let k = 0; k < 8; k++) {
          const di = (pd + 1 + k) % 8;
          const nx = cx + dirs[di][0];
          const ny = cy + dirs[di][1];
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            if (imgData[xyToIdx(nx, ny)]) {
              cx = nx;
              cy = ny;
              pd = (di + 6) % 8;
              found = true;
              break;
            }
          }
        }
        if (!found) break;
        step++;
        if (step > maxSteps) break;
      } while (!(cx === sx && cy === sy));
      return contour;
    }

    function simplifyRDP(points, epsilon) {
      if (points.length < 3) return points.slice();
      const sqr = (a) => a * a;
      function dist2PointToSeg(px, py, [x1, y1], [x2, y2]) {
        const A = px - x1,
          B = py - y1,
          C = x2 - x1,
          D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let t = len_sq ? dot / len_sq : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = x1 + t * C,
          cy = y1 + t * D;
        return sqr(px - cx) + sqr(py - cy);
      }
      const eps2 = epsilon * epsilon;
      const result = [];
      function rdp(arr, i, j) {
        let idx = -1,
          maxd = -1;
        for (let k = i + 1; k < j; k++) {
          const d2 = dist2PointToSeg(arr[k][0], arr[k][1], arr[i], arr[j]);
          if (d2 > maxd) {
            idx = k;
            maxd = d2;
          }
        }
        if (maxd > eps2) {
          rdp(arr, i, idx);
          rdp(arr, idx, j);
        } else {
          result.push(arr[i]);
        }
      }
      rdp(points, 0, points.length - 1);
      result.push(points[points.length - 1]);
      return result;
    }

    function contourToClipPathPercent(
      contour,
      rectLeft,
      rectTop,
      rectW,
      rectH,
    ) {
      if (rectW < 1 || rectH < 1) return "polygon(0% 0%)";
      const pts = contour.map(([x, y]) => {
        const px = ((x + 0.5 - rectLeft) / rectW) * 100;
        const py = ((y + 0.5 - rectTop) / rectH) * 100;
        return `${px.toFixed(3)}% ${py.toFixed(3)}%`;
      });
      return `polygon(${pts.join(", ")})`;
    }

    function rasterizeProjectedTriangles(projectedTris, canvasW, canvasH) {
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      for (const tri of projectedTris) {
        ctx.moveTo(tri[0][0], tri[0][1]);
        ctx.lineTo(tri[1][0], tri[1][1]);
        ctx.lineTo(tri[2][0], tri[2][1]);
        ctx.closePath();
      }
      ctx.fill();
      const im = ctx.getImageData(0, 0, canvasW, canvasH);
      const data = im.data;
      const mask = new Uint8Array(canvasW * canvasH);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        mask[j] = data[i + 3] > 0 ? 1 : 0;
      }
      return { mask };
    }

    function buildClipPathFromMesh(meshToProject) {
      meshToProject.updateWorldMatrix(true, false);
      const geom = meshToProject.geometry;
      if (!geom) return null;
      const posAttr = geom.attributes.position;
      const idxAttr = geom.index;
      const triCount = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
      const canvasRect = webglRenderer.domElement.getBoundingClientRect();
      if (canvasRect.width === 0 || canvasRect.height === 0) return null;
      const projectedTris = [];
      for (let i = 0; i < triCount; i++) {
        let ia = idxAttr ? idxAttr.array[3 * i] : 3 * i;
        let ib = idxAttr ? idxAttr.array[3 * i + 1] : 3 * i + 1;
        let ic = idxAttr ? idxAttr.array[3 * i + 2] : 3 * i + 2;
        const a = new THREE.Vector3().fromBufferAttribute(posAttr, ia);
        const b = new THREE.Vector3().fromBufferAttribute(posAttr, ib);
        const c = new THREE.Vector3().fromBufferAttribute(posAttr, ic);
        meshToProject.localToWorld(a);
        meshToProject.localToWorld(b);
        meshToProject.localToWorld(c);

        projectedTris.push([
          worldToScreenXY(a, camera, canvasRect),
          worldToScreenXY(b, camera, canvasRect),
          worldToScreenXY(c, camera, canvasRect),
        ]);
      }
      const canvasW = Math.max(
        16,
        Math.floor(window.innerWidth * RASTER_SCALE),
      );
      const canvasH = Math.max(
        16,
        Math.floor(window.innerHeight * RASTER_SCALE),
      );
      const scaledTris = projectedTris.map((tri) =>
        tri.map(([x, y]) => [x * RASTER_SCALE, y * RASTER_SCALE]),
      );
      const { mask } = rasterizeProjectedTriangles(
        scaledTris,
        canvasW,
        canvasH,
      );
      const contourScaled = traceBoundary(mask, canvasW, canvasH);
      if (!contourScaled || contourScaled.length === 0) return null;
      const contour = contourScaled.map(([sx, sy]) => [
        sx / RASTER_SCALE,
        sy / RASTER_SCALE,
      ]);
      const simplified = simplifyRDP(contour, 2.0);
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [x, y] of simplified) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const rectW = Math.max(2, maxX - minX);
      const rectH = Math.max(2, maxY - minY);
      const localPoints = simplified.map(([x, y]) => [x - minX, y - minY]);
      return contourToClipPathPercent(localPoints, 0, 0, rectW, rectH);
    }

    let resizeTimer = null;
    let rebuildClipPath = () => {};

    const onWindowResize = () => {
      if (mountRef.current) {
        const { clientWidth, clientHeight } = mountRef.current;

        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();

        webglRenderer.setSize(clientWidth, clientHeight);
        cssRenderer.setSize(clientWidth, clientHeight);

        cssRenderer.domElement.style.width = `${clientWidth}px`;
        cssRenderer.domElement.style.height = `${clientHeight}px`;

        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          rebuildClipPath();
          terminalComponentRef.current?.fit();
        }, 150);
      }
    };
    window.addEventListener("resize", onWindowResize);

    const eventPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    eventPlane.name = "eventPlaneForTerminal";
    scene.add(eventPlane);

    gltfLoader.load("/crt_tv_basis.glb", async (gltf) => {
      const tv = gltf.scene;

      let meshIndex = 0;
      tv.traverse((c) => {
        if (c.isMesh) {
          if (meshIndex === 0 || meshIndex === 2) {
            c.visible = false;
          } else {
            c.material.metalness = 0.4;
            c.material.roughness = 0.6;
            c.visible = true;
          }
          meshIndex++;
        }
      });

      let screenMesh = tv.getObjectByName("defaultMaterial_2");
      if (!screenMesh) {
        console.warn("[app] screen mesh not found, using a fallback");
        const fallbackScreen = tv.children[0]?.children?.find(
          (m) => m.isMesh && m.name.includes("defaultMaterial"),
        );
        if (!fallbackScreen) {
          scene.add(tv);
          return;
        }
        screenMesh = fallbackScreen;
      }
      screenMesh.visible = false;

      const group = new THREE.Group();
      group.position.set(0, -0.18, 0);
      group.rotation.y = Math.PI;
      group.scale.set(tvScale, tvScale, tvScale);
      group.add(tv);
      scene.add(group);

      requestAnimationFrame(() => {
        if (terminalElRef.current) {
          terminalElRef.current.style.visibility = "visible";
          terminalElRef.current.style.opacity = 1;
        }
      });

      const cssObject = new CSS3DObject(terminalElRef.current);
      cssScene.add(cssObject);

      const clipMesh = screenMesh.clone();
      clipMesh.material = new THREE.MeshBasicMaterial({ visible: false });
      scene.add(clipMesh);

      threeObjectsRef.current = { camera, eventPlane, renderer: webglRenderer };

      rebuildClipPath = () => {
        const terminalDiv = terminalElRef.current;
        if (!terminalDiv) return;
        const clipPath = buildClipPathFromMesh(clipMesh);
        if (clipPath) {
          terminalDiv.style.clipPath = clipPath;
          terminalDiv.style.webkitClipPath = clipPath;
        }
      };

      function updateTerminalTransform() {
        const termW = 1024,
          termH = 768;

        if (!screenMesh || !screenMesh.geometry) return;

        screenMesh.updateWorldMatrix(true, false);
        const screenBox = new THREE.Box3().setFromObject(screenMesh);
        const basePosition = screenBox.getCenter(new THREE.Vector3());
        const baseQuaternion = screenMesh.getWorldQuaternion(
          new THREE.Quaternion(),
        );
        const size = screenBox.getSize(new THREE.Vector3());

        if (size.x === 0 || size.y === 0) return;

        const baseScale = new THREE.Vector3(
          (size.x / termW) * 0.995,
          (size.y / termH) * 0.995,
          1,
        );

        cssObject.position.copy(basePosition);
        cssObject.quaternion.copy(baseQuaternion);
        cssObject.scale.copy(baseScale);
        cssObject.position.x += finalParams.offsetX;
        cssObject.position.y -= finalParams.offsetY;
        cssObject.translateZ(finalParams.offsetZ);
        const offsetQuaternion = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(finalParams.rotX, finalParams.rotY, finalParams.rotZ),
        );
        cssObject.quaternion.multiply(offsetQuaternion);
        cssObject.scale.x *= finalParams.scaleX;
        cssObject.scale.y *= finalParams.scaleY;

        clipMesh.position.copy(cssObject.position);
        clipMesh.quaternion.copy(cssObject.quaternion);
        clipMesh.scale.set(
          size.x * finalParams.scaleX,
          size.y * finalParams.scaleY,
          1,
        );

        eventPlane.position.copy(cssObject.position);
        eventPlane.quaternion.copy(cssObject.quaternion);
        eventPlane.scale.set(
          size.x * finalParams.scaleX,
          size.y * finalParams.scaleY,
          1,
        );
        eventPlane.updateMatrixWorld();
      }

      // --- ANIMATION STATE ---
      let transitionProgress = 0;
      const transitionSpeed = 0.015; // Adjust for speed of "pull back"

      function animate() {
        raf = requestAnimationFrame(animate);
        stats.begin();

        updateTerminalTransform();

        // --- CAMERA TRANSITION ---
        if (window.bootSequenceFinished && transitionProgress < 1) {
          transitionProgress += transitionSpeed;
          if (transitionProgress > 1) transitionProgress = 1;

          // Cubic Ease Out for smooth braking
          const t = 1 - Math.pow(1 - transitionProgress, 3);

          camera.position.lerpVectors(startCamPos, endCamPos, t);

          // CRITICAL FIX: Keep looking at the center of the TV while moving
          camera.lookAt(0, 0, 0);
        }

        // --- SYNC SETTINGS FOR PARTICLES ---
        const currentSettings = window.currentSettings || { particles: true };
        particleMesh.visible = currentSettings.particles;

        if (currentSettings.particles) {
          particlesData.forEach((particle, i) => {
            let { speed, x, y, z } = particle;
            const t = (particle.time += speed);
            dummy.position.set(
              x + Math.cos(t) + Math.sin(t * 1) / 10,
              y + Math.sin(t) + Math.cos(t * 2) / 10,
              z + Math.cos(t) + Math.sin(t * 3) / 10,
            );
            const s = Math.cos(t);
            dummy.scale.set(s, s, s);
            dummy.rotation.set(s * 5, s * 5, s * 5);
            dummy.updateMatrix();
            particleMesh.setMatrixAt(i, dummy.matrix);
          });
          particleMesh.instanceMatrix.needsUpdate = true;
        }

        webglRenderer.render(scene, camera);
        cssRenderer.render(cssScene, camera);
        stats.end();
      }

      onWindowResize();
      animate();
    });

    return () => {
      cancelAnimationFrame(raf);
      ktx2Loader.dispose();
      while (mount.firstChild) mount.removeChild(mount.firstChild);
      window.removeEventListener("resize", onWindowResize);
    };
  }, []); // Empty dependency array ensures scene loads once

  // --- SYNC STATE TO WINDOW FOR ANIMATION LOOP ---
  useEffect(() => {
    window.bootSequenceFinished = bootFinished;
  }, [bootFinished]);

  // --- SYNC SETTINGS (UI to DOM) ---
  useEffect(() => {
    window.currentSettings = settings;
    if (terminalElRef.current) {
      if (settings.glitch) {
        terminalElRef.current.classList.add("crt-effects");
        terminalElRef.current.classList.add("crt-scanlines");
      } else {
        terminalElRef.current.classList.remove("crt-effects");
        terminalElRef.current.classList.remove("crt-scanlines");
      }
    }
  }, [settings]);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        touchAction: "none",
        backgroundColor: "#000",
      }}
    >
      {/* --- DEBUG POINTERS --- */}
      <div
        ref={redPointerRef}
        style={{
          position: "fixed",
          width: "5px",
          height: "5px",
          backgroundColor: "red",
          borderRadius: "50%",
          zIndex: 9999,
          pointerEvents: "none",
          display: "none",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        ref={greenPointerRef}
        style={{
          position: "fixed",
          width: "5px",
          height: "5px",
          backgroundColor: "green",
          borderRadius: "50%",
          zIndex: 9998,
          pointerEvents: "none",
          display: "none",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* --- UI LAYER --- */}
      <div
        className="ui-layer"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 10000,
        }}
      >
        {/* SETTINGS BUTTON */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            color: "#00ff00",
            cursor: "pointer",
            opacity: 0.7,
            transition: "opacity 0.2s",
            pointerEvents: "auto",
            display: isBooting ? "none" : "block", // Hide during boot
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}
          onClick={() => setShowSettings(!showSettings)}
        >
          <GearIcon />
        </div>

        {/* SETTINGS MENU */}
        {showSettings && (
          <div
            style={{
              position: "absolute",
              top: "60px",
              right: "20px",
              width: "200px",
              backgroundColor: "rgba(0, 10, 0, 0.95)",
              border: "1px solid #00ff00",
              boxShadow: "0 0 15px rgba(0, 255, 0, 0.2)",
              padding: "15px",
              fontFamily: '"Pixelmix", monospace',
              fontSize: "12px",
              color: "#00ff00",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                marginBottom: "10px",
                borderBottom: "1px solid #004400",
                paddingBottom: "5px",
                fontWeight: "bold",
              }}
            >
              SYSTEM CONFIG
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
                alignItems: "center",
              }}
            >
              <span>DUST FX</span>
              <div
                onClick={() =>
                  setSettings((s) => ({ ...s, particles: !s.particles }))
                }
                style={{
                  width: "30px",
                  height: "15px",
                  border: "1px solid #00ff00",
                  cursor: "pointer",
                  position: "relative",
                  background: settings.particles
                    ? "rgba(0,255,0,0.2)"
                    : "transparent",
                }}
              >
                <div
                  style={{
                    width: "13px",
                    height: "13px",
                    backgroundColor: settings.particles ? "#00ff00" : "#004400",
                    position: "absolute",
                    top: 0,
                    left: settings.particles ? "15px" : 0,
                    transition: "left 0.2s",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "5px",
                alignItems: "center",
              }}
            >
              <span>CRT FX</span>
              <div
                onClick={() =>
                  setSettings((s) => ({ ...s, glitch: !s.glitch }))
                }
                style={{
                  width: "30px",
                  height: "15px",
                  border: "1px solid #00ff00",
                  cursor: "pointer",
                  position: "relative",
                  background: settings.glitch
                    ? "rgba(0,255,0,0.2)"
                    : "transparent",
                }}
              >
                <div
                  style={{
                    width: "13px",
                    height: "13px",
                    backgroundColor: settings.glitch ? "#00ff00" : "#004400",
                    position: "absolute",
                    top: 0,
                    left: settings.glitch ? "15px" : 0,
                    transition: "left 0.2s",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* CONTEXT MENU */}
        {contextMenu &&
          createPortal(
            <div
              style={{
                position: "fixed",
                top: contextMenu.y,
                left: contextMenu.x,
                backgroundColor: "#000",
                border: "1px solid #00ff00",
                color: "#00ff00",
                fontFamily: '"Pixelmix", monospace',
                fontSize: "14px",
                zIndex: 100000,
                padding: "5px 0",
                boxShadow: "0 0 15px rgba(0, 255, 0, 0.4)",
                minWidth: "120px",
                pointerEvents: "auto",
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div
                style={{
                  padding: "8px 20px",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#003300")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                onClick={handleCopy}
              >
                Copy
              </div>
              <div
                style={{
                  padding: "8px 20px",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#003300")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                onClick={handlePaste}
              >
                Paste
              </div>
            </div>,
            document.body,
          )}
      </div>

      {/* --- TERMINAL CONTAINER --- */}
      <div
        ref={terminalElRef}
        className="crt-effects crt-scanlines"
        style={{
          width: "1024px",
          height: "768px",
          pointerEvents: "none",
          visibility: "hidden",
          opacity: 0,
          transition: "opacity 0.3s ease-in",
          backgroundColor: "black",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <div
          ref={cornerTlRef}
          style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1 }}
        />
        <div
          ref={cornerTrRef}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 1,
            height: 1,
          }}
        />
        <div
          ref={cornerBlRef}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: 1,
            height: 1,
          }}
        />
        <div
          ref={cornerBrRef}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 1,
            height: 1,
          }}
        />

        {/* Always render TerminalComponent now, it handles the loading text itself */}
        <TerminalComponent
          ref={terminalComponentRef}
          onCommand={handleTerminalCommand}
          mouseDebug={mouseDebug}
        />
      </div>
    </div>
  );
}
