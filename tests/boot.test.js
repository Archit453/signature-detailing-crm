import app from '../backend/src/app.js';

const port = 5099;
const server = app.listen(port, async () => {
  console.log(`Test server running on port ${port}`);
  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    const json = await res.json();
    console.log('Health check response:', json);
    if (json.status === 'online') {
      console.log('BOOT_TEST_PASSED');
    }
  } catch (err) {
    console.error('Boot test failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});

