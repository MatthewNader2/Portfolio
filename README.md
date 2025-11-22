# Interactive 3D Terminal Portfolio

**🔴 Live Demo:** [https://matthew-nader.web.app](https://matthew-nader.web.app)

A high-fidelity, interactive portfolio website that simulates a retro CRT monitor running a custom Linux-like environment. This project bridges the gap between high-performance 3D graphics (Three.js), DOM-based interactivity (CSS3D), and low-level systems programming (C/WASM).

## 🚀 Key Features

*   **Hybrid Rendering Engine:** Combines WebGL for the 3D environment and CSS3D for a fully selectable, interactive DOM-based terminal.
*   **Custom C Compiler:** A bespoke command interpreter written in C, compiled to WebAssembly (WASM) for high-performance command parsing in the browser.
*   **Real-time Occlusion:** A custom algorithm that dynamically calculates the 2D projection of the 3D screen mesh to generate a CSS `clip-path`, allowing the HTML terminal to fit perfectly inside the curved 3D TV bezel.
*   **Retro Aesthetics:** CRT scanlines, screen curvature, glow effects, and a simulated Linux boot sequence.
*   **Dynamic Data:** Content fetched in real-time from Firebase Firestore.

---

## 🛠️ Architecture Overview

The application is split into two distinct layers that communicate via a bridge:

1.  **The Frontend (React/Three.js):** Handles the 3D scene, user input, and visual presentation.
2.  **The Engine (C/WASM):** Handles command logic, parsing, and data formatting.

```text
[ User Input (xterm.js) ] 
       ⬇
[ React Component ] ➡ [ Firebase Data (JSON) ]
       ⬇
[ WebAssembly Bridge ] ➡ [ C Engine (Flex/Bison) ]
       ⬇
[ Formatted Output ] ➡ [ Terminal Display ]
```

---

## 🎨 The Rendering System

This project solves a difficult problem in 3D web development: **How to display selectable, accessible HTML text inside a curved 3D object.**

### Dual-Renderer Setup
We use two synchronous renderers in `App.jsx`:
1.  **`WebGLRenderer`:** Renders the GLTF model (the TV), the background, lighting, and particle effects.
2.  **`CSS3DRenderer`:** Renders the HTML `<div>` containing the terminal. This applies 3D transforms (matrix math) to the DOM element to match the position and rotation of the TV screen.

### The "Clip Path" Occlusion Algorithm
Since the TV screen is curved and the HTML element is a flat rectangle, the corners of the HTML element would normally stick out of the TV frame. To fix this, we implemented a custom occlusion algorithm:

1.  **Mesh Projection:** We take the specific geometry of the TV screen (Mesh index 1) and project its 3D vertices onto the 2D screen space using the camera's projection matrix.
2.  **Rasterization:** These projected triangles are drawn onto an off-screen HTML Canvas to create a binary mask (black/white).
3.  **Contour Tracing:** We use the **Moore-Neighbor Tracing algorithm** to find the exact pixel boundary of the screen shape.
4.  **Simplification:** The **Ramer-Douglas-Peucker (RDP)** algorithm reduces the thousands of contour pixels into a lightweight set of polygon coordinates.
5.  **CSS Application:** These coordinates are converted to percentages and applied as a `clip-path: polygon(...)` to the terminal container.

**Result:** The HTML terminal appears to be physically inside the curved CRT monitor, while remaining fully interactive (selectable text, links).

---

## ⚙️ The Engine (Custom Compiler)

Instead of using simple JavaScript string splitting, this project implements a real compiler architecture to handle user commands.

### 1. The Stack
*   **Language:** C
*   **Lexer:** Flex (Fast Lexical Analyzer Generator)
*   **Parser:** Bison (GNU Parser Generator)
*   **Compilation:** Emscripten (compiles C to WASM)

### 2. How it Works
The engine is located in the `engine/src` directory.

*   **Lexer (`lexer.l`):** Breaks the raw input string (e.g., `cat projects`) into tokens (COMMAND, ARGUMENT, WHITESPACE).
*   **Parser (`parser.y`):** Defines the grammar rules. It understands that `cat` requires an argument, while `help` does not. It constructs the logic for what data to retrieve.
*   **Processing (`main.c`):**
    *   The engine receives the command string and the entire Portfolio Data (as a JSON string) from React.
    *   It uses `cJSON` to parse the portfolio data within the C environment.
    *   Based on the parsed command, it extracts the specific fields (e.g., Project Title, Description) and formats them with ANSI color codes.
    *   It returns the final formatted string to JavaScript.

### 3. WebAssembly Integration
We use **Emscripten** to compile the C code into `engine.wasm` and `engine.js`.
*   React loads the WASM module asynchronously on boot.
*   The function `process_command` is exposed via `cwrap`, allowing JavaScript to call C functions directly.

---

## 💻 The Terminal Interface

The terminal UI is built using **xterm.js** wrapped in a React component (`TerminalComponent.jsx`).

*   **Boot Sequence:** A simulated boot process (in `App.jsx`) mimics an Ubuntu startup, displaying package loading bars before handing control to the user.
*   **Input Handling:** Captures keystrokes, handles history (Up/Down arrows), and implements tab completion for commands and arguments.
*   **Mouse Interaction:**
    *   A Raycaster detects mouse position on the 3D plane.
    *   Coordinates are translated from 3D world space to the 2D terminal grid (Columns/Rows).
    *   Allows for hovering over links and selecting text within the 3D environment.

---

## 📂 Project Structure

```graphql
/
├── engine/                 # The C/WASM Compiler
│   └── src/
│       ├── lexer.l         # Tokenizer definitions
│       ├── parser.y        # Grammar rules
│       ├── main.c          # Command logic & JSON handling
│       └── Makefile        # Build script for Emscripten
│
├── frontend/               # The React Application
│   ├── public/             # Static assets (3D models, WASM files)
│   └── src/
│       ├── assets/         # Images/Textures
│       ├── components/     # React Components
│       │   └── TerminalComponent.jsx  # xterm.js wrapper
│       ├── wasm/           # Generated WASM glue code
│       ├── App.jsx         # Main 3D Scene & Logic
│       └── firebaseConfig.js
│
└── README.md
```

---

## 🚀 Setup & Installation

### Prerequisites
*   Node.js & npm
*   (Optional) Emscripten (only if you want to modify the C engine)

### Running the Frontend
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    cd frontend
    npm install
    ```
3.  Create a `firebaseConfig.js` in `frontend/src/` with your Firestore credentials.
4.  Start the development server:
    ```bash
    npm run dev
    ```

### Recompiling the Engine (Optional)
If you modify the C code in `engine/src`:
1.  Navigate to the engine directory:
    ```bash
    cd engine/src
    ```
2.  Run the make command (requires Emscripten `emcc` in your PATH):
    ```bash
    make
    ```
3.  This will automatically generate `engine.js` and `engine.wasm` and move them to the correct folders in the frontend.

---

## 📜 License

This project is open source. Feel free to use the architecture for your own portfolio, but please credit the original author.

**Author:** Matthew Nader
