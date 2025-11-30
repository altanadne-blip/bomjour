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

    console.log('Fetching user data...');

    // Получаем пользователя из токена
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('User found:', user.email);

    // Получаем профиль пользователя с балансом
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('Profile query result:', { profile, profileError });

    let balance = 0;

    if (profileError) {
      console.log('Profile not found, creating new one for user:', user.id);
      
      // Создаем профиль если его нет
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([{ 
          id: user.id, 
          email: user.email,
          balance: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
        balance = 0;
      } else {
        balance = newProfile.balance || 0;
        console.log('New profile created with balance:', balance);
      }
    } else {
      balance = profile.balance || 0;
      console.log('Existing profile found with balance:', balance);
    }

    // Возвращаем все данные пользователя
    const responseData = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      balance: balance
    };

    console.log('Sending response:', responseData);

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('User data error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
