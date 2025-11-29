const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  console.log("RESET endpoint hit:", req.method, req.body);

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ error: "Email is required" });

    // Используем те же переменные окружения, что и в рабочем коде
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY  // Изменено с SERVICE_ROLE на ANON_KEY
    );

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://bomjour.vercel.app/newpassword.html"
    });

    if (error) throw error;

    return res.status(200).json({ message: "Reset link sent" });
  } catch (e) {
    console.log("RESET ERROR:", e);
    return res.status(400).json({ error: e.message });
  }
};
