import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// --- Firebase & Fallback ---
import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { FALLBACK_PORTFOLIO_DATA } from "./fallbackData";

// --- Components & Assets ---
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

const FALLBACK_ICONS = {
  "c": "https://cdn.simpleicons.org/c/A8B9CC",
  "c++": "https://cdn.simpleicons.org/cplusplus/00599C",
  matlab: "https://cdn.simpleicons.org/matlab/0076A8",
  "c#": "https://cdn.simpleicons.org/csharp/239120",
  "three.js": "https://cdn.simpleicons.org/threedotjs/FFFFFF",
  react: "https://cdn.simpleicons.org/react/61DAFB",
  python: "https://cdn.simpleicons.org/python/3776AB",
  javascript: "https://cdn.simpleicons.org/javascript/F7DF1E",
  typescript: "https://cdn.simpleicons.org/typescript/3178C6",
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
  ros: "https://cdn.simpleicons.org/ros/22314E",
  onnx: "https://cdn.simpleicons.org/onnx/005CED",
  yolo: "https://cdn.simpleicons.org/opencv/5C3EE8",
};

// --- HELPERS ---

/* eslint-disable-next-line no-control-regex */
const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, "");

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

const generateAsciiArt = (imageUrl, width = 60) => {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve("");
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const height = Math.max(1, Math.floor((img.height / img.width) * width * 0.5));
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
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
  });
};

const runBootSequence = async (terminal) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const write = (text) => terminal?.write(text);

  if (!terminal) return;
  terminal.clear();

  write(
    "\x1b[1;32muser@portfolio\x1b[0m:\x1b[1;34m~\x1b[0m$ sudo apt update\r\n",
  );
  await sleep(350);

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
    await sleep(Math.random() * 100 + 40);
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
  await sleep(400);
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

  const totalSteps = 20;
  for (let i = 0; i <= totalSteps; i++) {
    const percent = Math.round((i / totalSteps) * 100);
    const filled = "#".repeat(i);
    const empty = ".".repeat(totalSteps - i);
    write(`\rProgress: [${filled}${empty}] ${percent}%`);
    await sleep(Math.random() * 60 + 20);
  }
  write("\r\n");

  write("Unpacking portfolio-core (1.0.2) over (1.0.1)...\r\n");
  await sleep(150);
  write("Setting up wasm-engine (2.4.0)...\r\n");
  await sleep(150);
  write("Processing triggers for libc-bin (2.35-0ubuntu3.1)...\r\n");
  await sleep(300);
  write("System successfully initialized.\r\n");
  await sleep(500);

  terminal.clear();
  terminal.write("Welcome to Matthew's Interactive Portfolio!\r\n");
  terminal.write("Type 'help' or 'ls' for a list of commands and sections.\r\n");
  terminal.prompt();
};

// --- MAIN COMPONENT ---

