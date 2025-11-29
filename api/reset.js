const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  console.log("RESET endpoint hit:", req.method, req.body);

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, action, password, token } = req.body;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Если запрос на отправку ссылки сброса
    if (action === 'updatePassword') {
      if (!password || !token) {
        return res.status(400).json({ error: "Password and token are required" });
      }

      // Парсим токены из hash
      const params = new URLSearchParams(token);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      const type = params.get("type");

      if (!access_token || !refresh_token || type !== "recovery") {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }

      // Устанавливаем сессию
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token
      });

      if (sessionError) throw sessionError;

      // Обновляем пароль
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      return res.status(200).json({ message: "Password updated successfully!" });

    } else {
      // Оригинальная логика отправки email
      if (!email)
        return res.status(400).json({ error: "Email is required" });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://bomjour.vercel.app/newpassword.html"
      });

      if (error) throw error;

      return res.status(200).json({ message: "Reset link sent" });
    }

  } catch (e) {
    console.log("RESET ERROR:", e);
    return res.status(400).json({ error: e.message });
  }
};
