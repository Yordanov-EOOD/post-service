/**
 * Mock for shared Kafka module used in Docker container environment
 */
import { jest } from '@jest/globals';

export const getYeetServiceProducer = jest.fn(() => ({
  send: jest.fn().mockResolvedValue({ success: true }),
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true)
}));

export const TOPICS = {
  YEET_CREATED: 'yeet.created',
  YEET_DELETED: 'yeet.deleted',
  YEET_LIKED: 'yeet.liked',
  YEET_RETWEETED: 'yeet.retweeted'
};

export const KafkaConsumer = jest.fn(() => ({
  connect: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn().mockResolvedValue(true),
  run: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  on: jest.fn()
}));

export const CONSUMER_GROUPS = {
  POST_SERVICE_GROUP: 'post-service-group'
};

export default {
  getYeetServiceProducer,
  TOPICS,
  CONSUMER_GROUPS,
  KafkaConsumer
};