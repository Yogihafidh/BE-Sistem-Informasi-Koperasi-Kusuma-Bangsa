import seed from './seed-auth';

async function run() {
  console.log('🌱 Running production seed...');
  await seed();
  console.log('✅ Production seed finished.');
  process.exit(0);
}

run();
