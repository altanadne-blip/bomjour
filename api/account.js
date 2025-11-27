const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  console.log('Received request for account info:', req.method);

  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Получаем текущего пользователя
    const user = supabase.auth.user();

    if (!user) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    // Возвращаем информацию о пользователе
    res.status(200).json({
      user: {
        email: user.email,
        id: user.id,
      },
    });

  } catch (error) {
    console.log('Caught error:', error);
    res.status(400).json({ error: error.message });
  }
};
