# Support Hours Tracking Application - Software Specification

## 1. Project Overview

### 1.1 Purpose
A web-based application for recording, managing, and reporting on support hours provided to residents in a supported housing charity across multiple properties.

### 1.2 Target Users
- **Administrators**: Full access to manage data, view reports, configure system
- **View-Only Users**: Limited access to view rotas and schedules only
- **Future Roles**: System should accommodate additional roles (e.g., Support Worker, Property Manager)

## 2. Core Functionality Requirements

### 2.1 User Management & Authentication
- **Login System**: Email/password authentication
- **Password Reset**: Secure email-based password recovery
- **User Roles**: 
  - Admin (full access)
  - View Only (read-only access to rotas/schedules)
  - Extensible role system for future requirements
- **Session Management**: Secure session handling with timeout
- **User Profile Management**: Basic profile editing capabilities

### 2.2 Property Management
- **Property Records**: Store and manage 5 properties with:
  - Property name
  - Maximum capacity (number of residents)
  - Address/location details
  - Property manager contact information
  - Active/inactive status
- **CRUD Operations**: Create, read, update, delete property information

### 2.3 Resident Management
- **Resident Records**:
  - First name and surname
  - Property assignment
  - Monthly support hour allocation
  - Start date of residency
  - End date (if applicable)
  - Contact information
  - Special requirements/notes
- **Property Association**: Each resident linked to one property
- **Historical Tracking**: Maintain history when residents move between properties

### 2.4 Support Worker Management
- **Support Worker Records**:
  - Full name
  - Contact information
  - Employment status (active/inactive)
  - Specializations (which support types they can provide)
  - Maximum hours per week/month
- **Availability Tracking**: Record working hours and availability

### 2.5 Support Types Configuration
1. **Mental Health Support**
2. **Domestic and Independence Support**
3. **Activity Based Group Support**
- **Extensible System**: Ability to add new support types
- **Color Coding**: Each type assigned a distinct color for visual identification

## 3. Support Session Management

### 3.1 Session Recording
- **Core Data**:
  - Date and time (start/end)
  - Duration in hours (minimum 15-minute increments)
  - Support type
  - Resident(s) involved
  - Support worker assigned
  - Property location
  - Session notes/description
- **Validation Rules**:
  - Cannot exceed resident's monthly allowance
  - Cannot double-book support workers
  - Must be within property operating hours
  - Future sessions can be planned, past sessions locked after 48 hours

### 3.2 Monthly Rota Management
- **Monthly Setup**: Create new month's rota structure
- **Copy Functionality**: Copy previous month's pattern as starting point
- **Bulk Operations**: 
  - Mass assignment of recurring sessions
  - Bulk editing of similar sessions
  - Template creation for common patterns

## 4. User Interface Requirements

### 4.1 Calendar Views
- **Monthly Calendar**: 
  - Full month overview
  - Color-coded sessions by support type
  - Click to view/edit session details
  - Resident name display in time slots
- **Weekly View**:
  - 7-day grid with time slots (configurable intervals: 15min, 30min, 1hr)
  - Dates across top, times down side
  - Color-coded cells showing resident names
  - Support worker assignments visible
- **Daily View**: Detailed day schedule with all sessions
- **Filtering Options**: By property, support type, resident, support worker

### 4.2 Data Entry Interface
- **Setup/Configuration Page**:
  - Manage properties, residents, support workers
  - Configure support types and time slots
  - System settings and parameters
- **Session Entry Forms**:
  - Quick-add single sessions
  - Bulk entry for recurring sessions
  - Drag-and-drop rescheduling
- **Validation and Error Handling**: Real-time validation with clear error messages

### 4.3 Navigation & Design
- **Bootstrap Framework**: Responsive, mobile-friendly design
- **Clear Navigation**: Intuitive menu structure with breadcrumbs
- **Consistent Labeling**: Clear, unambiguous labels throughout
- **Accessibility**: WCAG 2.1 AA compliance
- **Mobile Responsiveness**: Functional on tablets and smartphones

## 5. Reporting & Analytics

