# 🎓 Result Portal - Academic Performance Visualizer

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance, aesthetically stunning web application designed to transform raw Excel academic data into interactive, visual dashboards. Built with a modern **Glassmorphism** design language and real-time analytics.

---

## ✨ Features

### 🚀 Instant Data Processing
- **Zero Configuration**: Simply replace `result.xlsx` in the root folder, and the application handles the rest.
- **Smart Parsing**: Automatically identifies headers like Student Name, Registration Number, and total scores.
- **Subject Intelligence**: Detects individual subject columns and extracts credit values dynamically.

### 🎨 Premium User Interface
- **Glassmorphism Aesthetic**: Beautiful frosted-glass panels with vibrant gradients and deep shadows.
- **Interactive Analytics**: 
  - **Individual Profiles**: Detailed breakdown of subject-wise performance.
  - **Class Distribution**: Batch-wide GPA/mark distribution histograms.
  - **Live Counters**: Real-time summary of total student count and class averages.

### 🔍 Advanced UX
- **Real-time Search**: Search through hundreds of records instantly by name or registration number.
- **Responsive Design**: Flawless experience across desktops, tablets, and mobile devices.
- **Soft Scrollbars**: Custom-themed scrollbars for a consistent theme experience.

---

## 🛠️ Technical Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 7](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) (Modern CSS utilities)
- **Charts**: [Recharts](https://recharts.org/) (D3-based React charts)
- **Data Parsing**: [XLSX (SheetJS)](https://sheetjs.com/)

---

## 📂 Project Structure

```text
├── src/
│   ├── App.jsx          # Core Logic: Data processing + Dashboard UI
│   ├── index.css        # Design System: Glassmorphism + Custom Utilities
│   └── main.jsx         # Application entry point
├── result.xlsx          # Data Source: Replace this with your own file
├── package.json         # Dependencies & Build Scripts
└── README.md            # You are here!
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### 2. Installation
```bash
git clone https://github.com/waliullahx82/cse-1-1-result.git
cd result-portal
npm install
```

### 3. Setup Your Data
1. Prepare an Excel file named `result.xlsx`.
2. Ensure the first row contains headers (e.g., `Name`, `Reg No`, `Physics`, `Math`).
3. Place the file in the project root directory.

### 4. Launch
```bash
# Start development server
npm run dev
```

---

## 📝 Customization

The portal is designed to be plug-and-play. However, you can easily customize the branding:
- **University/Department**: Update the text in the header section of `App.jsx`.
- **Primary Colors**: Modify the gradient classes in `App.jsx` and the glass panel variables in `index.css`.

---

## 🤝 Contributing

Contributions are welcome! If you have suggestions for new features or improvements, please feel free to open an Issue or submit a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

*Developed with ❤️ for Academic Excellence.*
