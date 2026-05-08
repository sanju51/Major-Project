# 🚀 ProjectPulse - Enterprise Project Management

## 🚀 Key Modules & Features

### 📦 1. Core Project Management
- **Project Lifecycle Hub**: Track projects through PLANNED, ACTIVE, ON_HOLD, and COMPLETED phases.
- **Team Orchestration**: Multi-user project assignment with role-based access control (RBAC).
- **Activity Auditing**: Full audit trail of every modification made to projects and tasks.

### 📊 2. Task Management & Scheduling
- **Hierarchical Tasks**: Support for parent-child task relationships.
- **Gantt Chronology**: Interactive timeline with task dependencies and duration tracking.
- **Prioritization Engine**: Dynamic sorting by LOW, MEDIUM, and HIGH priority.
- **Kanban Workflow**: Streamlined status transitions from TODO to DONE.

### ⏱️ 3. Time & Resource Optimization
- **Precision Time Tracking**: Billable and non-billable time logging against specific tasks.
- **Resource Allocation**: Monitor team bandwidth and software/hardware allocation.
- **Availability Matrix**: Visual representation of resource utilization vs. capacity.

### 💰 4. Financial Visibility
- **Budget Tracking**: Real-time project budget monitoring with utilization rates.
- **Expense Management**: Categorized expense tracking with approval workflows.
- **Financial Indicators**: Dynamic "Spent vs. Remaining" progress indicators.

### 📈 5. Advanced Analytics
- **Productivity Metrics**: Task completion trends and team performance ratios.
- **Operational Dashboard**: High-level KPI overview for managers and executives.

## 📋 API Surface (RESTful endpoints)

All API requests are prefixed with `/api`. Authentication is required for all endpoints except where noted.

| Category | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/auth/register` | POST | Create a new enterprise account (Public) |
| **Auth** | `/auth/login` | POST | Authenticate and receive JWT tokens (Public) |
| **Projects** | `/projects` | GET/POST | List projects or create a new initiative |
| **Tasks** | `/tasks` | GET/POST | Manage granular task items |
| **Timeline** | `/gantt/:projectId` | GET | Retrieve structured data for Gantt rendering |
| **Budget** | `/budget/:projectId` | GET | Access project financial status |
| **Users** | `/users/me` | GET | Retrieve current authenticated user profile |

## 🛠️ Installation Guide

### Standard Prerequisites
- Node.js v18.x or v20.x (LTS recommended)
- MongoDB Instance (Note: Code uses MongoDB/Mongoose)
- NPM or Yarn package manager

### 1. Backend Initialization
```bash
# Navigate to backend
cd backend

# Install production and development dependencies
npm install

# Configure Environment Variables
# Create a .env file based on .env.example
# (Example: MONGODB_URI=mongodb://localhost:27017/projectpulse)

# Launch Development Server
npm run dev
```

### 2. Frontend Initialization
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Launch production-grade development server
npm run dev
```

## 🔒 Security & Standards
- **Stateless Auth**: Secure JWT-based sessions with short-lived access tokens.
- **Input Sanitization**: All incoming data is validated using Express-validator/Zod.
- **Database Integrity**: Referential integrity enforced at the database level.
- **CORS Compliance**: Strict origin-sharing policies for frontend-only access.
