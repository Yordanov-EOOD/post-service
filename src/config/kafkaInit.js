import { getYeetServiceProducer, KafkaConsumer, TOPICS, CONSUMER_GROUPS } from '/app/shared/kafka.js';
import { createUserService } from '../services/userService.js';
import prisma from './db.js';

// Initialize Kafka producer for yeet service
export const initKafkaProducer = async () => {
  try {
    const producer = await getYeetServiceProducer();
    console.log('Yeet service Kafka producer initialized');
    return producer;
  } catch (error) {
    console.error('Failed to initialize Kafka producer for yeet service:', error);
    // Don't crash the service if Kafka isn't available
    return null;
  }
};

// Initialize a consumer for user events that yeet service might need to respond to
export const initKafkaConsumer = async () => {
  try {
    const consumer = new KafkaConsumer(
      CONSUMER_GROUPS.YEET_SERVICE,
      [TOPICS.USER_CREATED, TOPICS.USER_UPDATED, TOPICS.USER_FOLLOWED] // Subscribe to relevant topics
    );
    
    // Set up handlers for different events
    consumer.onMessage(TOPICS.USER_CREATED, handleUserCreatedEvent);
    consumer.onMessage(TOPICS.USER_UPDATED, handleUserUpdatedEvent);
    consumer.onMessage(TOPICS.USER_FOLLOWED, handleUserFollowedEvent);
    
    await consumer.connect();
    console.log('Yeet service Kafka consumer initialized');
    return consumer;
  } catch (error) {
    console.error('Failed to initialize Kafka consumer for yeet service:', error);
    // Don't crash the service if Kafka isn't available
    return null;
  }
};

// Handler for user created events
const handleUserCreatedEvent = async (message) => {
  console.log('Yeet service received user created event:', message);
  // Extract data from the event
  const { authId, username } = message;
  if (!authId || !username) {
    console.warn('USER_CREATED event missing required fields:', message);
    return;
  }
  
  // Check if this is a registration status update
  if (message.registrationStatus === 'COMPLETE') {
    console.log('Received registration completion event for user:', authId);
    return;
  }
  
  try {
    // Check if user already exists before creating
    const existingUser = await prisma.user.findUnique({
      where: { authUserId: authId }
    });
    
    if (existingUser) {
      console.log('User already exists in yeet service DB for authId:', authId);
      return;
    }
    
    await createUserService({
      authUserId: authId, 
      username: username})
    .then(() => {
      console.log('User created in yeet service DB for authId:', authId);
    })
   .catch((err) => {
     console.error('Error creating user in yeet service DB for authId:', authId, err);
   });
}catch (err) {
    console.error('Error creating user in yeet service DB for authId:', authId, err);
  }
};

// Handler for user updated events
const handleUserUpdatedEvent = (message) => {
  console.log('Yeet service received user updated event:', message);
  // This could be used to update user info in yeet metadata
};

// Handler for user followed events
const handleUserFollowedEvent = (message) => {
  console.log('Yeet service received user followed event:', message);
  // This could be used to update feed content when a user follows someone
};

// Initialize Kafka when the module is imported
export const initKafka = async () => {
  const producer = await initKafkaProducer();
  const consumer = await initKafkaConsumer();
  
  return { producer, consumer };
};