### 5.1 Core Reports
- **Monthly Hours Summary**:
  - Hours per resident vs. allocation
  - Hours per support worker
  - Hours by support type
  - Property-based breakdowns
- **Utilization Reports**:
  - Resident support utilization percentage
  - Support worker capacity utilization
  - Property capacity utilization
- **Trend Analysis**: Month-over-month comparisons

### 5.2 KPI Dashboard
- **Key Metrics**:
  - Total support hours delivered
  - Average hours per resident
  - Support type distribution
  - Unallocated hours
  - Over/under allocation alerts
- **Visual Representations**: Charts, graphs, and summary cards
- **Export Capabilities**: PDF and Excel export options

### 5.3 Data Export
- **Report Exports**: PDF, Excel, CSV formats
- **Data Backup**: Full data export functionality
- **Filtered Exports**: Export based on date ranges, properties, etc.

## 6. Technical Specifications

### 6.1 Docker Containerization Requirements

#### 6.1.1 Container Architecture
- **Multi-Container Setup**: Separate containers for application, database, and web server
- **Docker Compose**: Complete stack orchestration with single command startup
- **Base Images**: Use official, security-maintained base images (e.g., node:18-alpine, postgres:15-alpine)
- **Container Optimization**: Minimal image sizes using multi-stage builds where applicable

#### 6.1.2 Local Development Environment
- **macOS Compatibility**: Fully functional on macOS (Intel and Apple Silicon)
- **Docker Desktop**: Compatible with Docker Desktop for Mac
- **Volume Mounting**: Source code mounted for hot-reload development
- **Port Mapping**: Consistent port mapping (e.g., localhost:3000 for app, localhost:5432 for database)
- **Environment Isolation**: Complete isolation from host system dependencies

#### 6.1.3 Container Configuration
- **Application Container**:
  - Web application and API
  - Node.js/PHP/Python runtime (depending on chosen tech stack)
  - Application dependencies and libraries
  - Environment-specific configuration
- **Database Container**:
  - PostgreSQL or MySQL database
  - Persistent data volumes
  - Database initialization scripts
  - Development seed data
- **Web Server Container** (if needed):
  - Nginx or Apache for production
  - SSL termination
  - Static file serving
  - Load balancing ready

#### 6.1.4 Development Workflow
- **Quick Start**: `docker-compose up -d` to launch entire stack
- **Hot Reload**: File changes reflected immediately without container rebuild
- **Database Seeding**: Automated setup with sample data for development
- **Log Aggregation**: Centralized logging from all containers
- **Development Tools**: Integration with VS Code Dev Containers (optional)

#### 6.1.5 Environment Management
- **Environment Variables**: 
  - `.env` files for different environments (development, staging, production)
  - Secure handling of sensitive data (database passwords, API keys)
  - Environment-specific database connections
- **Configuration Files**: 
  - Separate Docker Compose files for development and production
  - Override capabilities for local customization
- **Data Persistence**: 
  - Named volumes for database data
  - Backup and restore procedures
  - Data migration scripts

#### 6.1.6 Production Deployment Readiness
- **Production Containers**: Optimized images for production deployment
- **Health Checks**: Container health monitoring and automatic restart
- **Scaling Capabilities**: Horizontal scaling support for application containers
- **Security Hardening**: Non-root users, minimal attack surface
- **CI/CD Integration**: GitHub Actions/GitLab CI compatible

#### 6.1.7 Documentation Requirements
- **Setup Documentation**: Step-by-step local setup instructions
- **Docker Commands**: Common commands cheat sheet
- **Troubleshooting Guide**: Common issues and solutions for macOS
- **Deployment Guide**: Production deployment instructions
- **Backup/Restore**: Database backup and restore procedures

### 6.2 Database Requirements
- **Entities and Relationships**:
  - Users (authentication, roles)
  - Properties (capacity, details)
  - Residents (linked to properties)
  - Support Workers (availability, specializations)
  - Support Sessions (many-to-many relationships)
  - Support Types (configurable)
- **Data Integrity**: Foreign key constraints, validation rules
- **Performance**: Indexed fields for quick searching and reporting
- **Backup**: Regular automated backups with point-in-time recovery

