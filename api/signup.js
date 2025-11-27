const { createClient } = require('@supabase/supabase-js');

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
    const { email, password, login } = req.body; // Получаем login из тела запроса
    console.log('Email:', email, 'Password:', password, 'Login:', login); // Логируем email и пароль (для отладки)

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
      // Пытаемся выполнить логин
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
      // Пытаемся выполнить регистрацию
      console.log('Attempting to sign up...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.log('Supabase error during signup:', error.message);
        throw error;
      }

      console.log('Sign up successful:', data);

      res.status(200).json({
        message: 'Success! Check your email for confirmation.',
      });
    }

  } catch (error) {
    console.log('Caught error:', error);
    res.status(400).json({ error: error.message });
  }
};
