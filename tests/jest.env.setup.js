// c:\Fontys\S6 Dev-Env\post-service\tests\jest.env.setup.js

// Set up environment variables for tests
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
process.env.DB_PASS = 'test_pass';
process.env.JWT_SECRET = 'test_secret';
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.KAFKA_CLIENT_ID = 'post-service-test';
process.env.KAFKA_CONSUMER_GROUP_ID = 'post-service-group-test';
process.env.POST_SERVICE_PORT = '3001';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