export default function App() {
  const mountRef = useRef(null);
  const terminalElRef = useRef(null);
  const terminalComponentRef = useRef(null);

  // --- State ---
  const [isBooting, setIsBooting] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ particles: true, glitch: true });
  const [contextMenu, setContextMenu] = useState(null);

  // --- Refs (Logic & 3D) ---
  const wasmEngineRef = useRef(null);
  const portfolioDataRef = useRef("");
  const isBootingRef = useRef(true);
  const bootFinishedRef = useRef(false);
  const settingsRef = useRef(settings);

  const threeObjectsRef = useRef({
    camera: null,
    eventPlane: null,
    renderer: null,
  });
  const isDraggingOnTerminal = useRef(false);
  const selectionStartRef = useRef(null);
  const hoveredLinkRef = useRef(null);

  // Sync settings ref
  useEffect(() => {
    settingsRef.current = settings;
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

  // --- Handlers ---

  const handleCopy = async () => {
    const text = terminalComponentRef.current?.getSelection();
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // clipboard access denied
      }
    }
    setContextMenu(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) terminalComponentRef.current?.paste(text);
    } catch {
      // Paste access denied
    }
    setContextMenu(null);
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  const handleTerminalCommand = useCallback((command) => {
    if (isBootingRef.current) return;

    if (
      !wasmEngineRef.current ||
      !portfolioDataRef.current ||
      !terminalComponentRef.current
    ) {
      terminalComponentRef.current?.write("\r\nSystem not ready. Please wait.");
      terminalComponentRef.current?.prompt();
      return;
    }

    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      terminalComponentRef.current.prompt();
      return;
    }

    let result = wasmEngineRef.current.processCommand(
      trimmedCommand,
      portfolioDataRef.current,
    );

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
  }, []);

  // --- Mouse & Touch Interaction (Raycasting) ---
  useEffect(() => {
    if (!mountRef.current) return;

    const getTermCoords = (clientX, clientY) => {
      const { camera, eventPlane } = threeObjectsRef.current;
      const container = mountRef.current;
      if (!camera || !eventPlane || !container) return null;

      const { clientWidth, clientHeight } = container;
      eventPlane.updateMatrixWorld();

      const rect = container.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const offsetY = clientY - rect.top;

      const mouse = new THREE.Vector2();
      const raycaster = new THREE.Raycaster();

      mouse.x = (offsetX / clientWidth) * 2 - 1;
      mouse.y = -(offsetY / clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(eventPlane);

      if (intersects.length === 0) {
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

      return { col, row, dims };
    };

    const handlePointerDown = (clientX, clientY, button, detail = 1) => {
      if (contextMenu) setContextMenu(null);
      if (button !== 0 && button !== undefined) return;

      if (detail === 2) {
        const coords = getTermCoords(clientX, clientY);
        if (coords) {
          terminalComponentRef.current?.selectWordAt(coords.col, coords.row);
          isDraggingOnTerminal.current = false;
          return;
        }
      }
      if (detail === 3) {
        const coords = getTermCoords(clientX, clientY);
        if (coords) {
          terminalComponentRef.current?.selectLineAt(coords.row);
          isDraggingOnTerminal.current = false;
          return;
        }
      }

      const coords = getTermCoords(clientX, clientY);
      if (coords) {
        isDraggingOnTerminal.current = true;
        selectionStartRef.current = { col: coords.col, row: coords.row };
        terminalComponentRef.current?.clearSelection();
      }
    };

    const handlePointerMove = (clientX, clientY) => {
      if (contextMenu) return;

      const coords = getTermCoords(clientX, clientY);

      if (coords) {
        const link = terminalComponentRef.current?.getLinkAt(
          coords.col,
          coords.row,
        );
        if (link) {
          document.body.classList.add("force-pointer");
          document.body.classList.remove("force-text");
          hoveredLinkRef.current = link;
        } else {
          document.body.classList.remove("force-pointer");
          document.body.classList.add("force-text");
          hoveredLinkRef.current = null;
        }
      } else {
        document.body.classList.remove("force-pointer");
        document.body.classList.remove("force-text");
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

    const handlePointerUp = (clientX, clientY) => {
      const isClick =
        selectionStartRef.current &&
        getTermCoords(clientX, clientY)?.col === selectionStartRef.current.col &&
        getTermCoords(clientX, clientY)?.row === selectionStartRef.current.row;

      if (isClick && hoveredLinkRef.current) {
        window.open(hoveredLinkRef.current, "_blank", "noopener,noreferrer");
      }

      isDraggingOnTerminal.current = false;
      selectionStartRef.current = null;
    };

    const onMouseDown = (e) => handlePointerDown(e.clientX, e.clientY, e.button, e.detail);
    const onMouseMove = (e) => handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = (e) => handlePointerUp(e.clientX, e.clientY);

    const onTouchStart = (e) => {
      if (e.touches.length > 0) {
        handlePointerDown(e.touches[0].clientX, e.touches[0].clientY, 0, 1);
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = (e) => {
      if (e.changedTouches.length > 0) {
        handlePointerUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    };

    const mount = mountRef.current;
    mount.addEventListener("mousedown", onMouseDown);
    mount.addEventListener("mousemove", onMouseMove);
    mount.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("touchstart", onTouchStart, { passive: true });
    mount.addEventListener("touchmove", onTouchMove, { passive: true });
    mount.addEventListener("touchend", onTouchEnd, { passive: true });
    mount.addEventListener("contextmenu", handleContextMenu);

    return () => {
      mount.removeEventListener("mousedown", onMouseDown);
      mount.removeEventListener("mousemove", onMouseMove);
      mount.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("touchstart", onTouchStart);
      mount.removeEventListener("touchmove", onTouchMove);
      mount.removeEventListener("touchend", onTouchEnd);
      mount.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [contextMenu]);

  // --- Data Initialization ---
  useEffect(() => {
    let isCancelled = false;

    const fetchAndMergeGitHubRepos = async (existingProjects) => {
      try {
        const res = await fetch(
          "https://api.github.com/users/MatthewNader2/repos?per_page=100&sort=updated",
          { headers: { Accept: "application/vnd.github.v3+json" } },
        );
        if (!res.ok) return existingProjects;
        const repos = await res.json();
        if (!Array.isArray(repos)) return existingProjects;

        const existingNames = new Set(
          existingProjects.map((p) => {
            const link = p.github || "";
            const m = link.match(/github\.com\/[^/]+\/([^/.]+)/i);
            return m ? m[1].toLowerCase().replace(/[-_.]/g, "") : "";
          }).filter(Boolean),
        );

        const merged = [...existingProjects];

        for (const repo of repos) {
          if (repo.fork && repo.stargazers_count === 0) continue;
          const normName = repo.name.toLowerCase().replace(/[-_.]/g, "");
          if (!existingNames.has(normName)) {
            existingNames.add(normName);
            const formattedTitle = repo.name
              .replace(/[-_]/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
            const lang = repo.language || "Software";
            const stars =
              repo.stargazers_count > 0 ? ` | ${repo.stargazers_count} ★` : "";
            const subtitle = `${lang}${stars}`;
            const desc =
              repo.description || `Open-source ${lang} project by Matthew Nader.`;

            merged.push({
              title: `\x1b[1;32m${formattedTitle}\x1b[0m`,
              subtitle: subtitle,
              description: wrapText(desc, TERMINAL_COLS - 6, "      "),
              github: repo.html_url,
            });
          }
        }
        return merged;
      } catch (err) {
        console.warn("GitHub live sync skipped:", err);
        return existingProjects;
      }
    };

    const initialize = async () => {
      try {
        // 1. Load WASM Module
        const WasmModule = await import("./wasm/engine.js");
        const engine = await WasmModule.default();
        const processCommand = engine.cwrap("process_command", "string", [
          "string",
          "string",
        ]);
        if (isCancelled) return;
        wasmEngineRef.current = { processCommand };

        // 2. Start Boot Sequence (Visuals)
        const bootPromise = runBootSequence(terminalComponentRef.current);

        // 3. Fetch Data with Fallback
        let data = {};
        let iconMap = { ...FALLBACK_ICONS };

        try {
          const iconsSnap = await getDocs(collection(db, "skill_icons"));
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

          const [
            projectsSnap,
            experienceSnap,
            educationSnap,
            awardsSnap,
            skillsSnap,
            personalInfoSnap,
          ] = await Promise.all([
            getDocs(collection(db, "projects")),
            getDocs(collection(db, "experience")),
            getDocs(collection(db, "education")),
            getDocs(collection(db, "awards")),
            getDocs(collection(db, "skills")),
            getDocs(collection(db, "personal_info")),
          ]);

          const info = !personalInfoSnap.empty
            ? personalInfoSnap.docs[0].data()
            : {};

          if (info.profile_picture_url) {
            ASCII_CACHE.profile = await generateAsciiArt(
              info.profile_picture_url,
              70,
            );
          }

          const formatLink = (link) => {
            if (!link || link === "N/A") return "N/A";
            const clean = link.replace(/^https?:\/\//, "");
            return `https://${clean}`;
          };

          const aboutDesc = wrapText(
            info.description || FALLBACK_PORTFOLIO_DATA.about.content,
            TERMINAL_COLS,
          );
          data["about"] = {
            content: `[[PROFILE_ART]]\nNAME: ${info.name || "Matthew Nader"}\n\n${aboutDesc}`,
          };

          data["contact"] = {
            email: info.email || FALLBACK_PORTFOLIO_DATA.contact.email,
            linkedin: formatLink(info.linkedin) || FALLBACK_PORTFOLIO_DATA.contact.linkedin,
            github_profile: formatLink(info.github) || FALLBACK_PORTFOLIO_DATA.contact.github_profile,
          };

          const eduDoc = !educationSnap.empty ? educationSnap.docs[0].data() : {};
          data["education"] = {
            degree: eduDoc.degree || FALLBACK_PORTFOLIO_DATA.education.degree,
            institution: eduDoc.institution || FALLBACK_PORTFOLIO_DATA.education.institution,
            graduation_date: eduDoc.graduation_date || FALLBACK_PORTFOLIO_DATA.education.graduation_date,
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
            const val = skillsRaw[key] || FALLBACK_PORTFOLIO_DATA.skills[key] || [];
            let items = [];
            if (val && typeof val === "object" && !Array.isArray(val)) {
              items = Object.values(val);
            } else if (Array.isArray(val)) {
              items = val;
            }

            const itemsFormatted = await Promise.all(
              items.map(async (item) => {
                const lowerName = String(item).toLowerCase().trim();
                const iconKey = Object.keys(iconMap).find(
                  (k) =>
                    lowerName === k ||
                    lowerName.includes(k) ||
                    k.includes(lowerName),
                );
                const iconUrl = iconKey ? iconMap[iconKey] : null;

                if (iconUrl) {
                  const ascii = await generateAsciiArt(iconUrl, 24);
                  const placeholder = `[[ICON:${lowerName}]]`;
                  ASCII_CACHE.icons[lowerName] = `\n${ascii}\n`;
                  return `${placeholder}\n   >> \x1b[1;32m${item}\x1b[0m`;
                }
                return `   >> \x1b[1;32m${item}\x1b[0m`;
              }),
            );

            formattedSkills[key] =
              itemsFormatted.length > 0 ? itemsFormatted : ["  N/A"];
          }
          data["skills"] = formattedSkills;

          const initialProjects = !projectsSnap.empty
            ? projectsSnap.docs.map((doc) => {
                const d = doc.data();
                return {
                  title: `\x1b[1;32m${d.title || "Untitled"}\x1b[0m`,
                  subtitle: d.subtitle || "",
                  description: wrapText(d.description || "", TERMINAL_COLS - 6, "      "),
                  github: formatLink(d.github),
                };
              })
            : FALLBACK_PORTFOLIO_DATA.projects.map((p) => ({
                title: `\x1b[1;32m${p.title}\x1b[0m`,
                subtitle: p.subtitle,
                description: wrapText(p.description, TERMINAL_COLS - 6, "      "),
                github: p.github,
              }));

          data["projects"] = await fetchAndMergeGitHubRepos(initialProjects);

          data["experience"] = !experienceSnap.empty
            ? experienceSnap.docs.map((doc) => {
                const d = doc.data();
                let descArray = Array.isArray(d.description)
                  ? d.description
                  : [d.description || ""];
                descArray = descArray.filter((l) => l && l.trim().length > 0);
                descArray = descArray.map((l) => wrapText(l, TERMINAL_COLS - 6, "    "));
                return {
                  title: `\x1b[1;32m${d.title || "N/A"}\x1b[0m`,
                  company: `\x1b[1;37m${d.company || "N/A"}\x1b[0m`,
                  duration: `\x1b[36m${d.duration || "N/A"}\x1b[0m`,
                  description: descArray,
                };
              })
            : FALLBACK_PORTFOLIO_DATA.experience.map((e) => ({
                title: `\x1b[1;32m${e.title}\x1b[0m`,
                company: `\x1b[1;37m${e.company}\x1b[0m`,
                duration: `\x1b[36m${e.duration}\x1b[0m`,
                description: e.description.map((l) => wrapText(l, TERMINAL_COLS - 6, "    ")),
              }));

          data["awards"] = !awardsSnap.empty
            ? awardsSnap.docs.map((doc) => {
                const d = doc.data();
                return {
                  award: d.award || "N/A",
                  event: d.event || "N/A",
                  date: d.date || "N/A",
                };
              })
            : FALLBACK_PORTFOLIO_DATA.awards;
        } catch (dbErr) {
          console.warn("Firestore unreachable, using bundled fallback portfolio data:", dbErr);
          const fallbackProjects = FALLBACK_PORTFOLIO_DATA.projects.map((p) => ({
            title: `\x1b[1;32m${p.title}\x1b[0m`,
            subtitle: p.subtitle,
            description: wrapText(p.description, TERMINAL_COLS - 6, "      "),
            github: p.github,
          }));
          const dynamicProjects = await fetchAndMergeGitHubRepos(fallbackProjects);

          data = {
            about: { content: FALLBACK_PORTFOLIO_DATA.about.content },
            contact: FALLBACK_PORTFOLIO_DATA.contact,
            education: FALLBACK_PORTFOLIO_DATA.education,
            skills: {
              languages: FALLBACK_PORTFOLIO_DATA.skills.languages.map((s) => `   >> \x1b[1;32m${s}\x1b[0m`),
              frameworks_libraries: FALLBACK_PORTFOLIO_DATA.skills.frameworks_libraries.map((s) => `   >> \x1b[1;32m${s}\x1b[0m`),
              tools_platforms: FALLBACK_PORTFOLIO_DATA.skills.tools_platforms.map((s) => `   >> \x1b[1;32m${s}\x1b[0m`),
              concepts: FALLBACK_PORTFOLIO_DATA.skills.concepts.map((s) => `   >> \x1b[1;32m${s}\x1b[0m`),
            },
            projects: dynamicProjects,
            experience: FALLBACK_PORTFOLIO_DATA.experience.map((e) => ({
              title: `\x1b[1;32m${e.title}\x1b[0m`,
              company: `\x1b[1;37m${e.company}\x1b[0m`,
              duration: `\x1b[36m${e.duration}\x1b[0m`,
              description: e.description.map((l) => wrapText(l, TERMINAL_COLS - 6, "    ")),
            })),
            awards: FALLBACK_PORTFOLIO_DATA.awards,
          };
        }

        portfolioDataRef.current = JSON.stringify(data);
        await bootPromise;

        if (!isCancelled) {
          isBootingRef.current = false;
          bootFinishedRef.current = true;
          setIsBooting(false);
        }
      } catch (error) {
        console.error("Initialization error:", error);
        terminalComponentRef.current?.write(
          `\r\nSystem ready (offline fallback mode).\r\n`,
        );
        terminalComponentRef.current?.prompt();
        isBootingRef.current = false;
        bootFinishedRef.current = true;
        setIsBooting(false);
      }
    };

    const timer = setTimeout(initialize, 100);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // --- 3D Render Loop ---
  useEffect(() => {
    if (!mountRef.current || !terminalElRef.current) return;

    const mount = mountRef.current;
    let raf = null;
    let isDisposed = false;

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

    const scene = new THREE.Scene();
    const cssScene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );

    // Camera Transition Config
    const startCamPos = new THREE.Vector3(-0.012, 0.19, 0.33);
    const startLookAt = new THREE.Vector3(-0.012, 0.079, -0.485);
    const endCamPos = new THREE.Vector3(0, 0.1, 0.7);
    const endLookAt = new THREE.Vector3(0, 0, 0);

    camera.position.copy(startCamPos);
    camera.lookAt(startLookAt);

    const webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(backgroundUrl, (t) => {
      if (isDisposed) {
        t.dispose();
        return;
      }
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

    // Dust Particles
    const particleCount = 400;
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

    // Loaders
    const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setKTX2Loader(ktx2Loader);
    ktx2Loader.detectSupport(webglRenderer);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    const RASTER_SCALE = 0.5;

    // --- 3D Helper Functions (Occlusion Logic) ---
    function worldToScreenXY(vWorld, cam, canvasRect) {
      const ndc = vWorld.clone().project(cam);
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

    function contourToClipPathPercent(contour, rectLeft, rectTop, rectW, rectH) {
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
      const canvasW = Math.max(16, Math.floor(window.innerWidth * RASTER_SCALE));
      const canvasH = Math.max(16, Math.floor(window.innerHeight * RASTER_SCALE));
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
      if (isDisposed) return;
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

      function updateTerminalTransform() {
        const termW = 1024,
          termH = 768;
        if (!screenMesh || !screenMesh.geometry) return;

        screenMesh.updateWorldMatrix(true, false);
        const screenBox = new THREE.Box3().setFromObject(screenMesh);
        const basePosition = screenBox.getCenter(new THREE.Vector3());
        const baseQuaternion = screenMesh.getWorldQuaternion(new THREE.Quaternion());
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

      // Initial transform calculation once (not on every frame)
      updateTerminalTransform();

      rebuildClipPath = () => {
        const terminalDiv = terminalElRef.current;
        if (!terminalDiv) return;
        const clipPath = buildClipPathFromMesh(clipMesh);
        if (clipPath) {
          terminalDiv.style.clipPath = clipPath;
          terminalDiv.style.webkitClipPath = clipPath;
        }
      };

      let transitionProgress = 0;
      let transitionDone = false;
      const transitionSpeed = 0.015;
      const currentLookAt = new THREE.Vector3().copy(startLookAt);

      function animate() {
        if (isDisposed) return;
        raf = requestAnimationFrame(animate);

        // Smooth Camera Transition after Boot
        if (bootFinishedRef.current && transitionProgress < 1) {
          transitionProgress += transitionSpeed;
          if (transitionProgress >= 1) {
            transitionProgress = 1;
            transitionDone = true;
            // Update occlusion clip path for final camera position
            rebuildClipPath();
          }
          const t = 1 - Math.pow(1 - transitionProgress, 3);
          camera.position.lerpVectors(startCamPos, endCamPos, t);
          currentLookAt.lerpVectors(startLookAt, endLookAt, t);
          camera.lookAt(currentLookAt);
        } else if (transitionDone) {
          camera.lookAt(endLookAt);
        }

        // Sync Dust Particles with positive scale
        const curSettings = settingsRef.current;
        particleMesh.visible = curSettings.particles;

        if (curSettings.particles) {
          particlesData.forEach((particle, i) => {
            let { speed, x, y, z } = particle;
            const t = (particle.time += speed);
            dummy.position.set(
              x + Math.cos(t) + Math.sin(t) / 10,
              y + Math.sin(t) + Math.cos(t * 2) / 10,
              z + Math.cos(t) + Math.sin(t * 3) / 10,
            );
            const s = 0.3 + 0.7 * Math.abs(Math.cos(t));
            dummy.scale.set(s, s, s);
            dummy.rotation.set(s * 5, s * 5, s * 5);
            dummy.updateMatrix();
            particleMesh.setMatrixAt(i, dummy.matrix);
          });
          particleMesh.instanceMatrix.needsUpdate = true;
        }

        webglRenderer.render(scene, camera);
        cssRenderer.render(cssScene, camera);
      }

      onWindowResize();
      animate();
    });

    return () => {
      isDisposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onWindowResize);
      if (resizeTimer) clearTimeout(resizeTimer);

      ktx2Loader.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      particleMesh.dispose();
      webglRenderer.dispose();

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      if (scene.background && scene.background.dispose) {
        scene.background.dispose();
      }

      while (mount.firstChild) mount.removeChild(mount.firstChild);
    };
  }, []);

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
      {/* UI Layer */}
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
        {/* Settings Button */}
        <div
          role="button"
          aria-label="System configuration"
          tabIndex={isBooting ? -1 : 0}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            color: "#00ff00",
            cursor: "pointer",
            opacity: 0.7,
            transition: "opacity 0.2s",
            pointerEvents: "auto",
            display: isBooting ? "none" : "block",
            outline: "none",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}
          onClick={() => setShowSettings(!showSettings)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setShowSettings((s) => !s);
              e.preventDefault();
            }
          }}
        >
          <GearIcon />
        </div>

        {/* Settings Menu */}
        {showSettings && (
          <div
            role="dialog"
            aria-label="System Configuration Menu"
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
                role="switch"
                aria-checked={settings.particles}
                aria-label="Toggle Dust Effects"
                tabIndex={0}
                onClick={() =>
                  setSettings((s) => ({ ...s, particles: !s.particles }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSettings((s) => ({ ...s, particles: !s.particles }));
                    e.preventDefault();
                  }
                }}
                style={{
                  width: "30px",
                  height: "15px",
                  border: "1px solid #00ff00",
                  cursor: "pointer",
                  position: "relative",
                  background: settings.particles
                    ? "rgba(0,255,0,0.2)"
                    : "transparent",
                  outline: "none",
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
                role="switch"
                aria-checked={settings.glitch}
                aria-label="Toggle CRT Glitch Effects"
                tabIndex={0}
                onClick={() =>
                  setSettings((s) => ({ ...s, glitch: !s.glitch }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSettings((s) => ({ ...s, glitch: !s.glitch }));
                    e.preventDefault();
                  }
                }}
                style={{
                  width: "30px",
                  height: "15px",
                  border: "1px solid #00ff00",
                  cursor: "pointer",
                  position: "relative",
                  background: settings.glitch
                    ? "rgba(0,255,0,0.2)"
                    : "transparent",
                  outline: "none",
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

        {/* Context Menu */}
        {contextMenu &&
          createPortal(
            <div
              role="menu"
              aria-label="Terminal Context Menu"
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
                role="menuitem"
                tabIndex={0}
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
                role="menuitem"
                tabIndex={0}
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

      {/* Terminal Container */}
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
        <TerminalComponent
          ref={terminalComponentRef}
          onCommand={handleTerminalCommand}
        />
      </div>
    </div>
  );
}
