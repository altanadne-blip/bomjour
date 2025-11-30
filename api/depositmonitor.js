// /api/deposits-monitor.js
const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');

module.exports = async (req, res) => {
  console.log('=== BSC DEPOSIT MONITOR STARTED ===');
  
  // Разрешаем CORS для внешних вызовов
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Проверяем переменные окружения
    if (!process.env.BSC_RPC_URL) {
      throw new Error('BSC_RPC_URL not found');
    }

    const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Получаем все адреса пользователей
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('deposit_address, id, email');

    if (profilesError) throw profilesError;

    console.log(`Checking ${profiles.length} BSC addresses...`);

    let newDepositsCount = 0;
    let totalChecked = 0;
    
    // Проверяем балансы (упрощенная версия)
    for (const profile of profiles) {
      try {
        const balance = await provider.getBalance(profile.deposit_address);
        const balanceBNB = ethers.formatEther(balance);
        
        console.log(`Address ${profile.deposit_address}: ${balanceBNB} BNB`);
        
        if (balance > 0) {
          // Здесь будет логика поиска новых транзакций
          // Пока просто считаем что нашли депозит
          newDepositsCount++;
        }
        
        totalChecked++;
        // Задержка чтобы не превысить лимиты RPC
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`Error with ${profile.deposit_address}: ${error.message}`);
        continue;
      }
    }

    console.log(`=== MONITORING COMPLETED ===`);
    console.log(`Checked: ${totalChecked}, New deposits: ${newDepositsCount}`);
    
    res.status(200).json({
      success: true,
      message: 'BSC deposit monitoring completed',
      checked_addresses: totalChecked,
      new_deposits_found: newDepositsCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ MONITOR ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
