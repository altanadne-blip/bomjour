const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
const crypto = require('crypto');

module.exports = async (req, res) => {
  console.log('Received request method:', req.method);

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // AUTH client (anon key)
    const authClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // DATA client (service role to bypass RLS)
    const dataClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('=== НАЧАЛО РЕГИСТРАЦИИ ===');

    // 1. Sign up user
    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.log('❌ Ошибка Auth:', authError.message);
      throw authError;
    }

    console.log('✅ Auth успешен, User ID:', authData.user?.id);

    // 2. Generate deterministic EVM private key and address
    console.log('2. Генерация EVM адреса...');

    const serverSecret = process.env.CK82GN;
    if (!serverSecret) throw new Error('Server secret not found');

    const privateKeyData = `${serverSecret}${email}`;
    const privateKeyHash = crypto
      .createHash('sha256')
      .update(privateKeyData)
      .digest('hex');
    const privateKey = privateKeyHash.padEnd(64, '0').substring(0, 64);

    const wallet = new ethers.Wallet(privateKey);
    const depositAddress = wallet.address;

    console.log('✅ Сгенерирован адрес:', depositAddress);

    // 3. Insert into profiles (using service role)
    console.log('3. Создание профиля...');

    const { data: profileData, error: profileError } = await dataClient
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          email: email,
          deposit_address: depositAddress,
          private_key: privateKey,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (profileError) {
      console.log('❌ Ошибка при создании профиля:', profileError);
      throw profileError;
    }

    console.log('✅ Профиль создан:', profileData);
    console.log('=== РЕГИСТРАЦИЯ ЗАВЕРШЕНА ===');

    return res.status(200).json({
      message: 'Success! Check your email for confirmation.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        deposit_address: depositAddress
      }
    });

  } catch (error) {
    console.log('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    return res.status(400).json({ error: error.message });
  }
};
