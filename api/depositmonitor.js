const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');

// USDT контракт на BSC
const USDT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // USDT на BSC

module.exports = async (req, res) => {
  console.log('=== USDT DEPOSIT MONITOR STARTED ===');
  
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
    const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Получаем все адреса пользователей
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('deposit_address, id, email, balance');

    if (profilesError) throw profilesError;

    console.log(`Checking ${profiles.length} addresses for USDT...`);

    let newDepositsCount = 0;
    let totalChecked = 0;
    const results = [];
    
    // Получаем decimals USDT
    const decimals = await usdtContract.decimals();
    
    // Проверяем USDT балансы
    for (const profile of profiles) {
      try {
        const usdtBalance = await usdtContract.balanceOf(profile.deposit_address);
        const usdtBalanceFormatted = ethers.formatUnits(usdtBalance, decimals);
        const usdtBalanceNumber = parseFloat(usdtBalanceFormatted);
        
        console.log(`Address ${profile.deposit_address}: ${usdtBalanceFormatted} USDT`);
        
        if (usdtBalance > 0) {
          // Проверяем есть ли уже депозит для этого адреса
          const { data: existingDeposits } = await supabase
            .from('deposits')
            .select('id')
            .eq('user_id', profile.id)
            .eq('token_address', USDT_ADDRESS.toLowerCase());

          if (!existingDeposits || existingDeposits.length === 0) {
            // Вычисляем новый баланс (обрабатываем null значение)
            const currentBalance = profile.balance ? parseFloat(profile.balance) : 0;
            const newBalance = currentBalance + usdtBalanceNumber;
            
            // Создаем запись о депозите
            const { error: insertError } = await supabase
              .from('deposits')
              .insert([
                {
                  user_id: profile.id,
                  tx_hash: `manual_${Date.now()}_${profile.id}`,
                  amount: usdtBalance.toString(),
                  amount_usd: usdtBalanceNumber,
                  status: 'confirmed',
                  network: 'bsc',
                  token_address: USDT_ADDRESS.toLowerCase(),
                  token_symbol: 'USDT',
                  confirmations: 12,
                  confirmed_at: new Date().toISOString()
                }
              ]);

            if (!insertError) {
              // Обновляем баланс пользователя в profiles
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ 
                  balance: newBalance.toString()
                })
                .eq('id', profile.id);

              if (updateError) {
                console.error(`❌ Error updating balance for user ${profile.email}:`, updateError);
                // Отменяем депозит если не удалось обновить баланс
                await supabase
                  .from('deposits')
                  .delete()
                  .eq('user_id', profile.id)
                  .like('tx_hash', `manual_%_${profile.id}`);
              } else {
                newDepositsCount++;
                results.push({
                  user: profile.email,
                  address: profile.deposit_address,
                  amount: usdtBalanceFormatted,
                  token: 'USDT',
                  old_balance: currentBalance,
                  new_balance: newBalance
                });
                console.log(`✅ New USDT deposit: ${usdtBalanceFormatted} USDT for ${profile.email}. Balance updated: ${currentBalance} → ${newBalance}`);
              }
            } else {
              console.error(`❌ Error inserting deposit for ${profile.email}:`, insertError);
            }
          } else {
            console.log(`ℹ️  Deposit already exists for ${profile.email}`);
          }
        }
        
        totalChecked++;
        // Задержка чтобы не превысить лимиты RPC
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`Error checking USDT for ${profile.deposit_address}: ${error.message}`);
        continue;
      }
    }

    console.log(`=== USDT MONITORING COMPLETED ===`);
    console.log(`Checked: ${totalChecked}, New USDT deposits: ${newDepositsCount}`);
    
    res.status(200).json({
      success: true,
      message: 'USDT deposit monitoring completed',
      checked_addresses: totalChecked,
      new_deposits_found: newDepositsCount,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ USDT MONITOR ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
