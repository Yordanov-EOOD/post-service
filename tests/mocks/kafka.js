// Mock Kafka implementation for tests
export const getYeetServiceProducer = jest.fn(() => ({
  publishMessage: jest.fn().mockResolvedValue(true)
}));

export const TOPICS = {
  YEET_CREATED: 'yeet.created',
  YEET_DELETED: 'yeet.deleted',
  YEET_LIKED: 'yeet.liked',
  YEET_RETWEETED: 'yeet.retweeted'
};
