// /api/check-bsc-deposits.js
const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');

module.exports = async (req, res) => {
  // Для Vercel Serverless - важно обрабатывать timeout
  const context = { startTime: Date.now() };
  
  try {
    console.log('=== BSC DEPOSIT MONITOR STARTED ===');
    
    // Проверяем переменные окружения
    if (!process.env.BSC_RPC_URL) {
      throw new Error('BSC_RPC_URL not found in environment variables');
    }

    // Настройка провайдера BSC
    const provider = new ethers.JsonRpcProvider(
      process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/'
    );

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Получаем все адреса пользователей
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('deposit_address, id, email');

    if (profilesError) {
      throw new Error(`Database error: ${profilesError.message}`);
    }

    console.log(`Checking ${profiles.length} BSC addresses for deposits...`);

    let newDepositsCount = 0;
    const results = [];

    // Проверяем каждый адрес
    for (const profile of profiles) {
      try {
        if (context.startTime + 8000 < Date.now()) {
          console.log('Timeout approaching, stopping...');
          break;
        }

        const balance = await provider.getBalance(profile.deposit_address);
        const balanceBNB = ethers.formatEther(balance);
        
        console.log(`Address ${profile.deposit_address}: ${balanceBNB} BNB`);

        // Если есть баланс
        if (balance > 0) {
          // Получаем историю транзакций (последние 100 блоков)
          const currentBlock = await provider.getBlockNumber();
          const fromBlock = currentBlock - 1000; // Проверяем последние 1000 блоков
          
          // Ищем транзакции на этот адрес
          const transfers = await provider.getLogs({
            address: profile.deposit_address,
            fromBlock: fromBlock,
            toBlock: currentBlock,
            topics: [
              ethers.id('Transfer(address,address,uint256)')
            ]
          });

          // Обрабатываем найденные транзакции
          for (const log of transfers) {
            if (context.startTime + 8000 < Date.now()) break;

            try {
              const tx = await provider.getTransaction(log.transactionHash);
              
              if (tx && tx.to && tx.to.toLowerCase() === profile.deposit_address.toLowerCase()) {
                // Проверяем есть ли уже эта транзакция в базе
                const { data: existingDeposit } = await supabase
                  .from('deposits')
                  .select('id')
                  .eq('tx_hash', tx.hash)
                  .single();

                if (!existingDeposit) {
                  // Получаем детали транзакции
                  const receipt = await provider.getTransactionReceipt(tx.hash);
                  const confirmations = currentBlock - receipt.blockNumber;
                  
                  // Определяем статус
                  let status = 'pending';
                  if (confirmations >= 12) status = 'confirmed'; // 12 подтверждений для BSC
                  else if (confirmations >= 1) status = 'processing';

                  // Вставляем новую запись о депозите
                  const { data: newDeposit, error: insertError } = await supabase
                    .from('deposits')
                    .insert([
                      {
                        user_id: profile.id,
                        tx_hash: tx.hash,
                        amount: tx.value.toString(),
                        status: status,
                        network: 'bsc',
                        token_symbol: 'BNB',
                        block_number: receipt.blockNumber,
                        confirmations: confirmations,
                        confirmed_at: status === 'confirmed' ? new Date().toISOString() : null
                      }
                    ])
                    .select();

                  if (insertError) {
                    console.log(`Error inserting deposit: ${insertError.message}`);
                  } else {
                    newDepositsCount++;
                    console.log(`✅ New deposit found: ${tx.hash} - ${ethers.formatEther(tx.value)} BNB`);
                    results.push({
                      user: profile.email,
                      amount: ethers.formatEther(tx.value),
                      tx_hash: tx.hash,
                      status: status
                    });
                  }
                }
              }
            } catch (txError) {
              console.log(`Error processing tx ${log.transactionHash}: ${txError.message}`);
              continue;
            }
          }
        }

        // Небольшая задержка чтобы не превысить лимиты RPC
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (profileError) {
        console.log(`Error processing profile ${profile.deposit_address}: ${profileError.message}`);
        continue;
      }
    }

    console.log(`=== BSC DEPOSIT MONITOR COMPLETED ===`);
    console.log(`New deposits found: ${newDepositsCount}`);
    console.log(`Profiles checked: ${profiles.length}`);
    
    res.status(200).json({
      success: true,
      checked: profiles.length,
      new_deposits: newDepositsCount,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ BSC DEPOSIT MONITOR ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
