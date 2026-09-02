// Default fallback portfolio data when Firebase is unconfigured or offline
export const FALLBACK_PORTFOLIO_DATA = {
  about: {
    content: `NAME: Matthew Nader Fawzy
ROLE: Communication and Information Engineer | Computer Vision & Robotics
EDUCATION: University of Science and Technology at Zewail City (2027)

Passionate engineer specialized in high-performance computing, Computer Vision (YOLO/PyTorch/OpenCV), Embedded Systems, and 3D Web Graphics (Three.js/WebAssembly). Proven track record leading robotics engineering teams and building autonomous agents.`
  },
  contact: {
    email: "matthewnader2@gmail.com",
    linkedin: "https://www.linkedin.com/in/matthew-nader-11b57b1a5/",
    github_profile: "https://github.com/MatthewNader2",
    wuzzuf: "https://wuzzuf.net/me/Matthew-Nader-6464401c16"
  },
  education: {
    degree: "B.S. in Computer Science & Engineering",
    institution: "University of Science and Technology in Zewail City",
    graduation_date: "June 2027"
  },
  skills: {
    languages: [
      "C",
      "C++",
      "Python",
      "Rust",
      "JavaScript",
      "TypeScript",
      "SQL",
      "MATLAB",
      "Bash"
    ],
    frameworks_libraries: [
      "React",
      "Three.js",
      "WebAssembly (WASM)",
      "PyTorch",
      "OpenCV",
      "YOLO (v5 - v11)",
      "ONNX Runtime",
      "Flask",
      "TailwindCSS"
    ],
    tools_platforms: [
      "Linux",
      "Git / GitHub",
      "Docker",
      "Firebase / Firestore",
      "Arduino",
      "PIC Microcontrollers",
      "Vite"
    ],
    concepts: [
      "Computer Vision & YOLO Object Detection",
      "Machine Learning & Deep Learning",
      "Embedded Systems (HAL / MCAL)",
      "Operating Systems & Process Scheduling",
      "Compiler Construction (Flex / Bison)",
      "3D Graphics & Raycasting Math",
      "Object-Oriented Programming (OOP)"
    ]
  },
  projects: [
    {
      title: "Interactive 3D CRT Terminal Portfolio",
      subtitle: "React, Three.js, C, WebAssembly | 4 ★",
      description: "A retro CRT monitor terminal portfolio simulating a Linux environment. Features a custom C compiler compiled to WASM with real-time 3D screen occlusion and dynamic GitHub sync.",
      github: "https://github.com/MatthewNader2/Portfolio"
    },
    {
      title: "Autonomous Self-Driving Agent",
      subtitle: "Python, OpenCV, DBSCAN, RANSAC, PID | 5 ★",
      description: "An autonomous self-driving vehicle agent for slowroads.io using computer vision, lane boundary detection with DBSCAN and RANSAC, and a PID trajectory controller with Flask telemetry.",
      github: "https://github.com/MatthewNader2/SlowRoads_SelfDriving_Agent"
    },
    {
      title: "CPU Process Scheduler Simulator",
      subtitle: "C, Algorithms, Operating Systems | 1 ★",
      description: "Low-level simulation of Unix CPU scheduling algorithms (HPF, Round Robin, SRTN) evaluating process turnaround time, waiting time, CPU utilization, and inter-process communication.",
      github: "https://github.com/MatthewNader2/OS_Scheduler"
    },
    {
      title: "Zewail City OpenCourseWare (ZC-OCW)",
      subtitle: "JavaScript, React, Full-Stack Web",
      description: "Open educational courseware platform for Zewail City students featuring centralized course archives, lecture materials, assignments, and peer learning resources.",
      github: "https://github.com/MatthewNader2/zc-ocw"
    },
    {
      title: "Sudoku Solver & Engine",
      subtitle: "Rust, Systems Programming",
      description: "Blazing-fast Sudoku puzzle generator and solver written in Rust utilizing bit manipulation, backtracking search, and constraint propagation.",
      github: "https://github.com/MatthewNader2/sudoku-rs"
    },
    {
      title: "Planetary Orrery 3D Simulation",
      subtitle: "JavaScript, Three.js / WebGL, Physics",
      description: "Interactive 3D simulation of celestial planetary mechanics and orbital physics with real-time trajectory visualization and astronomical scaling.",
      github: "https://github.com/MatthewNader2/Orrey_Sim"
    },
    {
      title: "Coral Reef Health Monitoring AI",
      subtitle: "Python, Deep Learning, PyTorch, OpenCV",
      description: "Automated marine biology computer vision pipeline tracking coral reef health and bleaching over time by analyzing temporal underwater imagery.",
      github: "https://github.com/MatthewNader2/Coral-Reef-Health-Monitoring"
    },
    {
      title: "Underwater Marine Debris Classifier",
      subtitle: "Python, YOLO, Computer Vision, ROV",
      description: "AI-powered computer vision system to detect and classify submerged marine debris and plastics from underwater ROV video streams.",
      github: "https://github.com/MatthewNader2/Underwater-Trash-Detection"
    },
    {
      title: "Crab Shell Biometric Width Estimation",
      subtitle: "Python, Detectron2, Morphometrics",
      description: "Computer vision system estimating crab shell dimensions from underwater ROV footage using deep instance segmentation and geometric calibration.",
      github: "https://github.com/MatthewNader2/Crab-Shell-Width-Estimation"
    },
    {
      title: "Aquaculture Fish Detection & Counter GUI",
      subtitle: "Python, OpenCV, Tkinter/PyQt",
      description: "Real-time desktop application and computer vision pipeline for automated fish detection, tracking, and biomass density estimation in aquaculture tanks.",
      github: "https://github.com/MatthewNader2/Fish-Detection-GUI"
    },
    {
      title: "Aquaculture Health & Mortality Detection",
      subtitle: "Python, PyTorch, Deep Learning",
      description: "Specialized deep learning model monitoring aquaculture pens to detect early abnormal swimming behaviors and fish mortality in real time.",
      github: "https://github.com/MatthewNader2/Mort-Detection"
    },
    {
      title: "Embedded Systems PIC Drivers & HAL",
      subtitle: "C, Embedded Systems, Microcontrollers",
      description: "Structured hardware abstraction layer (HAL) and microcontroller abstraction layer (MCAL) modular drivers for PIC microcontrollers and peripheral interfacing.",
      github: "https://github.com/MatthewNader2/ES_Course_Labs"
    },
    {
      title: "VisionScreen Visual Analytics Engine",
      subtitle: "Python, Computer Vision",
      description: "Real-time screen capture analysis framework utilizing optical character recognition and visual template matching for automated workflow telemetry.",
      github: "https://github.com/MatthewNader2/VisionScreen"
    },
    {
      title: "Ruko Learning World",
      subtitle: "TypeScript, Web Applications",
      description: "Interactive educational web application designed for gamified learning, algorithmic visualization, and conceptual mastery.",
      github: "https://github.com/MatthewNader2/ruko-learning-world"
    }
  ],
  experience: [
    {
      title: "Computer Vision Engineer",
      company: "Robo-Tech",
      duration: "2021 - Present",
      description: [
        "Architected complex image processing and deep learning pipelines for underwater robotic systems.",
        "Implemented feature extraction, object detection, and visual tracking algorithms for autonomous navigation.",
        "Integrated edge AI models on embedded platforms for real-time video stream telemetry."
      ]
    },
    {
      title: "Head of Engineering Department",
      company: "RoboTechs Zewail City Club",
      duration: "2022 - 2024",
      description: [
        "Directed the engineering department across mechanical, electrical, and software sub-teams.",
        "Led project planning and technical execution for international robotics and ROV competitions.",
        "Mentored undergraduate engineers in systems engineering, C/C++, and hardware-in-the-loop testing."
      ]
    },
    {
      title: "Junior Teaching Assistant (JTA)",
      company: "University of Science and Technology in Zewail City",
      duration: "Fall 2023 - Spring 2024",
      description: [
        "JTA for Digital Logic and Computer Architecture for Computer Science freshmen.",
        "Conducted lab sessions, guided students on logic circuit simulation, and graded assignments.",
        "Explained microprocessor architectures, assembly instruction sets, and CPU datapath design."
      ]
    },
    {
      title: "Robotics & Embedded Systems Instructor",
      company: "MakerSpace",
      duration: "January 2019 - October 2024",
      description: [
        "Designed and delivered comprehensive robotics training programs in embedded systems, microcontrollers, and C/C++.",
        "Trained over 200+ students on sensor interfacing, motor controllers, and robotic autonomy."
      ]
    }
  ],
  awards: [
    {
      award: "1st Place",
      event: "MATE ROV Regional Competition",
      date: "June 2021"
    },
    {
      award: "2nd Place",
      event: "MATE Machine Learning Computer Coding Challenge",
      date: "July 2021"
    },
    {
      award: "6th Place",
      event: "MATE ROV International Championship",
      date: "July 2021"
    },
    {
      award: "3rd Place",
      event: "MATE ROV Regional Competition",
      date: "June 2022"
    }
  ]
};

