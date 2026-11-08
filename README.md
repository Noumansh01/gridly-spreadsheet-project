# Spreadsheet Application

A small spreadsheet application built with **Next.js, React, and TypeScript**. It supports cell editing, formulas, keyboard navigation, multiple sheets, copy/paste, undo/redo, and large datasets.

## Requirements

- Node.js 18+
- npm

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/Noumansh01/gridly-spreadsheet-project.git
   ```

2. Open the project folder:

   ```bash
   cd gridly-spreadsheet-project
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Reset Fixtures

To restore the default sample datasets (Budget, Big, and Broken), run:

```bash
npm run reset-fixtures
```

Then refresh the application.

**Note:** Resetting fixtures restores the predefined test data. It is useful when you want to test the application from a clean state.

## Available Fixtures

- **Budget:** Sample budget data with formulas and calculations.
- **Big:** Large dataset with 10,000 rows and 12 columns.
- **Broken:** Test data for invalid formulas, circular references, and division by zero.

## Build for Production

```bash
npm run build
npm run start
```

## Tech Stack

- Next.js
- React
- TypeScript
- CSS / Tailwind CSS
