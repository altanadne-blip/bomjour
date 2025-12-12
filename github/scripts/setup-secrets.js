// .github/scripts/setup-secrets.js
// Инструмент для проверки настроек
console.log('🔧 Deposit Monitor Setup Check');
console.log('==============================\n');

const requiredSecrets = [
  'BSC_RPC_URL',
  'SUPABASE_URL', 
  'SUPABASE_SERVICE_ROLE_KEY'
];

console.log('Required GitHub Secrets:');
requiredSecrets.forEach(secret => {
  console.log(`- ${secret}: ${process.env[secret] ? '✅ Set' : '❌ Missing'}`);
});

console.log('\n📝 Instructions:');
console.log('1. Go to your GitHub repository');
console.log('2. Click Settings → Secrets and variables → Actions');
console.log('3. Add the following secrets:');
console.log('   - BSC_RPC_URL: Your BSC RPC endpoint');
console.log('   - SUPABASE_URL: Your Supabase project URL');
console.log('   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key');
console.log('\n⚙️ Example BSC RPC URLs:');
console.log('- https://bsc-dataseed.binance.org/');
console.log('- https://bsc-dataseed1.defibit.io/');
console.log('- https://bsc-dataseed1.ninicoin.io/');
