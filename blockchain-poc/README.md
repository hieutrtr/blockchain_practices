# Blockchain Data Processing PoC

A proof-of-concept blockchain data processing system built with Node.js, TypeScript, and PostgreSQL. This project demonstrates how to build a DeFi data platform using only free resources.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- npm or yarn

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd blockchain-poc

# Install dependencies
npm install

# Copy environment configuration
cp config.env .env
# Edit .env with your configuration
```

### 2. Start Database

```bash
# Start PostgreSQL with Docker
npm run docker:up

# Wait for database to be ready (check logs)
npm run docker:logs
```

### 3. Setup Database Schema

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate
```

### 4. Test Environment Setup

```bash
# Test all components
npm run test:setup
```

### 5. Start Development Server

```bash
# Start the API server
npm run dev
```

The API will be available at `http://localhost:3000`

## 📊 API Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### API Information
```bash
curl http://localhost:3000/api
```

### Get Blocks
```bash
curl http://localhost:3000/api/blocks
```

### Get Tokens
```bash
curl http://localhost:3000/api/tokens
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Test environment setup
npm run test:setup
```

## 🗄️ Database Management

```bash
# Open Prisma Studio (database GUI)
npm run db:studio

# Reset database
npm run db:reset

# Generate Prisma client
npm run db:generate
```

## 🐳 Docker Commands

```bash
# Start services
npm run docker:up

# Stop services
npm run docker:down

# View logs
npm run docker:logs
```

## 📁 Project Structure

```
blockchain-poc/
├── src/
│   ├── api/           # Express.js API server
│   ├── cli/           # Command-line utilities
│   ├── ingestion/     # Blockchain data fetching
│   ├── processing/    # Event decoding and processing
│   ├── enrichment/    # Token metadata enrichment
│   └── types/         # TypeScript type definitions
├── tests/             # Test files
├── prisma/            # Database schema and migrations
├── docs/              # Documentation
├── docker-compose.yml # Docker services configuration
├── config.env         # Environment variables template
└── README.md          # This file
```

## 🔧 Configuration

### Environment Variables

Copy `config.env` to `.env` and update the values:

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/blockchain_poc"

# Ethereum RPC Configuration
ETH_RPC_URL="https://rpc.ankr.com/eth"
ETH_RPC_URL_BACKUP="https://cloudflare-eth.com"

# API Configuration
API_PORT=3000
LOG_LEVEL=info
NODE_ENV=development
```

### Free RPC Endpoints

The project is configured to use free RPC endpoints:

- **Ankr**: `https://rpc.ankr.com/eth` (Public, no key required)
- **Cloudflare**: `https://cloudflare-eth.com` (Public, no key required)
- **Infura**: `https://mainnet.infura.io/v3/YOUR_PROJECT_ID` (Free tier, requires API key)
- **Alchemy**: `https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY` (Free tier, requires API key)

## 🏗️ Architecture

### System Components

1. **Data Sources**: Free Ethereum RPC endpoints
2. **Data Processing**: Blockchain fetcher, event decoder, processing pipeline
3. **Storage**: PostgreSQL database with Prisma ORM
4. **API**: Express.js REST API
5. **Client Applications**: Web interface, CLI tools, external applications

### Data Flow

1. **Ingestion**: Fetch blocks and transactions from Ethereum
2. **Processing**: Decode ERC-20 events and extract transfer data
3. **Enrichment**: Fetch token metadata from smart contracts
4. **Storage**: Store processed data in PostgreSQL
5. **API**: Provide REST endpoints for querying data

## 📈 Development Roadmap

### Completed (Story 001)
- ✅ Environment setup with Docker and PostgreSQL
- ✅ Basic API server with health checks
- ✅ Database schema with Prisma
- ✅ Ethereum RPC connection testing
- ✅ Comprehensive test suite

### Next Steps
- 🔄 Story 002: Basic Data Ingestion
- 🔄 Story 003: Event Decoding
- 🔄 Story 004: Data API Enhancement
- 🔄 Story 005: Token Metadata Enrichment

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   npm run docker:logs
   
   # Restart database
   npm run docker:down
   npm run docker:up
   ```

2. **RPC Connection Failed**
   ```bash
   # Test RPC connection
   npm run test:setup
   
   # Try different RPC endpoint in config.env
   ```

3. **Prisma Client Not Generated**
   ```bash
   # Generate Prisma client
   npm run db:generate
   ```

4. **Tests Failing**
   ```bash
   # Make sure database is running
   npm run docker:up
   
   # Run migrations
   npm run db:migrate
   
   # Run tests
   npm test
   ```

### Logs and Debugging

```bash
# View API server logs
npm run dev

# View database logs
npm run docker:logs

# View test output
npm test -- --verbose
```

## 📚 Documentation

- [Story 001: Environment Setup](../docs/stories/story-001-environment-setup.md)
- [Epic 001: PoC Foundation](../docs/processing_epics/epic-001-poc-foundation.md)
- [Ethereum Free RPC Spec](../docs/ethereum_free_rpc_spec.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- Built with [Ethers.js](https://docs.ethers.org/) for Ethereum interaction
- Database management with [Prisma](https://www.prisma.io/)
- API framework [Express.js](https://expressjs.com/)
- Testing with [Jest](https://jestjs.io/)

---

**Note**: This is a proof-of-concept project designed to work with free resources. For production use, consider upgrading to paid RPC services and implementing additional security measures.
