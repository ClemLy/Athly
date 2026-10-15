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
    console.error("[SMTP] Connexion échouée :", {
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
// Tables + styles en ligne (seul format fiable dans Gmail, Outlook, Apple Mail).
// Contrastes ≥ 4,5:1 sur fond sombre. Le code est un seul bloc de texte :
// copiable d'un geste et reconnu par la saisie automatique des codes sur iOS.

const C = {
  page: "#0D1018", card: "#16161F", line: "#2A2A39",
  text: "#FFFFFF", soft: "#B4B9C5", muted: "#9AA0AE",
};

function baseTemplate({ title, preheader, accent, heading, intro, codeLabel, code, footnote }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.page};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Aperçu affiché dans la liste des emails -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background-color:${C.page};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img src="cid:logo_athly" alt="Athly" width="140" style="width:140px;height:auto;display:block;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td bgcolor="${C.card}" style="background-color:${C.card};border-radius:20px;border:1px solid ${C.line};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="height:4px;background-color:${accent};border-radius:20px 20px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:32px 32px 8px;text-align:center;">
                    <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:${C.text};">${heading}</h1>
                    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:${C.soft};">${intro}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 32px 28px;text-align:center;">
                    <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};">${codeLabel}</p>
                    <div style="display:inline-block;padding:14px 12px 14px 22px;border-radius:14px;background-color:${C.page};border:1.5px solid ${accent};font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:34px;line-height:1;font-weight:700;letter-spacing:10px;color:${C.text};">${code}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 32px 28px;text-align:center;border-top:1px solid ${C.line};">
                    <p style="margin:0;font-size:14px;line-height:1.6;color:${C.soft};">${footnote}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 8px 0;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:${C.muted};">
                Tu reçois cet email car une action a été faite avec cette adresse sur Athly.<br/>
                Si ce n'est pas toi, ignore-le : rien ne changera sur ton compte.
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
  return baseTemplate({
    title: "Confirme ton adresse email",
    preheader: `Ton code Athly : ${code}. Il expire dans 10 minutes.`,
    accent: "#FE7439",
    heading: "Confirme ton adresse email",
    intro: `Entre ce code dans Athly pour activer ton compte. Il expire dans <strong style="color:${C.text};">10&nbsp;minutes</strong>.`,
    codeLabel: "Ton code",
    code,
    footnote: "Le code ne fonctionne qu'une fois. Ne le partage avec personne, Athly ne te le demandera jamais.",
  });
}

function resetPasswordTemplate(code) {
  return baseTemplate({
    title: "Ton code pour changer de mot de passe",
    preheader: `Ton code : ${code}. Il expire dans 15 minutes.`,
    accent: "#7B77F3",
    heading: "Choisis un nouveau mot de passe",
    intro: `Entre ce code dans Athly pour définir ton nouveau mot de passe. Il expire dans <strong style="color:${C.text};">15&nbsp;minutes</strong>.`,
    codeLabel: "Ton code",
    code,
    footnote: "Tu n'as rien demandé&nbsp;? Ignore cet email : ton mot de passe actuel reste inchangé.",
  });
}

// ── Fonction interne d'envoi avec logs détaillés ─────────────────────────────

async function _send(to, subject, html, text, label) {
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      // Version texte : lisible partout et mieux notée par les filtres anti-spam
      text,
      attachments: [{
        filename: 'logo-orange.png',
        path:     LOGO_PATH,
        cid:      'logo_athly',
      }],
    });
    return info;
  } catch (err) {
    console.error(`[SMTP] Échec "${label}" :`, {
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
    `${code} est ton code Athly`,
    verificationTemplate(code),
    `Ton code pour confirmer ton adresse email : ${code}\n\nEntre-le dans l'application Athly. Il expire dans 10 minutes.\n\nSi tu n'es pas à l'origine de cette demande, ignore simplement cet email.`,
    "Email de vérification"
  );
}

async function sendResetPasswordEmail(email, code) {
  return _send(
    email,
    `${code} est ton code pour changer de mot de passe`,
    resetPasswordTemplate(code),
    `Ton code pour choisir un nouveau mot de passe : ${code}\n\nEntre-le dans l'application Athly. Il expire dans 15 minutes.\n\nTu n'as rien demandé ? Ignore cet email, ton mot de passe actuel reste inchangé.`,
    "Email de réinitialisation"
  );
}

module.exports = { sendVerificationEmail, sendResetPasswordEmail, verificationTemplate, resetPasswordTemplate };
