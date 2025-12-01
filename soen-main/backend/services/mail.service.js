import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,                 // smtp.gmail.com
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,                               // use STARTTLS on 587
  auth: {
    user: process.env.SMTP_USER,              // sanjanabu47@gmail.com
    pass: process.env.SMTP_PASS               // ysybzrfikftcbmkj
  }
});

export async function sendOtp(email, otp) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Your registration OTP',
    html: `<p>Your OTP is <b>${otp}</b>. It is valid for 10 minutes.</p>`
  });
}
