const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Логируем каждый запрос для отладки
  console.log('Received request method:', req.method);
  
  // Логируем тело запроса
  console.log('Request body:', req.body);

  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Разрешаем OPTIONS-запросы (для проверки на клиенте)
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return res.status(200).end();
  }

  // Обрабатываем только POST-запросы
  if (req.method !== 'POST') {
    console.log('Method not allowed');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, login } = req.body;

    // Проверяем, что данные не пустые
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Создаем клиента Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    if (login) {
      // Логика логина (остается без изменений)
      console.log('Attempting to log in...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('Supabase error during login:', error.message);
        throw error;
      }

      console.log('Login successful:', data);
      res.status(200).json({
        message: 'Login successful',
      });

    } else {
      // РЕГИСТРАЦИЯ С СОЗДАНИЕМ ПРОФИЛЯ
      console.log('Attempting to sign up...');
      
      // 1. Регистрируем пользователя в auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.log('Supabase error during signup:', authError.message);
        throw authError;
      }

      console.log('Auth sign up successful:', authData);

      // 2. Генерируем EVM адрес на основе email и секрета
      const serverSecret = process.env.CK82GN;
      if (!serverSecret) {
        throw new Error('Server secret not found');
      }

      // Создаем приватный ключ из email и секрета
      const privateKeyData = `${serverSecret}${email}`;
      const privateKeyHash = crypto.createHash('sha256').update(privateKeyData).digest('hex');
      
      // Убеждаемся, что приватный ключ имеет правильную длину (64 символа)
      const privateKey = privateKeyHash.padEnd(64, '0').substring(0, 64);
      
      // Создаем кошелек из приватного ключа
      const wallet = new ethers.Wallet(privateKey);
      const depositAddress = wallet.address;

      console.log('Generated deposit address:', depositAddress);

      // 3. Создаем запись в таблице profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id, // ID из auth.users
            email: email,
            deposit_address: depositAddress,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select();

      if (profileError) {
        console.log('Error creating profile:', profileError.message);
        
        // Если не удалось создать профиль, можно удалить пользователя из auth
        // или оставить как есть - зависит от вашей бизнес-логики
        throw profileError;
      }

      console.log('Profile created successfully:', profileData);

      res.status(200).json({
        message: 'Success! Check your email for confirmation.',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          deposit_address: depositAddress
        }
      });
    }

  } catch (error) {
    console.log('Caught error:', error);
    res.status(400).json({ error: error.message });
  }
};
