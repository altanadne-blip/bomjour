const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // Логирование запроса для отладки
  console.log('Received login request:', req.method);

  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email); // Логируем email

    // Проверяем, что email и пароль переданы
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Пытаемся выполнить логин
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('Login error:', error.message);
      throw error;
    }

    console.log('Login successful:', data);

    // Ответ на успешный логин
    res.status(200).json({
      message: 'Login successful',
    });

  } catch (error) {
    console.log('Caught error:', error);
    res.status(400).json({ error: error.message });
  }
};
