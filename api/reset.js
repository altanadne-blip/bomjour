const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  console.log('Received reset request:', req.method, req.body);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Создаем клиента Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://yourdomain.com/newpassword.html'
    });

    if (error) throw error;

    return res.status(200).json({ message: 'Reset link sent' });

  } catch (e) {
    console.log('Reset error:', e);
    return res.status(400).json({ error: e.message });
  }
};
