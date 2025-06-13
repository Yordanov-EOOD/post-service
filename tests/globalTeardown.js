/**
 * Global teardown for Jest tests
 * Runs once after all test suites complete
 */

export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Clean up any test resources
    // Close database connections, stop test servers, etc.
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    // Don't throw here to avoid masking test failures
  }
  
  console.log('🏁 Test suite complete');
}
