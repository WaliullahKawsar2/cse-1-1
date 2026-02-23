# 🎓 Result Portal

A high-performance, aesthetically pleasing web application designed to visualize and analyze student academic results directly from Excel data. Featuring a modern **glassmorphism** aesthetic and real-time interactive analytics.

![Aesthetic Dashboard Preview](https://img.shields.io/badge/UI-Modern_Glassmorphism-emerald)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-7-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)

---

## ✨ Core Features

### 📊 Automated Excel Processing
Directly parses `result.xlsx` using the `xlsx` library. No database setup required—just drop your file and go.

### 🔍 Dynamic Field Detection
*   **Smart Identification**: Automatically detects student names, registration numbers, and key metrics like CGPA, GPA, or Total Marks.
*   **Subject Extraction**: Intelligently identifies subject-wise columns and their associated credits (supports patterns like `C++ (3.0)` or `Physics 3`).

### 📈 Interactive Analytics
*   **Performance Visualization**: Beautiful bar charts showing subject-wise scores with normalized progress bars.
*   **Class Distribution**: Real-time histogram charts showing score frequency across the entire batch.
*   **Global Statistics**: Instant summary of total records, class average, maximum, and minimum scores.

### ⚡ Premium Experience
*   **Real-time Search**: Search by name or registration number with instant filtering.
*   **Glassmorphism UI**: A dark-themed implementation using Tailwind CSS 4, featuring vibrant gradients, glassy panels, and smooth micro-animations.

---

## 🏗️ Technical Architecture

- **Core**: React 19 + Vite 7
- **Styling**: Tailwind CSS 4 (Vanilla CSS logic with Utility-first efficiency)
- **Data Engine**: `xlsx` for robust Excel parsing
- **Visualization**: `recharts` for responsive, animated data charts

---

## 📁 Project Structure

```text
├── src/
│   ├── App.jsx          # Main application logic & UI components
│   ├── index.css        # Global styles & Glassmorphism utilities
│   └── main.jsx         # Application entry point
├── result.xlsx          # Data source (your Excel file)
├── package.json         # Project dependencies
└── README.md            # Documentation
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed.

### 2. Installation
```bash
# Install dependencies
npm install
```

### 3. Setup Data
Replace the existing `result.xlsx` in the root directory with your own academic data.
*   Ensure the first row contains headers.
*   The portal will automatically find columns like "Name", "Reg", "GPA", etc.

### 4. Run Development Server
```bash
npm run dev
```

---

## 🎨 UI Highlights

*   **Header**: Features a live pulsating status indicator for your department.
*   **Student List**: Fast, scrollable table for record selection.
*   **Academic Profile**: A deep dive into individual performance with a dedicated "Student Profile" panel.
*   **Analytics Grid**: Responsive charts that adapt to any screen size.

---

## 🛠️ Customization
To change the University/Department name, edit the header section in `src/App.jsx`. The UI is fully responsive and supports different Excel column naming conventions automatically.

---
*Created with ❤️ for students and educators.*
