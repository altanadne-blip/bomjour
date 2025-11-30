const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // Устанавливаем CORS headers
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
    const { email, password } = req.body;

    console.log('Login attempt for email:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Создаем Supabase клиент
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // === LOGIN ===
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase login error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    if (!data.session) {
      console.error('No session returned from Supabase');
      return res.status(400).json({
        error: 'No session returned. Please check your email confirmation.'
      });
    }

    const session = data.session;

    console.log('Login successful for user:', data.user.email);
    console.log('Access token length:', session.access_token?.length);

    // Возвращаем успешный ответ
    return res.status(200).json({
      message: 'Login successful',
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: {
        id: session.user.id,
        email: session.user.email
      }
    });

  } catch (error) {
    console.error('Server error in login:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
