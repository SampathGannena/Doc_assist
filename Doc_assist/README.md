# Code Documentation Assistant - React Frontend

A modern, responsive React application for AI-powered code documentation generation. This frontend provides an intuitive interface for developers to generate comprehensive docstrings for their functions using advanced NLP models.

## 🚀 Features

### Core Functionality
- **AI-Powered Documentation Generation**: Generate intelligent docstrings for multiple programming languages
- **Multi-Language Support**: Python, JavaScript, Java, C++, C#, and more
- **Real-time Code Analysis**: Instant analysis of function parameters, return types, and context
- **Syntax Highlighting**: Beautiful code display with Prism.js integration
- **Copy to Clipboard**: Easy copying of generated documentation

### User Experience
- **Modern UI/UX**: Built with styled-components and Framer Motion animations
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Dark Theme**: Developer-friendly dark interface
- **Interactive Demos**: Live demonstration of documentation generation
- **VS Code Extension Preview**: Mockup of IDE integration

### Technical Features
- **React 18**: Latest React features with hooks and functional components
- **TypeScript Ready**: Full TypeScript support for type safety
- **Performance Optimized**: Code splitting and lazy loading
- **Accessibility**: WCAG compliant with proper ARIA labels
- **SEO Friendly**: Meta tags and semantic HTML structure

## 🛠️ Tech Stack

- **Frontend Framework**: React 18
- **Styling**: Styled Components
- **Animations**: Framer Motion
- **Syntax Highlighting**: React Syntax Highlighter (Prism.js)
- **State Management**: React Hooks (useState, useEffect, custom hooks)
- **Notifications**: React Hot Toast
- **Copy Functionality**: React Copy to Clipboard
- **Build Tool**: Create React App

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup
1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Open your browser** and navigate to `http://localhost:3000`

### Build for Production
```bash
npm run build
```

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── Header/         # Header and hero section
│   ├── Demo/           # Interactive demo section
│   ├── Features/       # Features showcase
│   ├── VSCode/         # VS Code extension preview
│   ├── Examples/       # Before/after examples
│   └── Footer/         # Footer component
├── hooks/              # Custom React hooks
│   └── useDocumentationGenerator.js
├── styles/             # Global styles
│   └── index.css
├── utils/              # Utility functions
├── App.js              # Main application component
└── index.js            # Application entry point
```

## 🎯 Key Features

### Interactive Demo
- Real-time code input with syntax highlighting
- Multi-language support (Python, JavaScript, Java, C++, C#)
- AI-powered documentation generation simulation
- Copy to clipboard functionality
- Performance metrics display

### VS Code Extension Preview
- Realistic IDE interface mockup
- Context menu integration demonstration
- Feature showcase with installation CTA

### Before/After Examples
- Code transformation demonstrations
- Multiple programming languages
- Professional docstring formats

## 🚀 Getting Started

1. Install dependencies: `npm install`
2. Start backend API: `npm run start:backend`
3. In a second terminal, start frontend: `npm run start:frontend`
4. Open http://localhost:3000 in your browser
5. Try the interactive demo with different code examples

## 🔌 Backend Integration

The frontend now includes full API integration with retry logic, caching, and error handling!

### Quick Start

1. **Configure the API endpoint** in `.env`:
   ```env
   REACT_APP_API_BASE_URL=http://localhost:5000/api
   ```

2. **Set up your backend** following the guide in `BACKEND_API_GUIDE.md`

   Run the included backend server:
   ```bash
   python backend/server.py
   ```

   To use Groq for richer traversal-focused document generation, set backend env vars:
   ```bash
   DOCASSIST_MODEL_PROVIDER=groq
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=llama-3.3-70b-versatile
   GROQ_API_BASE_URL=https://api.groq.com/openai/v1
   ```

3. **The frontend will automatically**:
   - Connect to your AI backend API
   - Cache responses for better performance
   - Retry failed requests with exponential backoff
   - Fall back to local mode if API is unavailable

### Production Access Workflow

DOCAssist uses API-key based authentication with scoped authorization.

- Bootstrap one admin token through environment variables
- Use `/api/access/keys` to generate scoped keys for teams
- Assign least-privilege scopes per role (Auditor, Developer, Manager, Admin)
- Rotate and revoke keys regularly

See `PRODUCTION_ACCESS_FLOW.md` for complete production setup and API call examples.

### Utilities Included

The `src/utils/` folder now contains:
- **api.js** - HTTP client with retry logic and caching
- **codeParser.js** - Code analysis and parsing functions
- **validators.js** - Input validation utilities
- **helpers.js** - General utility functions
- **constants.js** - App-wide constants and configuration

See `src/utils/README.md` for detailed documentation.

## 📚 Further Reading

- `QUICK_START.md`
- `PRODUCTION_ACCESS_FLOW.md`
- `BACKEND_API_GUIDE.md`
- `IMPLEMENTATION_SUMMARY.md`

## 📝 License

MIT License - Built with ❤️ for developers who care about documentation.
Code Documentation Assistant : it is an AI-powered tool that automatically generates docstrings and function explanations by analyzing source code.
