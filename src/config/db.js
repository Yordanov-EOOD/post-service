import { PrismaClient } from '@prisma/client';

// Connection pooling configuration for Prisma
const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },    // Configure logging based on environment
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
    __internal: {
      engine: {
        // Configure connection pooling
        connectionLimit: parseInt(process.env.PRISMA_CONNECTION_LIMIT || '10'),
        // Higher value for more frequent pool checks
        activeTimeoutMs: parseInt(process.env.PRISMA_ACTIVE_TIMEOUT_MS || '300000'), // 5 minutes
        // Higher value for more time to hold connections in pool before closing
        idleTimeoutMs: parseInt(process.env.PRISMA_IDLE_TIMEOUT_MS || '60000'), // 1 minute
        // Higher value gives more time for long-running transactions
        transactionTimeoutMs: parseInt(process.env.PRISMA_TRANSACTION_TIMEOUT_MS || '5000')
      }
    }
  });
};

// Global singleton instance
const globalForPrisma = globalThis || global;

// Ensure we only create one instance in development
const prisma = globalForPrisma.prisma || prismaClientSingleton();

// Validate the Prisma client initialization
console.log('Prisma client initialized');

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Add middleware for logging queries (for development)
if (process.env.NODE_ENV === 'development') {
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
    return result;
  });
}

// Handle connection issues
prisma.$on('error', (e) => {
  console.error('Prisma Client error:', e);
});

// Add connection management
process.on('SIGINT', async () => {
  console.log('Received SIGINT - Closing Prisma connections');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM - Closing Prisma connections');
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;