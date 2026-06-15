const nodemailer = require("nodemailer");
const path       = require("path");

const LOGO_PATH = path.join(__dirname, "../assets/logo-orange.png");

// ── Transporter ───────────────────────────────────────────────────────────────
const useSSL  = process.env.SMTP_PORT === "465";
const smtpPort = parseInt(process.env.SMTP_PORT || "587");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   smtpPort,
  secure: useSSL,          // true → SSL direct (port 465) ; false → STARTTLS (port 587)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // En dev : désactive la vérification du certificat pour éviter les erreurs self-signed
    rejectUnauthorized: process.env.NODE_ENV === "production",
  },
  // Délai avant abandon (10 s)
  connectionTimeout: 10000,
  greetingTimeout:   5000,
});

transporter.verify((err) => {
  if (err) {
    console.error("❌ [SMTP] Connexion échouée :", {
      code:         err.code,
      command:      err.command,
      response:     err.response,
      responseCode: err.responseCode,
      message:      err.message,
    });
  }
});

// SMTP_FROM = adresse vérifiée dans Brevo (Senders & IPs)
// SMTP_USER = credential d'authentification SMTP (≠ expéditeur)
const FROM = `"Athly" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

// ── Templates HTML ────────────────────────────────────────────────────────────

function baseTemplate(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0D1018;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D1018;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;">

          <!-- Logo / En-tête -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="cid:logo_athly" alt="Athly" style="width:200px;height:auto;display:block;margin:0 auto 20px;" />
            </td>
          </tr>

          <!-- Carte principale -->
          <tr>
            <td style="background-color:#16161F;border-radius:20px;border:1px solid #2A2A39;overflow:hidden;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-size:12px;color:#4A4F5C;line-height:1.6;">
                Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.<br/>
                © 2026 Athly — Tous droits réservés.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function verificationTemplate(code) {
  const digits = code.split("").map(d =>
    `<span style="display:inline-block;width:44px;height:52px;line-height:52px;text-align:center;background:#0D1018;border:1.5px solid #FE7439;border-radius:10px;font-size:24px;font-weight:700;color:#FFFFFF;margin:0 4px;">${d}</span>`
  ).join("");

  const body = `
    <!-- Icône -->
    <div style="padding:36px 36px 0;text-align:center;">
      <div style="display:inline-block;background:rgba(254,116,57,0.1);border:1px solid rgba(254,116,57,0.2);border-radius:20px;width:72px;height:72px;line-height:72px;text-align:center;font-size:30px;">✉️</div>
    </div>

    <!-- Titre -->
    <div style="padding:20px 36px 0;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">Vérifiez votre email</h1>
      <p style="margin:10px 0 0;font-size:15px;color:#9AA0AE;line-height:1.6;">
        Utilisez le code ci-dessous pour activer votre compte&nbsp;Athly.<br/>
        Il expire dans <strong style="color:#FFFFFF;">10 minutes</strong>.
      </p>
    </div>

    <!-- Code OTP -->
    <div style="padding:28px 36px;text-align:center;border-top:1px solid #2A2A39;margin-top:24px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#6D7382;text-transform:uppercase;">Code de vérification</p>
      <div>${digits}</div>
    </div>

    <!-- Avertissement -->
    <div style="padding:20px 36px 32px;text-align:center;border-top:1px solid #2A2A39;">
      <p style="margin:0;font-size:13px;color:#6D7382;">
        Ce code est à usage unique et valable 10 minutes.
      </p>
    </div>`;

  return baseTemplate("Vérification de votre compte Athly", body);
}

function resetPasswordTemplate(code) {
  const digits = code.split("").map(d =>
    `<span style="display:inline-block;width:44px;height:52px;line-height:52px;text-align:center;background:#0D1018;border:1.5px solid #6E6AF0;border-radius:10px;font-size:24px;font-weight:700;color:#FFFFFF;margin:0 4px;">${d}</span>`
  ).join("");

  const body = `
    <!-- Icône -->
    <div style="padding:36px 36px 0;text-align:center;">
      <div style="display:inline-block;background:rgba(110,106,240,0.1);border:1px solid rgba(110,106,240,0.2);border-radius:20px;width:72px;height:72px;line-height:72px;text-align:center;font-size:30px;">🔑</div>
    </div>

    <!-- Titre -->
    <div style="padding:20px 36px 0;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">Réinitialisation du mot de passe</h1>
      <p style="margin:10px 0 0;font-size:15px;color:#9AA0AE;line-height:1.6;">
        Utilisez ce code pour définir un nouveau mot de passe.<br/>
        Il expire dans <strong style="color:#FFFFFF;">15 minutes</strong>.
      </p>
    </div>

    <!-- Code OTP -->
    <div style="padding:28px 36px;text-align:center;border-top:1px solid #2A2A39;margin-top:24px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#6D7382;text-transform:uppercase;">Code de réinitialisation</p>
      <div>${digits}</div>
    </div>

    <!-- Sécurité -->
    <div style="padding:20px 36px 32px;text-align:center;border-top:1px solid #2A2A39;">
      <p style="margin:0;font-size:13px;color:#6D7382;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.<br/>
        Votre mot de passe actuel reste inchangé.
      </p>
    </div>`;

  return baseTemplate("Réinitialisation de votre mot de passe Athly", body);
}

// ── Fonction interne d'envoi avec logs détaillés ─────────────────────────────

async function _send(to, subject, html, label) {
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      attachments: [{
        filename: 'logo-orange.png',
        path:     LOGO_PATH,
        cid:      'logo_athly',
      }],
    });
    return info;
  } catch (err) {
    console.error(`❌ [SMTP] Échec "${label}" pour ${to} :`, {
      code:         err.code,        // ex: EAUTH, ECONNECTION, ETIMEDOUT
      command:      err.command,     // ex: AUTH, MAIL FROM
      response:     err.response,    // message brut du serveur SMTP
      responseCode: err.responseCode,// code numérique SMTP (ex: 535)
      message:      err.message,
    });
    throw err; // re-throw pour que l'appelant décide de la stratégie (log / silencieux)
  }
}

// ── Fonctions publiques ───────────────────────────────────────────────────────

async function sendVerificationEmail(email, code) {
  return _send(
    email,
    "Votre code de vérification Athly",
    verificationTemplate(code),
    "Email de vérification"
  );
}

async function sendResetPasswordEmail(email, code) {
  return _send(
    email,
    "Réinitialisation de votre mot de passe Athly",
    resetPasswordTemplate(code),
    "Email de réinitialisation"
  );
}

module.exports = { sendVerificationEmail, sendResetPasswordEmail };
