const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
const crypto = require('crypto');

// Функции аутентификации
const authFunctions = {
  // Проверка активной сессии
  getCurrentSession: async (supabaseClient) => {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  // Получение текущего пользователя
  getCurrentUser: async (supabaseClient) => {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  // Вход по email и паролю
  signIn: async (supabaseClient, email, password) => {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  },

  // Регистрация нового пользователя
  signUp: async (supabaseClient, email, password, userData = {}) => {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            email: email.trim(),
            ...userData
          }
        }
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    }
  },

  // Выход
  signOut: async (supabaseClient) => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  },

  // Обновление токена
  refreshSession: async (supabaseClient) => {
    try {
      const { data, error } = await supabaseClient.auth.refreshSession();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Refresh session error:', error);
      return { data: null, error };
    }
  },

  // Сброс пароля
  resetPassword: async (supabaseClient, email) => {
    try {
      const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.SITE_URL}/pwreset.html`,
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { data: null, error };
    }
  },

  // Обновление пароля
  updatePassword: async (supabaseClient, newPassword) => {
    try {
      const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update password error:', error);
      return { data: null, error };
    }
  },

  // Получение профиля пользователя
  getUserProfile: async (supabaseClient, userId) => {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Get user profile error:', error);
      return { data: null, error };
    }
  },

  // Обновление профиля пользователя
  updateUserProfile: async (supabaseClient, userId, updates) => {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update user profile error:', error);
      return { data: null, error };
    }
  }
};

module.exports = authFunctions;

// Основная функция обработки запросов
module.exports.handler = async (req, res) => {
  console.log('Received request method:', req.method);
  
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, login } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Клиент для аутентификации (используем anon key)
    const authClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Клиент для работы с данными (используем service role key для обхода RLS)
    const dataClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (login) {
      // Логин через auth функции
      console.log('=== НАЧАЛО ЛОГИНА ===');
      const { data, error } = await authFunctions.signIn(authClient, email, password);

      if (error) throw error;

      console.log('✅ Логин успешен:', data.user?.id);
      res.status(200).json({ 
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email
        }
      });

    } else {
      console.log('=== НАЧАЛО РЕГИСТРАЦИИ ===');
      
      // 1. Регистрируем пользователя через auth функции
      console.log('1. Регистрация в Supabase Auth...');
      const { data: authData, error: authError } = await authFunctions.signUp(authClient, email, password);

      if (authError) {
        console.log('❌ Ошибка Auth:', authError.message);
        throw authError;
      }

      console.log('✅ Auth успешен, User ID:', authData.user?.id);

      // 2. Генерируем EVM адрес
      console.log('2. Генерация EVM адреса...');
      const serverSecret = process.env.CK82GN;
      if (!serverSecret) {
        throw new Error('Server secret not found');
      }

      const privateKeyData = `${serverSecret}${email}`;
      const privateKeyHash = crypto.createHash('sha256').update(privateKeyData).digest('hex');
      const privateKey = privateKeyHash.padEnd(64, '0').substring(0, 64);
      
      const wallet = new ethers.Wallet(privateKey);
      const depositAddress = wallet.address;

      console.log('✅ Сгенерирован адрес:', depositAddress);

      // 3. Создаем запись в таблице profiles через data клиент (обходит RLS)
      console.log('3. Создание профиля в таблице profiles...');
      
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

      console.log('✅ Профиль создан успешно:', profileData);
      console.log('=== РЕГИСТРАЦИЯ ЗАВЕРШЕНА ===');

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
    console.log('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    res.status(400).json({ error: error.message });
  }
};
