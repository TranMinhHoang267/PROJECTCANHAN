# JobConnect: AI-Powered Smart Recruitment System

JobConnect is an innovative, full-stack recruitment platform designed to revolutionize the hiring process. Leveraging cutting-edge AI capabilities, it seamlessly connects candidates with employers through intelligent job suggestions, a dynamic virtual assistant, and advanced vector-based resume matching. Our system streamlines recruitment, making it more efficient and effective for everyone involved.

## Key Features

*   **Dynamic AI Chat Assistant:** Engage with an intelligent virtual assistant powered by Google Gemini, offering real-time support and guidance. The assistant utilizes structural prompt templates and stores messages as stringified JSON for robust and contextual interactions.
*   **High-Performance Vector Search & Keyword Matching:** Experience superior search capabilities for jobs and skills. Our system employs advanced vector embeddings and traditional keyword matching to deliver highly relevant results quickly and accurately.
*   **Full-Stack Optimized Architecture:** Built for performance and scalability, JobConnect features a modern architecture that ensures a smooth and responsive user experience across the platform.

## Tech Stack & Architecture

JobConnect is built with a robust and modern technology stack, ensuring high performance, scalability, and maintainability.

*   **Frontend:**
    *   **Framework:** Next.js (App Router)
    *   **Data Layer:** Utilizes Next.js Server Actions and Services exclusively for all data fetching and state mutation operations, bypassing traditional API Routes for enhanced performance and streamlined development.
*   **Backend Services:**
    *   **Framework:** NestJS
    *   **ORM:** Prisma
*   **Database:**
    *   **Type:** PostgreSQL
    *   **Extensions:** Integrates with `pgvector` for efficient vector storage and querying, including HNSW indexing for rapid similarity searches.
    *   **Naming Convention:** All database columns strictly follow `camelCase` naming conventions.
*   **AI Capabilities:**
    *   **Provider:** Google Gemini API
    *   **Models:** Employs `gemini-3.1-flash-lite` or standard Flash models for processing job descriptions, generating dynamic chat templates, and powering vector search generations.

## Prerequisites & Environment Variables

Before you begin, ensure you have the following installed:

*   **Node.js:** v18.x or higher

Create a `.env` file in the root directory of your project based on the following template, replacing the placeholder values with your actual credentials:

```
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/jobconnect_db?schema=public"

# Google Gemini API Key
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# JWT Secret for Authentication
JWT_SECRET="YOUR_VERY_STRONG_JWT_SECRET"

# Frontend URL (for CORS, if applicable)
FRONTEND_URL="http://localhost:3000"

# Other potential environment variables for third-party services or specific configurations
# EXAMPLE_SERVICE_API_KEY="ANOTHER_API_KEY"
```

## Getting Started / Installation

Follow these steps to get your JobConnect development environment up and running:

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/your-username/JobConnect.git
    cd JobConnect
    ```

2.  **Install Dependencies:**
    Navigate to both the frontend and backend directories and install their respective dependencies.

    ```bash
    # For the backend (NestJS project, typically in the root or a 'backend' folder)
    npm install

    # For the frontend (Next.js project, typically in a 'frontend' folder if structured that way,
    # otherwise, if it's a monorepo setup, it might be part of the main install)
    # Assuming a monolithic structure as per provided context, `npm install` in root covers both.
    ```

    *Note: Based on the provided directory structure, `npm install` in the root should suffice as `package.json` seems to be at the root.*

3.  **Database Setup:**
    Ensure your PostgreSQL database is running and accessible via the `DATABASE_URL` in your `.env` file. Then, apply Prisma migrations and generate the Prisma client.

    ```bash
    npx prisma migrate dev --name init_database # Or a more descriptive name if this is the first migration
    npx prisma generate
    ```

4.  **Run the Development Server:**
    Start the development servers for both the backend and frontend.

    ```bash
    # To run the backend server
    npm run start:dev # Assuming a common NestJS start script

    # To run the frontend development server (if separate)
    # cd frontend && npm run dev
    ```

    *Note: The project structure implies a single Node.js backend. For full-stack, you might have separate `package.json` files or commands for frontend and backend. Please adjust `npm run start:dev` and `npm run dev` as per your actual `package.json` scripts for starting NestJS and Next.js applications.*

## Project Structure Notes

The database schema, managed by Prisma, strictly adheres to a `camelCase` naming convention for all table columns. This ensures consistency and readability across the application's data layer.