const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Получаем пользователя из токена
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Получаем профиль пользователя с балансом
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    let balance = 0;

    if (profileError) {
      console.log('Profile not found, creating new one...');
      // Создаем профиль если его нет
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([{ 
          id: user.id, 
          email: user.email,
          balance: 0,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
      } else {
        balance = newProfile.balance || 0;
      }
    } else {
      balance = profile.balance || 0;
    }

    // Возвращаем все данные пользователя
    return res.status(200).json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      balance: balance
    });

  } catch (error) {
    console.error('User data error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