### 6.2 Security Requirements
- **Data Protection**: Encrypted passwords, secure data transmission (HTTPS)
- **Access Control**: Role-based permissions throughout application
- **Audit Trail**: Log all data changes with user/timestamp
- **Data Privacy**: GDPR compliance considerations
- **Session Security**: Automatic logout, session hijacking prevention

### 6.3 Performance Requirements
- **Response Time**: Page loads under 3 seconds
- **Concurrent Users**: Support minimum 20 concurrent users
- **Data Volume**: Handle 5 years of historical data efficiently
- **Scalability**: Architecture supports growth in users and data

## 7. Future Expansion Considerations

### 7.1 Extensibility
- **Modular Architecture**: Allow for feature additions without major refactoring
- **API-Ready**: RESTful API structure for future integrations
- **Additional Roles**: Framework for new user types and permissions
- **New Support Types**: Easy addition of support categories
- **Multi-Property Expansion**: Support for additional properties

### 7.2 Integration Potential
- **Calendar Systems**: Google Calendar, Outlook integration
- **HR Systems**: Support worker management integration
- **Reporting Tools**: Business intelligence tool connectivity
- **Mobile Apps**: API foundation for future mobile applications

## 8. Development Phases

### Phase 1: Core Foundation (MVP)
- User authentication and basic role management
- Property and resident management
- Basic session recording
- Simple calendar view
- Basic reporting

### Phase 2: Enhanced Features
- Advanced calendar views (weekly/daily)
- Comprehensive reporting and KPIs
- Data export capabilities
- Enhanced user interface
- Mobile responsiveness

### Phase 3: Advanced Features
- Advanced analytics and trend reporting
- Integration capabilities
- Automated notifications/alerts
- Advanced bulk operations
- Performance optimizations

## 9. Success Criteria
- **Usability**: Non-technical users can operate the system with minimal training
- **Accuracy**: 99%+ data accuracy in time tracking and reporting
- **Performance**: System handles daily operations without delays
- **Adoption**: 100% user adoption within 3 months of deployment
- **Efficiency**: 50% reduction in time spent on manual scheduling and reporting

## 10. Deployment & Development Workflow

### 10.1 Local Development Setup
- **Prerequisites**: 
  - Docker Desktop for Mac installed and running
  - Git for version control
  - Text editor/IDE of choice
- **Initial Setup**:
  ```bash
  git clone [repository]
  cd support-hours-app
  cp .env.example .env
  docker-compose up -d
  docker-compose exec app npm run migrate  # or equivalent
  docker-compose exec app npm run seed     # load sample data
  ```
- **Daily Development**:
  - `docker-compose up -d` to start all services
  - `docker-compose logs -f` to view application logs
  - `docker-compose down` to stop all services
  - Code changes auto-reload without restart

### 10.2 Production Deployment
- **Container Registry**: Images pushed to Docker Hub or private registry
- **Cloud Deployment**: Deploy to AWS ECS, Google Cloud Run, or DigitalOcean Apps
- **Environment Variables**: Production secrets managed securely
- **Database Migration**: Automated database updates during deployment
- **Zero-Downtime Deployment**: Blue-green deployment strategy
- **SSL Certificates**: Automated SSL certificate management
- **Monitoring**: Container health monitoring and alerting

### 10.3 Maintenance & Updates
- **Version Control**: Git-based deployment workflow
- **Database Backups**: Automated daily backups with point-in-time recovery
- **Security Updates**: Regular base image updates and vulnerability scanning
- **Rollback Capability**: Quick rollback to previous stable version
- **Monitoring**: Application performance monitoring and log aggregation
- **Support**: Documentation, training materials, and ongoing technical support

### 10.4 Development Benefits
- **Consistency**: Identical environment across all developer machines and production
- **Isolation**: No conflicts with other projects or system dependencies
- **Portability**: Easy to share and reproduce development environment
- **Scalability**: Simple to add additional services (Redis, message queues, etc.)
- **Testing**: Easy to spin up test environments with clean data