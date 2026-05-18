# JobConnect Recruitment System Backend - GEMINI.md

This document provides a comprehensive overview of the JobConnect recruitment system backend, designed to give Gemini a deep understanding of the project's structure, purpose, and development conventions.

## 1. Project Overview

JobConnect is a full-featured recruitment platform that connects candidates with employers. The backend is a Node.js application built with the Express.js framework. It uses Prisma as an ORM to interact with a PostgreSQL database. The system is designed with a clear separation of concerns, following a layered architecture that includes controllers, services, and routes. A key feature of the application is its use of AI-powered services, including vector embeddings for semantic search of jobs and resumes.

**Core Technologies:**

*   **Backend:** Node.js, Express.js
*   **Database:** PostgreSQL
*   **ORM:** Prisma
*   **Authentication:** JWT (JSON Web Tokens)
*   **Testing:** Jest, Supertest
*   **AI/ML:** Vector embeddings for semantic search

## 2. Key Features

*   **User Management:** Secure user registration and authentication with role-based access control (Candidate, Recruiter, Admin).
*   **Company Profiles:** Recruiters can create and manage detailed company profiles.
*   **Job Posting:** Companies can post, edit, and manage job listings.
*   **Candidate Profiles:** Candidates can build comprehensive profiles, including their skills, work experience, and education.
*   **Resume Management:** Candidates can upload and manage multiple resumes.
*   **Job Application:** Candidates can apply for jobs and track their application status.
*   **Semantic Search:** AI-powered search functionality for jobs and candidates, leveraging vector embeddings.
*   **Job Bookmarking:** Candidates can save jobs for later viewing.
*   **Admin Dashboard:** A dedicated interface for administrators to manage users, companies, and job postings.
*   **Chat:** Real-time chat functionality.

## 3. Architecture

The project follows a classic layered architecture, promoting a clean separation of concerns and making the codebase easier to maintain and scale.

*   **`src/routes`:** Defines the API endpoints and maps them to the appropriate controllers.
*   **`src/controllers`:** Handles incoming HTTP requests, validates input, and calls the corresponding services to perform business logic.
*   **`src/services`:** Contains the core business logic of the application, interacting with the database through the Prisma ORM.
*   **`prisma/schema`:** The database schema is defined in multiple `.prisma` files, organized by domain (e.g., `auth.prisma`, `job.prisma`).

## 4. Database Schema

The database schema is managed using Prisma and is split into several files within the `prisma/schema` directory. The main models include:

*   **`User`**: Stores user account information, including credentials and roles.
*   **`Company`**: Contains details about companies registered on the platform.
*   **`Job`**: Represents job postings with all relevant information.
*   **`Candidate_profile`**: Stores detailed information about candidates.
*   **`Application`**: Tracks job applications made by candidates.
*   **`Resume`**: Manages candidate resume files.
*   **`ResumeVectors` & `JobVectors`**: Store vector embeddings for resumes and jobs to enable semantic search.

## 5. Building and Running the Project

### Installation

To install the project dependencies, run:

```bash
npm install
```

### Running the Application

For development, the project uses `nodemon` to automatically restart the server on file changes:

```bash
npm run dev
```

For production, use:

```bash
npm start
```

The server will be available at `http://localhost:3000`.

### Database Management

The project uses Prisma for database migrations and management.

*   **Apply schema changes to the database:** `npm run db:push`
*   **Run migrations:** `npm run db:migrate`
*   **Generate the Prisma client:** `npm run generate`
*   **Open Prisma Studio to view and edit data:** `npm run studio`

### Testing

The project is set up with Jest and Supertest for integration testing. To run the tests:

```bash
npm test
```

## 6. Development Conventions

*   **Code Style:** The project uses ESLint to enforce a consistent coding style. The configuration can be found in `eslint.config.mjs`.
*   **Modularity:** The codebase is organized into modules by feature, with a clear separation between routes, controllers, and services.
*   **Error Handling:** The application uses a consistent error handling mechanism, with meaningful error messages and HTTP status codes.
*   **Authentication:** Authentication is handled via JWT, with the `authMiddleware.js` protecting routes that require authentication.
*   **File Uploads:** `multer` is used for handling file uploads, with specific middleware for avatars, resumes, and company logos.
