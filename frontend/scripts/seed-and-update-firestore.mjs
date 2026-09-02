#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const configPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
if (!fs.existsSync(configPath)) {
  console.error('Firebase CLI config not found at', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const projectId = 'portfolio-3a194';

if (!token) {
  console.error('No access token found in firebase-tools.json');
  process.exit(1);
}

function encodeValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = encodeValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function encodeDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = encodeValue(v);
  }
  return { fields };
}

async function writeDoc(collection, docId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const body = JSON.stringify(encodeDoc(data));
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`\x1b[1;31m[Error]\x1b[0m Failed to update ${collection}/${docId}:`, res.status, errText);
    return false;
  }
  console.log(`\x1b[1;32m[Updated]\x1b[0m ${collection}/\x1b[1;36m${docId}\x1b[0m`);
  return true;
}

async function main() {
  console.log(`\x1b[1;34m[Firestore Updater]\x1b[0m Updating Firestore project \x1b[1;32m${projectId}\x1b[0m...`);

  // 1. Personal Info
  await writeDoc('personal_info', 'main', {
    name: 'Matthew Nader Fawzy',
    email: 'matthewnader2@gmail.com',
    github: 'https://github.com/MatthewNader2',
    linkedin: 'https://www.linkedin.com/in/matthew-nader-11b57b1a5/',
    wuzzuf: 'https://wuzzuf.net/me/Matthew-Nader-6464401c16',
    profile_picture_url: 'https://pub-817c933b19764d5fa88e1ff47c24f00e.r2.dev/Profile_Picture.jpeg',
    description: 'Communication and Information Engineer specializing in computer vision, artificial intelligence, robotics, low-level systems (C/C++, WebAssembly), and software engineering. Proven track record leading robotics engineering teams and building autonomous systems.',
  });

  // 2. Education
  await writeDoc('education', 'zewail_city', {
    institution: 'University of Science and Technology in Zewail City',
    degree: 'B.S. in Computer Science & Engineering',
    graduation_date: 'June 2027',
  });

  // 3. Awards (with typo fixes)
  await writeDoc('awards', 'mate_rov_regional_2021', {
    award: '1st Place',
    event: 'MATE ROV Regional Competition',
    date: 'June 2021',
  });
  await writeDoc('awards', 'ml_challenge_2021', {
    award: '2nd Place',
    event: 'MATE Machine Learning Computer Coding Challenge',
    date: 'July 2021',
  });
  await writeDoc('awards', 'mate_rov_intl_2021', {
    award: '6th Place',
    event: 'MATE ROV International Championship',
    date: 'July 2021',
  });
  await writeDoc('awards', 'mate_rov_regional_2022', {
    award: '3rd Place',
    event: 'MATE ROV Regional Competition',
    date: 'June 2022',
  });

  // 4. Skills
  await writeDoc('skills', 'main', {
    languages: [
      'C',
      'C++',
      'Python',
      'Rust',
      'JavaScript',
      'TypeScript',
      'SQL',
      'MATLAB',
      'Bash',
    ],
    frameworks_libraries: [
      'React',
      'Three.js',
      'WebAssembly (WASM)',
      'PyTorch',
      'OpenCV',
      'YOLO (v5 - v11)',
      'ONNX Runtime',
      'Flask',
      'TailwindCSS',
    ],
    tools_platforms: [
      'Linux',
      'Git / GitHub',
      'Docker',
      'Firebase / Firestore',
      'Arduino',
      'PIC Microcontrollers',
      'Vite',
    ],
    concepts: [
      'Computer Vision & YOLO Object Detection',
      'Machine Learning & Deep Learning',
      'Embedded Systems (HAL / MCAL)',
      'Operating Systems & Process Scheduling',
      'Compiler Construction (Flex / Bison)',
      '3D Graphics & Raycasting Math',
      'Object-Oriented Programming (OOP)',
    ],
  });

  // 5. Skill Icons
  await writeDoc('skill_icons', 'main', {
    c: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/c/c-original.svg',
    'c++': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg',
    python: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
    rust: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg',
    javascript: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
    typescript: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
    react: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
    'three.js': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/threejs/threejs-original.svg',
    opencv: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/opencv/opencv-original.svg',
    pytorch: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg',
    docker: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg',
    git: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg',
    linux: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg',
    firebase: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg',
    flask: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg',
    arduino: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/arduino/arduino-original.svg',
    matlab: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/matlab/matlab-original.svg',
    bash: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bash/bash-original.svg',
    ros: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ros/ros-original.svg',
    cmake: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cmake/cmake-original.svg',
  });

  // 6. Experience
  await writeDoc('experience', 'cv_engineer_robotech', {
    title: 'Computer Vision Engineer',
    company: 'Robo-Tech',
    duration: 'July 2020 - June 2022',
    description: [
      'Architected complex image processing and deep learning pipelines for autonomous underwater systems.',
      'Utilized YOLO, Detectron2, and OpenCV for real-time feature extraction, object detection, and instance segmentation.',
      'Applied custom image stitching and homography to ensure high-fidelity spatial analysis.',
    ],
  });
  await writeDoc('experience', 'head_of_eng_robotechs', {
    title: 'Head of Engineering Department',
    company: 'RoboTechs Zewail City Club',
    duration: 'October 2024 - June 2025',
    description: [
      'Led the engineering department across mechanical, electrical, and software sub-teams.',
      'Developed and executed comprehensive robotics training programs for over 50 club members.',
      'Organized hands-on technical workshops, achieving a 25% increase in successful competition project completions.',
    ],
  });
  await writeDoc('experience', 'jta_zewail', {
    title: 'Junior Teaching Assistant (JTA)',
    company: 'University of Science and Technology in Zewail City',
    duration: 'October 2024 - January 2025',
    description: [
      'Served as JTA in Digital Logic and Computer Architecture for Computer Science freshmen.',
      'Supported and mentored over 100 students throughout laboratory experiments and architecture simulations.',
      'Explained microprocessor datapath design, instruction set architectures, and logic circuit optimization.',
    ],
  });
  await writeDoc('experience', 'robotics_instructor_mp', {
    title: 'Robotics & Embedded Systems Instructor',
    company: 'M&P Robotics / MakerSpace',
    duration: 'January 2019 - October 2024',
    description: [
      'Created and led comprehensive robotics training programs in Arduino, embedded systems, and C/C++.',
      'Trained over 200 students in core robotics programs and provided technical instruction to 500+ students.',
      'Mentored high school robotics teams in Mega Sumo Competitions, winning 3rd place.',
    ],
  });

  // 7. Projects (Enriched with Clean URLs and New Projects)
  const projects = [
    {
      id: 'portfolio_3d_wasm',
      title: 'Interactive 3D CRT Terminal Portfolio',
      subtitle: 'React, Three.js, C, WebAssembly | 4 ★',
      description: 'A retro CRT monitor terminal portfolio simulating a Linux environment. Features a custom C compiler compiled to WASM with real-time 3D screen occlusion and dynamic GitHub sync.',
      github: 'https://github.com/MatthewNader2/Portfolio',
      technologies: ['React', 'Three.js', 'WebAssembly', 'C', 'Flex/Bison', 'CSS3D', 'TailwindCSS'],
    },
    {
      id: 'slowroads_agent',
      title: 'Autonomous Self-Driving Agent',
      subtitle: 'Python, OpenCV, DBSCAN, RANSAC, PID | 5 ★',
      description: 'Architected a full-stack autonomous agent in Python to navigate slowroads.io using real-time computer vision. Features a perception pipeline (OpenCV, DBSCAN, RANSAC) achieving 99.97% accuracy, and a PID controller with genetic algorithm tuning.',
      github: 'https://github.com/MatthewNader2/SlowRoads_SelfDriving_Agent',
      technologies: ['Python', 'OpenCV', 'Flask', 'PID Control', 'DBSCAN', 'RANSAC', 'Genetic Algorithms'],
    },
    {
      id: 'zc_ocw_platform',
      title: 'Zewail City OpenCourseWare (ZC-OCW)',
      subtitle: 'JavaScript, React, Full-Stack Web',
      description: 'Open educational courseware platform for Zewail City students featuring centralized course archives, lecture materials, assignments, and peer learning resources.',
      github: 'https://github.com/MatthewNader2/zc-ocw',
      technologies: ['JavaScript', 'React', 'Node.js', 'Web Development'],
    },
    {
      id: 'os_scheduler_sim',
      title: 'CPU Process Scheduler Simulator',
      subtitle: 'C, Algorithms, Operating Systems | 1 ★',
      description: 'Implemented a C simulation to evaluate and compare core CPU scheduling algorithms (HPF, SJF, Priority, Round Robin). Designed with simulated clock synchronization and inter-process communication (IPC).',
      github: 'https://github.com/MatthewNader2/OS_Scheduler',
      technologies: ['C', 'Operating Systems', 'RTOS', 'IPC', 'Linux', 'Bash'],
    },
    {
      id: 'sudoku_rs_engine',
      title: 'Sudoku Solver & Engine',
      subtitle: 'Rust, Systems Programming',
      description: 'Blazing-fast Sudoku puzzle generator and solver written in Rust utilizing bit manipulation, backtracking search, and constraint propagation.',
      github: 'https://github.com/MatthewNader2/sudoku-rs',
      technologies: ['Rust', 'Algorithms', 'Bit Manipulation', 'Constraint Satisfaction'],
    },
    {
      id: 'solar_system_sim',
      title: 'Planetary Orrery 3D Simulation',
      subtitle: 'JavaScript, Three.js / WebGL, Physics',
      description: 'Developed an interactive 3D solar system simulation using Three.js and WebGL. Implemented realistic orbital mechanics, planetary trajectories, and interactive camera controls.',
      github: 'https://github.com/MatthewNader2/Orrey_Sim',
      technologies: ['JavaScript', 'Three.js', 'WebGL', 'Orbital Mechanics'],
    },
    {
      id: 'coral_reef_monitoring',
      title: 'Coral Reef Health Monitoring AI',
      subtitle: 'Python, Deep Learning, PyTorch, OpenCV',
      description: 'Created an automated system to track coral reef health over time by analyzing temporal image sets. Implemented SIFT-based feature matching and homography to align images and detect bleaching.',
      github: 'https://github.com/MatthewNader2/Coral-Reef-Health-Monitoring',
      technologies: ['Python', 'OpenCV', 'SIFT', 'Image Processing', 'Homography'],
    },
    {
      id: 'underwater-trash-detection',
      title: 'Underwater Marine Debris Classifier',
      subtitle: 'Python, YOLO, Computer Vision, ROV',
      description: 'Engineered an AI-powered system to detect and classify submerged trash from underwater ROV imagery. Contributes to marine conservation through automated debris mapping.',
      github: 'https://github.com/MatthewNader2/Underwater-Trash-Detection',
      technologies: ['Python', 'YOLO', 'OpenCV', 'Computer Vision', 'Deep Learning'],
    },
    {
      id: 'crab_shell_estimation',
      title: 'Crab Shell Biometric Width Estimation',
      subtitle: 'Python, Detectron2, Morphometrics',
      description: 'Engineered a CV system to estimate crab shell widths from ROV footage. Utilized Detectron2 and PyTorch for instance segmentation and calculated a pixel-to-centimeter ratio for real-world measurements.',
      github: 'https://github.com/MatthewNader2/Crab-Shell-Width-Estimation',
      technologies: ['Python', 'PyTorch', 'Detectron2', 'Computer Vision', 'Instance Segmentation'],
    },
    {
      id: 'fish_detection_gui',
      title: 'Aquaculture Fish Detection & Counter GUI',
      subtitle: 'Python, PyQt5, YOLO, OpenCV',
      description: 'Built a user-friendly desktop application with PyQt5 for real-time fish detection from local files, video feeds, or live streams. Integrated a lightweight YOLO model for efficient inference.',
      github: 'https://github.com/MatthewNader2/Fish-Detection-GUI',
      technologies: ['Python', 'PyQt5', 'YOLO', 'OpenCV', 'Machine Learning'],
    },
    {
      id: 'fish-counting-system',
      title: 'Aquaculture Automated Fish Counter',
      subtitle: 'Python, OpenCV, Computer Vision',
      description: 'Developed a computer vision pipeline to automate counting fish in underwater videos, aiding in aquaculture population management without manual intervention.',
      github: 'https://github.com/MatthewNader2/fish-counting',
      technologies: ['Python', 'OpenCV', 'Computer Vision', 'Machine Learning', 'Image Processing'],
    },
    {
      id: 'mort-detection-system',
      title: 'Aquaculture Health & Mortality Detection',
      subtitle: 'Python, YOLO, PyTorch, Deep Learning',
      description: 'Developed a specialized deep learning model to automate mortality detection in aquaculture pens. Provides early warnings for fish health management using custom-trained YOLO models on underwater feeds.',
      github: 'https://github.com/MatthewNader2/Mort-Detection',
      technologies: ['Python', 'YOLO', 'PyTorch', 'OpenCV', 'Deep Learning', 'Aquaculture Tech'],
    },
    {
      id: 'es_course_labs',
      title: 'Embedded Systems PIC Drivers & HAL',
      subtitle: 'C, Microcontrollers, MCAL / HAL',
      description: 'Embedded Systems modular drivers for PIC microcontrollers, featuring structured HAL and MCAL abstraction layers and peripheral interfacing.',
      github: 'https://github.com/MatthewNader2/ES_Course_Labs',
      technologies: ['C', 'Embedded Systems', 'PIC Microcontrollers', 'HAL/MCAL'],
    },
    {
      id: 'visionscreen_engine',
      title: 'VisionScreen Visual Analytics Engine',
      subtitle: 'Python, Computer Vision',
      description: 'Real-time screen capture analysis framework utilizing optical character recognition and visual template matching for automated workflow telemetry.',
      github: 'https://github.com/MatthewNader2/VisionScreen',
      technologies: ['Python', 'Computer Vision', 'OCR', 'Image Processing'],
    },
    {
      id: 'ruko_learning_world',
      title: 'Ruko Learning World',
      subtitle: 'TypeScript, Web Applications',
      description: 'Interactive educational web application designed for gamified learning, algorithmic visualization, and conceptual mastery.',
      github: 'https://github.com/MatthewNader2/ruko-learning-world',
      technologies: ['TypeScript', 'Web Development', 'Interactive UI'],
    },
  ];

  for (const p of projects) {
    const { id, ...data } = p;
    await writeDoc('projects', id, data);
  }

  console.log('\n\x1b[1;32m[Success]\x1b[0m All Firestore documents have been successfully seeded and enriched!\n');
}

main();
