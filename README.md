# Support Hours Tracking Application

A comprehensive web-based application for managing and tracking support hours provided to residents in supported housing charity across multiple properties.

## 🏠 Overview

This application helps charity housing organizations manage:
- **Properties**: Multiple housing properties with capacity management
- **Residents**: Individual residents with monthly support hour allocations
- **Support Workers**: Staff members with specializations and availability
- **Support Sessions**: Scheduling and tracking of support activities
- **Reporting**: Analytics and insights on support delivery

## ✨ Features

### Core Functionality
- ✅ **User Authentication**: Secure login with role-based access (Admin/View-Only)
- ✅ **Property Management**: CRUD operations for housing properties
- ✅ **Resident Management**: Comprehensive resident profiles and tracking
- ✅ **Support Worker Management**: Staff scheduling and specialization tracking
- ✅ **Dashboard**: Real-time statistics and overview
- ✅ **Responsive Design**: Mobile-friendly Bootstrap interface

### Support Types
- 🧠 **Mental Health Support** (Red)
- 🏠 **Domestic and Independence Support** (Green)  
- 👥 **Activity Based Group Support** (Blue)

### Coming Soon
- 📅 **Interactive Calendar**: Monthly, weekly, and daily views
- 📊 **Advanced Reporting**: KPIs, utilization rates, and analytics
- 📄 **Data Export**: PDF, Excel, and CSV exports
- ⏰ **Session Management**: Advanced scheduling and tracking

## 🛠 Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with advanced views and functions
- **Frontend**: Handlebars templating with Bootstrap 5
- **Authentication**: Session-based with bcrypt password hashing
- **Containerization**: Docker with Docker Compose
- **Security**: Helmet.js, rate limiting, CSRF protection

## 🚀 Quick Start

### Prerequisites

- Docker Desktop for Mac (or compatible Docker setup)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd support-hours-tracker
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration if needed
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Initialize the database**
   ```bash
   docker-compose exec app npm run migrate
   docker-compose exec app npm run seed
   ```

5. **Access the application**
   - Application: http://localhost:3000
   - Database: localhost:5432

### Default Login Credentials

- **Admin User**: admin@support-hours.com / admin123
- **View-Only User**: viewer@support-hours.com / admin123

## 📁 Project Structure

```
support-hours-tracker/
├── database/
│   ├── init.sql              # Database schema
│   ├── seed.sql              # Sample data
│   ├── migrate.js            # Migration runner
│   └── seed.js               # Seed data runner
├── middleware/
│   └── auth.js               # Authentication middleware
├── routes/
│   ├── auth.js               # Authentication routes
│   ├── dashboard.js          # Dashboard routes
│   ├── properties.js         # Property management
│   ├── residents.js          # Resident management
│   ├── support-workers.js    # Support worker management
│   ├── sessions.js           # Session management
│   ├── calendar.js           # Calendar views
│   └── reports.js            # Reporting system
├── views/
│   ├── layouts/
│   │   ├── main.hbs          # Main application layout
│   │   └── auth.hbs          # Authentication layout
│   ├── auth/                 # Authentication views
│   ├── dashboard/            # Dashboard views
│   ├── properties/           # Property management views
│   ├── residents/            # Resident management views
│   ├── support-workers/      # Support worker views
│   ├── sessions/             # Session management views
│   ├── calendar/             # Calendar views
│   └── reports/              # Reporting views
├── public/
│   ├── css/style.css         # Custom styles
│   └── js/app.js             # Frontend JavaScript
├── utils/
│   └── database.js           # Database utilities
├── docker-compose.yml        # Docker orchestration
├── Dockerfile               # Application container
├── server.js                # Main application server
└── package.json             # Dependencies and scripts
```

## 🐳 Docker Configuration

The application uses a multi-container Docker setup:

- **app**: Node.js application container
- **db**: PostgreSQL database container  
- **nginx**: Nginx reverse proxy (for production)

### Development Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Access application container
docker-compose exec app bash

# Access database
docker-compose exec db psql -U postgres -d support_hours
```

## 📊 Database Schema

### Core Tables
- **users**: Authentication and user management
- **properties**: Housing properties with capacity
- **residents**: Individual residents with support allocations
- **support_workers**: Staff with specializations
- **support_sessions**: Individual support sessions
- **support_type_config**: Configurable support types

### Advanced Features
- **Views**: Pre-calculated summaries and statistics
- **Triggers**: Automatic timestamp updates
- **Audit Log**: Change tracking for all modifications
- **Constraints**: Data integrity and validation

## 🔐 Security Features

- **Password Hashing**: bcrypt with configurable rounds
- **Session Security**: Secure session management with PostgreSQL storage
- **Rate Limiting**: API endpoint protection
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Template escaping and CSP headers
- **Account Lockout**: Failed login attempt protection

## 🎨 User Interface

- **Responsive Design**: Mobile-first Bootstrap 5 implementation
- **Color-Coded Support Types**: Visual identification system
- **Interactive Elements**: Modern card-based layouts
- **Accessibility**: WCAG 2.1 AA compliance considerations
- **Dark/Light Theme**: System preference detection

## 📈 Current Status

### ✅ Completed Features
- Docker containerization with full development environment
- Complete database schema with sample data
- User authentication and role-based access control
- Property management (CRUD operations)
- Resident management with property associations
- Support worker management with specializations
- Dashboard with real-time statistics
- Responsive Bootstrap UI

### 🚧 In Development
- Interactive calendar with session scheduling
- Advanced session management
- Comprehensive reporting and analytics
- Data export functionality

## 🔧 Development

### Adding New Features

1. **Database Changes**: Update `database/init.sql` and create migration scripts
2. **Routes**: Add new routes in the `routes/` directory
3. **Views**: Create corresponding Handlebars templates
4. **Styles**: Update `public/css/style.css` for custom styling
5. **JavaScript**: Add frontend logic to `public/js/app.js`

### Testing

```bash
# Run tests (when implemented)
docker-compose exec app npm test

# Lint code
docker-compose exec app npm run lint

# Format code
docker-compose exec app npm run format
```

## 📚 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/profile` - User profile
- `POST /auth/change-password` - Change password

### Properties
- `GET /properties` - List all properties
- `GET /properties/:id` - View property details
- `POST /properties/create` - Create new property (Admin)
- `POST /properties/:id/edit` - Update property (Admin)

### Residents
- `GET /residents` - List all residents
- `GET /residents/:id` - View resident details
- `POST /residents/create` - Create new resident (Admin)
- `POST /residents/:id/edit` - Update resident (Admin)

### Support Workers
- `GET /support-workers` - List all support workers
- `GET /support-workers/:id` - View support worker details
- `POST /support-workers/create` - Create new support worker (Admin)
- `POST /support-workers/:id/edit` - Update support worker (Admin)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in `CLAUDE.md`
- Review Docker logs: `docker-compose logs -f`
- Ensure all containers are running: `docker-compose ps`

## 🔄 Updates and Maintenance

- Regular security updates for base Docker images
- Database backups configured for production
- Monitoring and alerting ready for deployment
- CI/CD pipeline compatible

---

**Built with ❤️ for charity housing organizations**